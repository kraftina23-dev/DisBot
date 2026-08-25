const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('../utils/config');
const { addReactionRole } = require('../utils/reactionRoles');
 
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
 
        // ---------- !clear - מחיקת הודעות בכמות ----------
        if (firstWord === '!clear') {
            const args = content.split(/\s+/).slice(1);
            return handleClearRequest(message, args);
        }
 
        // ---------- !rr - רול-ריאקשן (כמו קארל-בוט) ----------
        if (firstWord === '!rr') {
            const args = content.split(/\s+/).slice(1);
            if (args[0] === 'add') {
                return handleReactionRoleAdd(message, args.slice(1));
            }
            return;
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
    const eligibleTimestamp = joinedTimestamp + requiredSeconds;
 
    const BANNER_URL = veteranConfig.bannerUrl;
 
    let eligibilityText = '';
    let statusColor = 0x0099FF;
 
    if (isEligible) {
        eligibilityText = `## האם אתה זכאי לקבלת וטרן?\n**אתה זכאי לרול וטרן!**\n<@&${VETERAN_ROLE_ID}>!\n**זכאי מאז:** <t:${eligibleTimestamp}:R>`;
 
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
        eligibilityText = `## האם אתה זכאי לקבלת וטרן?\n**אתה לא זכאי עדיין לרול וטרן**\n**אתה צריך להיות בשרת מעל ל-${daysText}.**\n**תהיה זכאי:** <t:${eligibleTimestamp}:R> (<t:${eligibleTimestamp}:F>)`;
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
 
async function handleClearRequest(message, args) {
    const clearConfig = getGuildConfig(message.guild.id).clear;
    const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasAllowedRole = clearConfig.allowedRoles.some(roleId => message.member.roles.cache.has(roleId));
 
    if (!isAdmin && !hasAllowedRole) {
        return; // בלי הרשאה - מתעלמים בשקט, בלי לספאם את החדר
    }
 
    const amount = parseInt(args[0], 10);
    if (isNaN(amount) || amount <= 0 || amount > 100) {
        const warning = await message.reply('❌ יש לציין כמות תקינה בין 1 ל-100, לדוגמה: `!clear 20`');
        return setTimeout(() => warning.delete().catch(() => {}), 5000);
    }
 
    try {
        // true = מתעלם אוטומטית מהודעות ישנות מ-14 יום (מגבלת דיסקורד למחיקה מרוכזת)
        const deleted = await message.channel.bulkDelete(amount, true);
        const confirm = await message.channel.send(`🗑️ נמחקו ${deleted.size} הודעות.`);
        setTimeout(() => confirm.delete().catch(() => {}), 5000);
    } catch (err) {
        console.error('❌ שגיאה במחיקת הודעות:', err);
        message.channel.send('❌ קרתה שגיאה במחיקת ההודעות.').then(msg =>
            setTimeout(() => msg.delete().catch(() => {}), 5000)
        );
    }
}
 
async function handleReactionRoleAdd(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('⛔ רק אדמין יכול להגדיר רול-ריאקשן.');
    }
 
    const usage = '!rr add [channel] <msg_id> <emoji> <role>';
 
    function usageError(paramName) {
        const index = usage.indexOf(`<${paramName}>`) + 1;
        const pointer = ' '.repeat(index) + '^'.repeat(paramName.length);
        return `\`\`\`\n${usage}\n${pointer}\n${paramName} is a required argument that is missing.\n\`\`\``;
    }
 
    const rest = [...args];
    let targetChannel = message.channel;
 
    // בדיקה אם הפרמטר הראשון הוא חדר (תיוג או ID) - אם כן, זו אופציה, לא חובה
    if (rest.length > 0) {
        const channelMatch = rest[0].match(/^<#(\d+)>$/) || rest[0].match(/^(\d{17,20})$/);
        if (channelMatch) {
            const potentialChannel = message.guild.channels.cache.get(channelMatch[1]);
            if (potentialChannel) {
                targetChannel = potentialChannel;
                rest.shift();
            }
        }
    }
 
    const msgId = rest[0];
    if (!msgId) return message.reply(usageError('msg_id'));
 
    const emojiArg = rest[1];
    if (!emojiArg) return message.reply(usageError('emoji'));
 
    const roleArg = rest[2];
    if (!roleArg) return message.reply(usageError('role'));
 
    const targetMessage = await targetChannel.messages.fetch(msgId).catch(() => null);
    if (!targetMessage) {
        return message.reply(`❌ לא מצאתי הודעה עם ה-ID \`${msgId}\` בחדר ${targetChannel}.`);
    }
 
    const roleIdMatch = roleArg.match(/^<@&(\d+)>$/) || roleArg.match(/^(\d{17,20})$/);
    const role = roleIdMatch ? message.guild.roles.cache.get(roleIdMatch[1]) : null;
    if (!role) {
        return message.reply('❌ לא זיהיתי את הרול. יש לתייג אותו (@רול) או לתת את ה-ID שלו.');
    }
 
    // זיהוי מזהה האימוג'י - מותאם אישית (ID) או יוניקוד רגיל (התו עצמו)
    const customEmojiMatch = emojiArg.match(/^<a?:\w+:(\d+)>$/);
    const emojiKey = customEmojiMatch ? customEmojiMatch[1] : emojiArg;
 
    try {
        await targetMessage.react(emojiArg);
    } catch (err) {
        console.error('❌ שגיאה בהוספת ריאקשן להודעה:', err);
        return message.reply('❌ לא הצלחתי להוסיף את הריאקשן הזה להודעה - יש לוודא שזה אימוג׳י תקין שהבוט מכיר.');
    }
 
    addReactionRole(targetMessage.id, message.guild.id, targetChannel.id, emojiKey, role.id);
    await message.reply(`✅ הוגדר! מי שיוסיף ${emojiArg} על ${targetMessage.url} יקבל את הרול ${role}.`);
}
