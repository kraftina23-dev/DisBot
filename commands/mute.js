const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../utils/config');
const { canUseModerationCommand, isModerationChannelAllowed } = require('../utils/moderationCheck');
const { setMute } = require('../utils/muteStore');
const { scheduleAutoUnmute } = require('../utils/muteScheduler');

function parseDuration(input) {
    const match = /^(\d+)\s*([dhm])$/i.exec(input.trim());
    if (!match) return null;
    const amount = parseInt(match[1], 10);
    if (amount <= 0) return null;
    const unit = match[2].toLowerCase();
    const unitToMs = { m: 60_000, h: 3_600_000, d: 86_400_000 };
    return amount * unitToMs[unit];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('חסימת יכולת כתיבה בצ׳אטים ממשתמש')
        .addUserOption(opt => opt.setName('user').setDescription('המשתמש להשתקה (אפשר תיוג או ID)').setRequired(true))
        .addStringOption(opt => opt.setName('duration').setDescription('משך הזמן, למשל 10m/2h/1d (ריק = לצמיתות)').setRequired(false))
        .addStringOption(opt => opt.setName('reason').setDescription('הסיבה למיוט').setRequired(false)),

    async execute(interaction) {
        if (!canUseModerationCommand(interaction)) {
            return interaction.reply({ content: '⛔ אין לך הרשאה להשתמש בפקודה הזו.', ephemeral: true });
        }
        if (!isModerationChannelAllowed(interaction)) {
            const allowed = getGuildConfig(interaction.guild.id).moderation.allowedChannels;
            return interaction.reply({ content: `❌ אפשר להשתמש בפקודה הזו רק בחדרים הבאים: ${allowed.map(id => `<#${id}>`).join(', ')}`, ephemeral: true });
        }

        const config = getGuildConfig(interaction.guild.id).moderation;
        if (!config.muteRoleId) {
            return interaction.reply({ content: '⚠️ רול המיוט עדיין לא הוגדר בשרת הזה. יש להריץ קודם `/setup mute`.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('user');
        const durationInput = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') || 'לא צוינה סיבה';

        let durationMs = null;
        if (durationInput) {
            durationMs = parseDuration(durationInput);
            if (!durationMs) {
                return interaction.reply({ content: '❌ פורמט זמן לא תקין. יש להשתמש למשל: `10m`, `2h`, `1d`.', ephemeral: true });
            }
        }

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) {
            return interaction.reply({ content: '❌ לא מצאתי את המשתמש הזה בשרת.', ephemeral: true });
        }

        try {
            await member.roles.add(config.muteRoleId);
        } catch (err) {
            console.error('❌ שגיאה בהוספת רול מיוט:', err);
            return interaction.reply({ content: '❌ לא הצלחתי לתת את רול המיוט. ייתכן שהרול של הבוט נמוך מדי בהיררכיה.', ephemeral: true });
        }

        const expiresAt = durationMs ? Date.now() + durationMs : null;
        setMute(interaction.guild.id, 'text', targetUser.id, {
            expiresAt,
            moderatorId: interaction.user.id,
            reason
        });
        if (expiresAt) scheduleAutoUnmute(interaction.client, interaction.guild.id, 'text', targetUser.id, expiresAt);

        const embed = new EmbedBuilder()
            .setTitle('🔇 משתמש הושתק')
            .addFields(
                { name: 'משתמש', value: `${targetUser}`, inline: false },
                { name: 'משך', value: durationMs ? durationInput : 'לצמיתות', inline: false },
                { name: 'סיבה', value: reason, inline: false }
            )
            .setColor(0xED4245);

        await interaction.reply({ embeds: [embed] });
    }
};
