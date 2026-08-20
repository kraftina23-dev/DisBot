const { ChannelType } = require('discord.js');

const TEXT_CHANNEL_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum];
const VOICE_CHANNEL_TYPES = [ChannelType.GuildVoice, ChannelType.GuildStageVoice];

/**
 * יוצר (אם צריך) את רול המיוט לטקסט, וחוסם ממנו שליחת הודעות בכל חדרי הטקסט הקיימים בשרת.
 */
async function setupTextMuteRole(guild, existingRoleId) {
    let role = existingRoleId ? guild.roles.cache.get(existingRoleId) : null;

    if (!role) {
        role = await guild.roles.create({
            name: 'Muted',
            color: 0x5C5C5C,
            reason: 'רול מיוט טקסט אוטומטי - נוצר על ידי /setup mute'
        });
    }

    const textChannels = guild.channels.cache.filter(c => TEXT_CHANNEL_TYPES.includes(c.type));

    for (const channel of textChannels.values()) {
        await channel.permissionOverwrites.edit(role, {
            SendMessages: false,
            SendMessagesInThreads: false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
            AddReactions: false
        }).catch(err => console.error(`❌ לא הצלחתי לעדכן הרשאות מיוט בחדר "${channel.name}":`, err.message));
    }

    return role;
}

/**
 * יוצר (אם צריך) את רול השתקת הקול, וחוסם ממנו דיבור בכל חדרי הקול הקיימים בשרת.
 */
async function setupVoiceMuteRole(guild, existingRoleId) {
    let role = existingRoleId ? guild.roles.cache.get(existingRoleId) : null;

    if (!role) {
        role = await guild.roles.create({
            name: 'VMuted',
            color: 0x5C5C5C,
            reason: 'רול השתקת קול אוטומטי - נוצר על ידי /setup vmute'
        });
    }

    const voiceChannels = guild.channels.cache.filter(c => VOICE_CHANNEL_TYPES.includes(c.type));

    for (const channel of voiceChannels.values()) {
        await channel.permissionOverwrites.edit(role, {
            Speak: false,
            Stream: false,
            RequestToSpeak: false
        }).catch(err => console.error(`❌ לא הצלחתי לעדכן הרשאות השתקה בחדר "${channel.name}":`, err.message));
    }

    return role;
}

module.exports = { setupTextMuteRole, setupVoiceMuteRole, TEXT_CHANNEL_TYPES, VOICE_CHANNEL_TYPES };
