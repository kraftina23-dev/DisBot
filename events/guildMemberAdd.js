const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildConfig } = require('../utils/config');
const { trackInviteUse } = require('../utils/inviteTracker');
 
module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        // מזהים איזו הזמנה נעשה בה שימוש ומזכים את המזמין - לא תלוי בהגדרת חדר וולקאם
        try {
            await trackInviteUse(member);
        } catch (err) {
            console.error('❌ שגיאה במעקב אחרי הזמנות:', err);
        }
 
        await sendWelcomeMessage(member);
    },
};
 
async function sendWelcomeMessage(member) {
    const welcomeConfig = getGuildConfig(member.guild.id).welcome;
 
    if (!welcomeConfig.channelId) {
        return console.log(`⚠️ חדר ברוכים הבאים לא הוגדר בשרת ${member.guild.name} - יש להגדיר דרך /panel`);
    }
 
    const channel = member.guild.channels.cache.get(welcomeConfig.channelId);
    if (!channel) return console.log("Welcome channel not found!");
 
    const welcomeEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`ברוכים הבאים - ${member.user.username}`)
        .setDescription(`היי ${member}, ברוכים הבאים לשרת **${member.guild.name}!**\nאנו מקווים שתיהנה בשרת, לא לשכוח לקרוא את החוקים!`)
        .setThumbnail(member.user.displayAvatarURL({ forceStatic: false }))
        .setTimestamp()
        .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() });
 
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('member_count')
                .setLabel(`${member.guild.memberCount} Members`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );
 
    try {
        await channel.send({
            embeds: [welcomeEmbed],
            components: [row]
        });
    } catch (error) {
        console.error("Error:", error);
    }
}
 