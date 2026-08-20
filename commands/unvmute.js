const { SlashCommandBuilder } = require('discord.js');
const { getGuildConfig } = require('../utils/config');
const { canUseModerationCommand, isModerationChannelAllowed } = require('../utils/moderationCheck');
const { removeMute } = require('../utils/muteStore');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unvmute')
        .setDescription('הסרת השתקת קול ממשתמש')
        .addUserOption(opt => opt.setName('user').setDescription('המשתמש להסרת ההשתקה').setRequired(true)),

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

        if (member && config.vmuteRoleId && member.roles.cache.has(config.vmuteRoleId)) {
            try {
                await member.roles.remove(config.vmuteRoleId);
            } catch (err) {
                console.error('❌ שגיאה בהסרת רול השתקת קול:', err);
                return interaction.reply({ content: '❌ לא הצלחתי להסיר את הרול.', ephemeral: true });
            }
        }

        removeMute(interaction.guild.id, 'voice', targetUser.id);
        await interaction.reply(`✅ השתקת הקול של ${targetUser} הוסרה.`);
    }
};
