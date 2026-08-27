const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const {
    getSetup, registerChannel, unregisterChannel,
    getOwnerOfChannel, getChannelOfOwner, getUserSettings
} = require('../utils/tempVoiceStore');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        const guild = newState.guild || oldState.guild;
        const setup = getSetup(guild.id);
        if (!setup || !setup.createChannelId) return;

        // ---------- הצטרפות לחדר היצירה ----------
        if (newState.channelId === setup.createChannelId) {
            await handleCreateJoin(newState, setup);
        }

        // ---------- ניסיון כניסה לחדר זמני נעול עם מצב חדר המתנה ----------
        if (newState.channelId && newState.channelId !== setup.createChannelId) {
            await handleTempChannelJoinAttempt(newState, setup);
        }

        // ---------- עזיבת חדר זמני - מוחקים אם הוא התרוקן ----------
        if (oldState.channelId && oldState.channelId !== newState.channelId) {
            await handlePossibleCleanup(oldState, setup);
        }
    }
};

async function handleCreateJoin(state, setup) {
    const guild = state.guild;
    const member = state.member;

    const existingChannelId = getChannelOfOwner(guild.id, member.id);
    if (existingChannelId) {
        const existingChannel = guild.channels.cache.get(existingChannelId);
        if (existingChannel) {
            return member.voice.setChannel(existingChannel).catch(() => {});
        }
    }

    const settings = getUserSettings(guild.id, member.id);
    const channelName = settings.name || `🔊・החדר של ${member.displayName}`;

    const overwrites = [
        {
            id: guild.roles.everyone.id,
            deny: settings.locked ? [PermissionFlagsBits.Connect] : [],
            allow: settings.chatLocked ? [] : []
        },
        {
            id: member.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.ManageChannels
            ]
        }
    ];

    for (const blockedId of settings.blockedUserIds) {
        overwrites.push({ id: blockedId, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] });
    }
    for (const trustedId of settings.trustedUserIds) {
        overwrites.push({ id: trustedId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] });
    }

    try {
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            parent: setup.categoryId,
            userLimit: settings.limit || 0,
            permissionOverwrites: overwrites
        });

        if (settings.chatLocked) {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
        }

        await member.voice.setChannel(channel);
        registerChannel(guild.id, channel.id, member.id);
    } catch (err) {
        console.error('❌ שגיאה ביצירת חדר זמני:', err);
    }
}

async function handleTempChannelJoinAttempt(state, setup) {
    const channelId = state.channelId;
    const ownerId = getOwnerOfChannel(state.guild.id, channelId);
    if (!ownerId || ownerId === state.member.id) return;

    const settings = getUserSettings(state.guild.id, ownerId);
    if (!settings.waitingRoom || !settings.locked) return;
    if (settings.trustedUserIds.includes(state.member.id)) return;

    const channel = state.guild.channels.cache.get(channelId);
    const waitingChannel = state.guild.channels.cache.get(setup.waitingChannelId);
    if (!channel || !waitingChannel) return;

    const overwrite = channel.permissionOverwrites.cache.get(state.member.id);
    if (overwrite?.allow?.has(PermissionFlagsBits.Connect)) return; // כבר אושר במפורש

    try {
        await state.member.voice.setChannel(waitingChannel);
    } catch (err) {
        console.error('❌ שגיאה בהעברה לחדר המתנה:', err);
        return;
    }

    const controllerChannel = state.guild.channels.cache.get(setup.controllerChannelId);
    if (controllerChannel) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`tempvoice_waitpermit_${channelId}_${state.member.id}`).setLabel('אשר').setEmoji('✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`tempvoice_waitreject_${channelId}_${state.member.id}`).setLabel('דחה').setEmoji('❌').setStyle(ButtonStyle.Danger)
        );
        await controllerChannel.send({
            content: `<@${ownerId}> — ${state.member} מבקש להצטרף לחדר שלך.`,
            components: [row]
        }).catch(() => {});
    }
}

async function handlePossibleCleanup(oldState, setup) {
    const channel = oldState.channel;
    if (!channel) return;
    if (channel.id === setup.createChannelId || channel.id === setup.controllerChannelId || channel.id === setup.waitingChannelId) return;

    const ownerId = getOwnerOfChannel(oldState.guild.id, channel.id);
    if (!ownerId) return;

    const freshChannel = oldState.guild.channels.cache.get(channel.id);
    if (!freshChannel) return;

    if (freshChannel.members.size === 0) {
        unregisterChannel(oldState.guild.id, channel.id);
        await freshChannel.delete().catch(() => {});
    }
}
