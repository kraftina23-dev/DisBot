const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildConfig } = require('../utils/config');
 
// Cooldown לפקודת !h - שומר מזהה משתמש -> חותמת זמן אחרונה
const helpCooldowns = new Map();
 
module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot || !message.guild) return;
 
        const content = message.content.trim();
        const firstWord = content.split(/\s+/)[0]?.toLowerCase();
 
        // ---------- !vt - בדיקת וותק ----------
        if (content.toLowerCase().startsWith('!vt')) {
            return handleVeteranCheck(message);
        }
 
        // ---------- !h - קריאה לעזרה/תמיכה ----------
        if (firstWord === '!h') {
            const args = content.split(/\s+/).slice(1);
            return handleHelpRequest(message, args);
        }
    },
};
 
async function handleVeteranCheck(message) {
    const veteranConfig = getGuildConfig(message.guild.id).veteran;
 
    // בדיקת חדר מורשה - מערך ריק = מותר בכל חדר
    if (
        veteranConfig.allowedChannels.length > 0 &&
        !veteranConfig.allowedChannels.includes(message.channel.id)
    ) return;
 
    if (!veteranConfig.roleId) {
        return message.reply('⚠️ עדיין לא הוגדר רול וותק בשרת הזה. יש לפנות לאדמין ולהגדיר דרך `/panel`.');
    }
 
    const member = message.member;
    const VETERAN_ROLE_ID = veteranConfig.roleId;
 
    const joinedTimestamp = Math.floor(member.joinedTimestamp / 1000);
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const requiredSeconds = veteranConfig.requiredDays * 24 * 60 * 60;
    const isEligible = (nowInSeconds - joinedTimestamp) >= requiredSeconds;
 
    const BANNER_URL = veteranConfig.bannerUrl;
 
    let eligibilityText = '';
    let statusColor = 0x0099FF;
 
    if (isEligible) {
        eligibilityText = `## האם אתה זכאי לקבלת וטרן?\n**אתה זכאי לרול וטרן!**\n<@&${VETERAN_ROLE_ID}>!`;
 
        if (!member.roles.cache.has(VETERAN_ROLE_ID)) {
            try {
                await member.roles.add(VETERAN_ROLE_ID);
            } catch (err) {
                console.error("❌ Error", err);
            }
        }
    } else {
        const daysText = veteranConfig.requiredDays % 365 === 0
            ? `${veteranConfig.requiredDays / 365} שנה/ים`
            : `${veteranConfig.requiredDays} ימים`;
        eligibilityText = `## האם אתה זכאי לקבלת וטרן?\n**אתה לא זכאי עדיין לרול וטרן**\n**אתה צריך להיות בשרת מעל ל-${daysText}.**`;
    }
 
    await message.reply({
        flags: 32768,
        components: [
            {
                type: 17,
                accent_color: statusColor,
                components: [
                    {
                        type: 10,
                        content: `## בדיקת וותק\n\n**המשתמש:** ${member}\n**נכנס בתאריך:**\n<t:${joinedTimestamp}:F> (<t:${joinedTimestamp}:R>)`
                    },
                    { type: 14 },
                    { type: 10, content: eligibilityText },
                    { type: 14 },
                    { type: 12, items: [{ media: { url: BANNER_URL } }] }
                ]
            }
        ]
    });
}
 
async function handleHelpRequest(message, args) {
    const helpConfig = getGuildConfig(message.guild.id).help;
 
    // בדיקת חדר מורשה - מערך ריק = מותר בכל חדר
    if (
        helpConfig.allowedChannels.length > 0 &&
        !helpConfig.allowedChannels.includes(message.channel.id)
    ) {
        const channelsText = helpConfig.allowedChannels.map(id => `<#${id}>`).join(', ');
        return message.reply(`הפקודה עובדת רק בחדרים הבאים: ${channelsText}`);
    }
 
    if (!helpConfig.roleIds || helpConfig.roleIds.length === 0) {
        return message.reply('⚠️ עדיין לא הוגדר רול צוות/תמיכה בשרת הזה. יש לפנות לאדמין ולהגדיר דרך `/panel`.');
    }
    const supportRolesText = helpConfig.roleIds.map(id => `<@&${id}>`).join(' ');
    const cooldownAmount = helpConfig.cooldownMs;
 
    const rawReason = args.join(' ');
    if (rawReason.includes('@everyone') || rawReason.includes('@')) {
        return;
    }
 
    const reason = (!rawReason || rawReason.trim() === "") ? "לא צוינה סיבה" : rawReason;
 
    const now = Date.now();
    const expirationTime = (helpCooldowns.get(message.author.id) || 0) + cooldownAmount;
 
    if (helpCooldowns.has(message.author.id) && now < expirationTime) {
        const timeLeft = expirationTime - now;
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        return message.reply(`תוכל לעשות את הפקודה הזו שוב בעוד **${minutes} דקות ו ${seconds} שניות**`);
    }
 
    helpCooldowns.set(message.author.id, now);
    setTimeout(() => helpCooldowns.delete(message.author.id), cooldownAmount);
 
    let voiceText = 'המשתמש לא נמצא בשיחה';
    if (message.member.voice.channel) {
        voiceText = `המשתמש נמצא בוויס: <#${message.member.voice.channel.id}>`;
    }
 
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('handle_help')
            .setLabel('טפל')
            .setStyle(ButtonStyle.Primary)
    );
 
    try {
        await message.channel.send({
            content: `${supportRolesText} | ${message.member}\n**צריך את עזרתכם**\n${voiceText}\n**סיבה:** \`${reason}\``,
            components: [row]
        });
    } catch (error) {
        console.error("❌ Error", error);
    }
}
