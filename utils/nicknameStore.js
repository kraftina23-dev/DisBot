const fs = require('fs');
const path = require('path');

const storePath = path.join(__dirname, '..', 'nicknames.json');

function load() {
    if (!fs.existsSync(storePath)) {
        fs.writeFileSync(storePath, JSON.stringify({ guilds: {} }, null, 4));
    }
    try {
        return JSON.parse(fs.readFileSync(storePath, 'utf8'));
    } catch (err) {
        console.error('❌ nicknames.json פגום, נוצר קובץ חדש:', err);
        const fresh = { guilds: {} };
        fs.writeFileSync(storePath, JSON.stringify(fresh, null, 4));
        return fresh;
    }
}

function save(data) {
    fs.writeFileSync(storePath, JSON.stringify(data, null, 4));
}

/**
 * מחזיר את השם הבסיסי (בלי קידומות) שנשמר למשתמש, או null אם עוד לא נשמר לו כלום.
 */
function getBaseName(guildId, userId) {
    const data = load();
    return data.guilds[guildId]?.[userId] ?? null;
}

function setBaseName(guildId, userId, name) {
    const data = load();
    if (!data.guilds[guildId]) data.guilds[guildId] = {};
    data.guilds[guildId][userId] = name;
    save(data);
}

module.exports = { getBaseName, setBaseName };
