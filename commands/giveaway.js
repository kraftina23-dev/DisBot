const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { createGiveaway } = require('../utils/giveaways');
const { scheduleGiveawayEnd } = require('../utils/giveawayScheduler');
 
const COLOR_CHOICES = [
    { name: 'כחול (ברירת מחדל)', value: '5865F2' },
    { name: 'ירוק', value: '57F287' },
    { name: 'אדום', value: 'ED4245' },
    { name: 'סגול', value: '9B59B6' },
    { name: 'זהב', value: 'F1C40F' },
    { name: 'כתום', value: 'E67E22' },
    { name: 'ורוד', value: 'EB459E' }
];
 
// פורמט זמן: מספר + יחידה אחת מתוך D (ימים) / W (שבועות) / H (שעות) / M (דקות)
function parseDuration(input) {
    const match = /^(\d+)\s*([dwhm])$/i.exec(input.trim());
    if (!match) return null;
 
    const amount = parseInt(match[1], 10);
    if (amount <= 0) return null;
 
    const unit = match[2].toLowerCase();
    const unitToMs = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
 
    return amount * unitToMs[unit];
}
 
module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('פתיחת הגרלה חדשה בשרת')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(opt =>
            opt.setName('title')
                .setDescription('כותרת ההגרלה (הפרס)')
                .setRequired(true)
        )
        .addIntegerOption(opt =>
            opt.setName('winners')
                .setDescription('כמות זוכים')
                .setRequired(true)
                .setMinValue(1)
        )
        .addStringOption(opt =>
            opt.setName('time')
                .setDescription('משך ההגרלה - לדוגמה: 30m / 2h / 3d / 1w')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('description')
                .setDescription('תיאור נוסף להגרלה (לא חובה)')
                .setRequired(false)
        )
        .addAttachmentOption(opt =>
            opt.setName('banner')
                .setDescription('תמונת באנר להגרלה (לא חובה)')
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName('color')
                .setDescription('צבע הודעת ההגרלה (לא חובה)')
                .setRequired(false)
                .addChoices(...COLOR_CHOICES)
        ),
 
    async execute(interaction) {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const winnersCount = interaction.options.getInteger('winners');
        const timeInput = interaction.options.getString('time');
        const bannerAttachment = interaction.options.getAttachment('banner');
        const colorHex = interaction.options.getString('color') || '5865F2';
 
        const durationMs = parseDuration(timeInput);
        if (!durationMs) {
            return interaction.reply({
                content: '❌ פורמט זמן לא תקין. יש להשתמש במספר + יחידה אחת: `m` (דקות), `h` (שעות), `d` (ימים), `w` (שבועות).\nלדוגמה: `30m`, `2h`, `3d`, `1w`.',
                ephemeral: true
            });
        }
 
        const endTimestamp = Date.now() + durationMs;
        const endSeconds = Math.floor(endTimestamp / 1000);
 
        const embed = new EmbedBuilder()
            .setTitle(`🎉 ${title}`)
            .setColor(parseInt(colorHex, 16))
            .addFields(
                { name: 'מארח:', value: `${interaction.user}`, inline: false },
                { name: 'זוכים:', value: `${winnersCount}`, inline: false },
                { name: 'מסתיימת:', value: `<t:${endSeconds}:R> (<t:${endSeconds}:f>)`, inline: false }
            )
            .setFooter({ text: 'לחצו על הכפתור כדי להצטרף! משתתפים: 0' })
            .setTimestamp();
 
        if (description) embed.setDescription(description);
        if (bannerAttachment) embed.setImage(bannerAttachment.url);
 
        // שולחים קודם עם customId זמני, כי אנחנו עדיין לא יודעים מה יהיה ה-ID של ההודעה
        const pendingRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('giveaway_join_pending')
                .setLabel('🎉 הצטרף להגרלה')
                .setStyle(ButtonStyle.Success)
        );
 
        await interaction.reply({ embeds: [embed], components: [pendingRow] });
        const message = await interaction.fetchReply();
 
        // עכשיו שיש לנו את ה-ID האמיתי של ההודעה - מעדכנים את הכפתור להשתמש בו
        // כך שאפשר יהיה להשתמש ב-/gend ו-/greroll עם ה-ID הזה בדיוק (Copy Message ID)
        const finalRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`giveaway_join_${message.id}`)
                .setLabel('🎉 הצטרף להגרלה')
                .setStyle(ButtonStyle.Success)
        );
        await message.edit({ components: [finalRow] });
 
        const giveaway = createGiveaway({
            id: message.id,
            guildId: interaction.guild.id,
            channelId: interaction.channel.id,
            messageId: message.id,
            title,
            description: description || null,
            color: colorHex,
            bannerUrl: bannerAttachment ? bannerAttachment.url : null,
            winnersCount,
            endTimestamp,
            hostId: interaction.user.id,
            participants: [],
            ended: false
        });
 
        scheduleGiveawayEnd(interaction.client, giveaway);
    }
};
 