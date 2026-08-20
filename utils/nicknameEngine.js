const { getGuildConfig } = require('./config');
const { getBaseName, setBaseName } = require('./nicknameStore');

const NICKNAME_MAX_LENGTH = 32; // מגבלת דיסקורד לכינוי בשרת

async function trySetNickname(member, nickname) {
    const trimmed = nickname.slice(0, NICKNAME_MAX_LENGTH);
    const currentDisplay = member.nickname ?? member.user.username;
    if (currentDisplay === trimmed) return; // כבר ככה, אין צורך לשנות

    try {
        await member.setNickname(trimmed);
    } catch (err) {
        // קורה בעיקר אם לחבר יש רול גבוה מהבוט, או שלבוט חסרה הרשאת Manage Nicknames
        console.error(`❌ לא הצלחתי לשנות שם ל-${member.user.tag}:`, err.message);
    }
}

/**
 * בודק את הרולים המוגדרים במערכת שינוי השם עבור חבר מסוים, ומעדכן את הכינוי שלו בהתאם.
 * - בוחר את הפורמט של הרול הכי גבוה (לפי מיקום הרול בהיררכיית השרת) מבין הרולים המוגדרים שיש לו.
 * - אם אין לו אף רול מוגדר - מאפס לשם הבסיסי המקורי (אם היה שמור כזה).
 */
async function applyNicknameForMember(member) {
    if (!member || member.user?.bot) return;

    const rules = getGuildConfig(member.guild.id).nickname.rules; // { roleId: 'תבנית עם {name} אופציונלי' }
    const matchedRoleIds = Object.keys(rules).filter(roleId => member.roles.cache.has(roleId));

    if (matchedRoleIds.length === 0) {
        const baseName = getBaseName(member.guild.id, member.id);
        if (baseName !== null) {
            await trySetNickname(member, baseName);
        }
        return;
    }

    // בוחרים את הרול עם המיקום הגבוה ביותר בהיררכיית הרולים של השרת
    matchedRoleIds.sort((a, b) => {
        const roleA = member.guild.roles.cache.get(a);
        const roleB = member.guild.roles.cache.get(b);
        return (roleB?.position ?? -1) - (roleA?.position ?? -1);
    });

    const template = rules[matchedRoleIds[0]];

    // השם הבסיסי נשמר פעם אחת בלבד - כדי שלא "נבלע" קידומות אחת בתוך השנייה בשינויים חוזרים
    let baseName = getBaseName(member.guild.id, member.id);
    if (baseName === null) {
        baseName = member.nickname || member.user.globalName || member.user.username;
        setBaseName(member.guild.id, member.id, baseName);
    }

    const newNickname = template.includes('{name}')
        ? template.replace('{name}', baseName)
        : template;

    await trySetNickname(member, newNickname);
}

/**
 * מפעיל מחדש את מערכת שינוי השם על כל מי שמחזיק כרגע רול מסוים.
 * שימושי מייד אחרי שמגדירים/מסירים כלל, כדי שהעדכון יחול על כולם ולא רק על שינויי רול עתידיים.
 */
async function reapplyForRoleHolders(guild, roleId) {
    try {
        await guild.members.fetch();
    } catch (err) {
        console.error('❌ שגיאה בטעינת חברי השרת לצורך עדכון שמות:', err);
        return;
    }

    const role = guild.roles.cache.get(roleId);
    if (!role) return;

    for (const member of role.members.values()) {
        await applyNicknameForMember(member);
    }
}

module.exports = { applyNicknameForMember, reapplyForRoleHolders };
