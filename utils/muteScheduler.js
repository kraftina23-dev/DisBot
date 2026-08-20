const { getGuildConfig } = require('./config');
const { removeMute, getAllGuildsMutes } = require('./muteStore');

const MAX_TIMEOUT_MS = 2_147_483_647; // מגבלת setTimeout של Node (~24.8 ימים)

async function performUnmute(client, guildId, type, userId) {
    try {
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return;

        const member = await guild.members.fetch(userId).catch(() => null);
        const config = getGuildConfig(guildId).moderation;
        const roleId = type === 'text' ? config.muteRoleId : config.vmuteRoleId;

        if (member && roleId && member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId).catch(err =>
                console.error('❌ שגיאה בהסרת רול מיוט אוטומטית:', err.message)
            );
        }
    } finally {
        removeMute(guildId, type, userId);
    }
}

/**
 * מתזמן טיימר מדויק להסרת מיוט ברגע שהזמן נגמר - בלי דיליי.
 */
function scheduleAutoUnmute(client, guildId, type, userId, expiresAt) {
    if (!expiresAt) return; // מיוט קבוע - לא מתזמנים כלום, יורד רק ידנית

    const remaining = expiresAt - Date.now();

    if (remaining <= 0) {
        performUnmute(client, guildId, type, userId);
        return;
    }
    if (remaining > MAX_TIMEOUT_MS) return; // הרשת ביטחון התקופתית תתפוס את זה בהמשך

    setTimeout(() => performUnmute(client, guildId, type, userId), remaining);
}

let schedulerStarted = false;
function startMuteScheduler(client) {
    if (schedulerStarted) return;
    schedulerStarted = true;

    // תזמון מיידי לכל המיוטים הקיימים - חשוב במיוחד אחרי הפעלה מחדש של הבוט
    const allGuilds = getAllGuildsMutes();
    for (const [guildId, types] of Object.entries(allGuilds)) {
        for (const type of ['text', 'voice']) {
            for (const [userId, record] of Object.entries(types[type] || {})) {
                scheduleAutoUnmute(client, guildId, type, userId, record.expiresAt);
            }
        }
    }

    // רשת ביטחון - בודקת כל 30 שניות אם משהו נשמט מהטיימרים
    setInterval(() => {
        const currentGuilds = getAllGuildsMutes();
        const now = Date.now();
        for (const [guildId, types] of Object.entries(currentGuilds)) {
            for (const type of ['text', 'voice']) {
                for (const [userId, record] of Object.entries(types[type] || {})) {
                    if (record.expiresAt && record.expiresAt <= now) {
                        performUnmute(client, guildId, type, userId);
                    }
                }
            }
        }
    }, 30_000);

    console.log('🔇 מתזמן המיוטים הופעל.');
}

module.exports = { scheduleAutoUnmute, startMuteScheduler, performUnmute };
