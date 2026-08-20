const { PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('./config');

/**
 * בודק אם המשתמש רשאי להשתמש בפקודות המודרציה (mute/unmute/vmute/unvmute).
 * Administrator תמיד רשאי. אם לא הוגדרו רולים מורשים בפאנל - רק Administrator רשאי.
 * אם הוגדרו רולים - צריך להחזיק לפחות אחד מהם.
 */
function canUseModerationCommand(interaction) {
    if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;

    const config = getGuildConfig(interaction.guild.id).moderation;
    if (config.allowedRoles.length === 0) return false;

    return config.allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId));
}

/**
 * בודק הגבלת חדרים לפקודות המודרציה. Administrator פטור תמיד.
 * מערך ריק = חופשי בכל חדר.
 */
function isModerationChannelAllowed(interaction) {
    if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;

    const config = getGuildConfig(interaction.guild.id).moderation;
    if (config.allowedChannels.length === 0) return true;

    return config.allowedChannels.includes(interaction.channel.id);
}

module.exports = { canUseModerationCommand, isModerationChannelAllowed };
