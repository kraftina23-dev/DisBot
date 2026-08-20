const { SlashCommandBuilder } = require('discord.js');
const { getGuildConfig } = require('../utils/config');
const { canUseModerationCommand, isModerationChannelAllowed } = require('../utils/moderationCheck');
const { removeMute } = require('../utils/muteStore');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('הסרת חסימת כתיבה ממשתמש')
        .addUserOption(opt => opt.setName('user').setDescription('המשתמש להסרת המיוט').setRequired(true)),

    async execute(interaction) {
        if (!canUseModerationCommand(interaction)) {
            return interaction.reply({ content: '⛔ אין לך הרשאה להשתמש בפקודה הזו.', ephemeral: true });
        }
        if (!isModerationChannelAllowed(interaction)) {
            const allowed = getGuildConfig(interaction.guild.id).moderation.allowedChannels;
            return interaction.reply({ content: `❌ אפשר להשתמש בפקודה הזו רק בחדרים הבאים: ${allowed.map(id => `<#${id}>`).join(', ')}`, ephemeral: true });
        }

        const config = getGuildConfig(interaction.guild.id).moderation;
        const targetUser = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (member && config.muteRoleId && member.roles.cache.has(config.muteRoleId)) {
            try {
                await member.roles.remove(config.muteRoleId);
            } catch (err) {
                console.error('❌ שגיאה בהסרת רול מיוט:', err);
                return interaction.reply({ content: '❌ לא הצלחתי להסיר את הרול.', ephemeral: true });
            }
        }

        removeMute(interaction.guild.id, 'text', targetUser.id);
        await interaction.reply(`✅ המיוט של ${targetUser} הוסר.`);
    }
};
