const { ChannelType } = require('discord.js');
const { getGuildConfig } = require('../utils/config');
const { TEXT_CHANNEL_TYPES, VOICE_CHANNEL_TYPES } = require('../utils/muteRoleSetup');

module.exports = {
    name: 'channelCreate',
    async execute(channel) {
        if (!channel.guild) return;
        const config = getGuildConfig(channel.guild.id).moderation;

        try {
            if (config.muteRoleId && TEXT_CHANNEL_TYPES.includes(channel.type)) {
                const role = channel.guild.roles.cache.get(config.muteRoleId);
                if (role) {
                    await channel.permissionOverwrites.edit(role, {
                        SendMessages: false,
                        SendMessagesInThreads: false,
                        CreatePublicThreads: false,
                        CreatePrivateThreads: false,
                        AddReactions: false
                    });
                }
            }

            if (config.vmuteRoleId && VOICE_CHANNEL_TYPES.includes(channel.type)) {
                const role = channel.guild.roles.cache.get(config.vmuteRoleId);
                if (role) {
                    await channel.permissionOverwrites.edit(role, {
                        Speak: false,
                        Stream: false,
                        RequestToSpeak: false
                    });
                }
            }
        } catch (err) {
            console.error('❌ שגיאה בהחלת הרשאות מיוט על חדר חדש:', err);
        }
    }
};
