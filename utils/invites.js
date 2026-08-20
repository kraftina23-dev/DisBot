const fs = require('fs');
const path = require('path');

const storePath = path.join(__dirname, '..', 'invites.json');

function load() {
    if (!fs.existsSync(storePath)) {
        fs.writeFileSync(storePath, JSON.stringify({ guilds: {} }, null, 4));
    }
    try {
        return JSON.parse(fs.readFileSync(storePath, 'utf8'));
    } catch (err) {
        console.error('❌ invites.json פגום, נוצר קובץ חדש:', err);
        const fresh = { guilds: {} };
        fs.writeFileSync(storePath, JSON.stringify(fresh, null, 4));
        return fresh;
    }
}

function save(data) {
    fs.writeFileSync(storePath, JSON.stringify(data, null, 4));
}

function getInviteCount(guildId, userId) {
    const data = load();
    return data.guilds[guildId]?.[userId] ?? 0;
}

function addInvite(guildId, userId, amount = 1) {
    const data = load();
    if (!data.guilds[guildId]) data.guilds[guildId] = {};
    data.guilds[guildId][userId] = (data.guilds[guildId][userId] || 0) + amount;
    save(data);
    return data.guilds[guildId][userId];
}

function resetInvite(guildId, userId) {
    const data = load();
    if (data.guilds[guildId]) delete data.guilds[guildId][userId];
    save(data);
}

function resetAllInvites(guildId) {
    const data = load();
    data.guilds[guildId] = {};
    save(data);
}

function getAllInvites(guildId) {
    const data = load();
    return data.guilds[guildId] || {};
}

module.exports = { getInviteCount, addInvite, resetInvite, resetAllInvites, getAllInvites };
