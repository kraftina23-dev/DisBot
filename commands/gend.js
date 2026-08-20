const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGiveaway } = require('../utils/giveaways');
const { forceEndGiveaway } = require('../utils/giveawayScheduler');
 
module.exports = {
    data: new SlashCommandBuilder()
        .setName('gend')
        .setDescription('סיום מוקדם של הגרלה פעילה לפי ID')
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
        if (giveaway.ended) {
            return interaction.reply({ content: '⚠️ ההגרלה הזו כבר הסתיימה.', ephemeral: true });
        }
 
        await interaction.reply({ content: `✅ מסיים את ההגרלה **${giveaway.title}** עכשיו...`, ephemeral: true });
        await forceEndGiveaway(interaction.client, giveawayId);
    }
};
 