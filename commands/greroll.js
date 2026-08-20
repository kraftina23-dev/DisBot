const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGiveaway } = require('../utils/giveaways');
const { rerollGiveaway } = require('../utils/giveawayScheduler');
 
module.exports = {
    data: new SlashCommandBuilder()
        .setName('greroll')
        .setDescription('בחירת זוכה חדש עבור הגרלה שכבר הסתיימה, לפי ID')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(opt =>
            opt.setName('id')
                .setDescription('ה-ID של הודעת ההגרלה (קליק ימני על ההודעה -> Copy Message ID)')
                .setRequired(true)
        ),
 
    async execute(interaction) {
        const giveawayId = interaction.options.getString('id');
        const giveaway = getGiveaway(giveawayId);
 
        if (!giveaway || giveaway.guildId !== interaction.guild.id) {
            return interaction.reply({ content: '❌ לא נמצאה הגרלה עם ה-ID הזה בשרת הזה. תבדוק את ה-ID הנכון עם `/glist`.', ephemeral: true });
        }
        if (!giveaway.ended) {
            return interaction.reply({ content: '⚠️ ההגרלה הזו עדיין פעילה - אי אפשר לגלגל מחדש הגרלה שלא הסתיימה (אפשר לסיים אותה קודם עם `/gend`).', ephemeral: true });
        }
        if (!giveaway.participants || giveaway.participants.length === 0) {
            return interaction.reply({ content: '❌ אין משתתפים בהגרלה הזו, אי אפשר לבחור זוכה חדש.', ephemeral: true });
        }
 
        await interaction.deferReply({ ephemeral: true });
        const result = await rerollGiveaway(interaction.client, giveawayId);
 
        if (!result) {
            return interaction.editReply({ content: '❌ קרתה שגיאה בעת גלגול הזוכה מחדש. ייתכן שההודעה המקורית נמחקה.' });
        }
 
        const winnersText = result.winners.length > 0
            ? result.winners.map(id => `<@${id}>`).join(', ')
            : 'אף אחד (לא נותרו משתתפים מתאימים)';
 
        await interaction.editReply({ content: `🔄 נבחרו זוכים חדשים ל-**${giveaway.title}**: ${winnersText}` });
    }
};
 