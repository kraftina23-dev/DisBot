const fs = require('fs');
const path = require('path');

const storePath = path.join(__dirname, '..', 'mutes.json');

function load() {
    if (!fs.existsSync(storePath)) {
        fs.writeFileSync(storePath, JSON.stringify({ guilds: {} }, null, 4));
    }
    try {
        return JSON.parse(fs.readFileSync(storePath, 'utf8'));
    } catch (err) {
        console.error('❌ mutes.json פגום, נוצר קובץ חדש:', err);
        const fresh = { guilds: {} };
        fs.writeFileSync(storePath, JSON.stringify(fresh, null, 4));
        return fresh;
    }
}

function save(data) {
    fs.writeFileSync(storePath, JSON.stringify(data, null, 4));
}

function ensureGuild(data, guildId) {
    if (!data.guilds[guildId]) data.guilds[guildId] = { text: {}, voice: {} };
    return data.guilds[guildId];
}

function setMute(guildId, type, userId, record) {
    const data = load();
    ensureGuild(data, guildId)[type][userId] = record;
    save(data);
}

function removeMute(guildId, type, userId) {
    const data = load();
    const g = ensureGuild(data, guildId);
    delete g[type][userId];
    save(data);
}

function getMute(guildId, type, userId) {
    const data = load();
    return data.guilds[guildId]?.[type]?.[userId] ?? null;
}

function getAllGuildsMutes() {
    const data = load();
    return data.guilds;
}

module.exports = { setMute, removeMute, getMute, getAllGuildsMutes };
