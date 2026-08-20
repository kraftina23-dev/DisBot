const { addInvite } = require('./invites');

// guildId -> Map<inviteCode, uses>
const inviteCache = new Map();

/**
 * טוען מחדש למטמון את כל ההזמנות של שרת מסוים.
 * צריך שלבוט תהיה הרשאת Manage Server בשרת, אחרת השליפה תיכשל (וזה נתפס בשקט).
 */
async function cacheGuildInvites(guild) {
    try {
        const invites = await guild.invites.fetch();
        const usesMap = new Map();
        invites.forEach(inv => usesMap.set(inv.code, inv.uses));
        inviteCache.set(guild.id, usesMap);
    } catch (err) {
        console.error(`❌ לא הצלחתי לטעון הזמנות עבור שרת "${guild.name}" (יש לוודא שלבוט יש הרשאת Manage Server):`, err.message);
    }
}

/**
 * נקרא כשמישהו מצטרף לשרת. משווה את כמות השימושים הנוכחית מול המטמון,
 * מזהה איזו הזמנה השתמשו בה, מזכה את המזמין, ומעדכן את המטמון.
 * מחזיר את ה-User שהזמין, או null אם לא הצלחנו לזהות (למשל וניטי URL).
 */
async function trackInviteUse(member) {
    const guild = member.guild;

    let newInvites;
    try {
        newInvites = await guild.invites.fetch();
    } catch (err) {
        console.error('❌ לא הצלחתי לרענן הזמנות לצורך זיהוי המזמין:', err.message);
        return null;
    }

    const oldUses = inviteCache.get(guild.id) || new Map();
    const usedInvite = newInvites.find(inv => (oldUses.get(inv.code) ?? 0) < inv.uses);

    // מעדכנים את המטמון למצב העדכני בכל מקרה, כדי שהשוואה הבאה תהיה נכונה
    const usesMap = new Map();
    newInvites.forEach(inv => usesMap.set(inv.code, inv.uses));
    inviteCache.set(guild.id, usesMap);

    if (!usedInvite || !usedInvite.inviter) return null;

    addInvite(guild.id, usedInvite.inviter.id, 1);
    return usedInvite.inviter;
}

module.exports = { cacheGuildInvites, trackInviteUse };
