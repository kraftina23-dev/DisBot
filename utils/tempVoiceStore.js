const fs = require('fs');
const path = require('path');

const storePath = path.join(__dirname, '..', 'tempvoice.json');

function load() {
    if (!fs.existsSync(storePath)) {
        fs.writeFileSync(storePath, JSON.stringify({ guilds: {} }, null, 4));
    }
    try {
        return JSON.parse(fs.readFileSync(storePath, 'utf8'));
    } catch (err) {
        console.error('❌ tempvoice.json פגום, נוצר קובץ חדש:', err);
        const fresh = { guilds: {} };
        fs.writeFileSync(storePath, JSON.stringify(fresh, null, 4));
        return fresh;
    }
}

function save(data) {
    fs.writeFileSync(storePath, JSON.stringify(data, null, 4));
}

function ensureGuild(data, guildId) {
    if (!data.guilds[guildId]) {
        data.guilds[guildId] = {
            categoryId: null,
            createChannelId: null,
            controllerChannelId: null,
            waitingChannelId: null,
            activeChannels: {}, // channelId -> ownerId
            userSettings: {} // userId -> העדפות שמורות (ראה DEFAULT_USER_SETTINGS)
        };
    }
    return data.guilds[guildId];
}

function getSetup(guildId) {
    const data = load();
    return data.guilds[guildId] || null;
}

function saveSetup(guildId, { categoryId, createChannelId, controllerChannelId, waitingChannelId }) {
    const data = load();
    const g = ensureGuild(data, guildId);
    g.categoryId = categoryId;
    g.createChannelId = createChannelId;
    g.controllerChannelId = controllerChannelId;
    g.waitingChannelId = waitingChannelId;
    save(data);
}

function registerChannel(guildId, channelId, ownerId) {
    const data = load();
    ensureGuild(data, guildId).activeChannels[channelId] = ownerId;
    save(data);
}

function unregisterChannel(guildId, channelId) {
    const data = load();
    delete ensureGuild(data, guildId).activeChannels[channelId];
    save(data);
}

function getOwnerOfChannel(guildId, channelId) {
    const data = load();
    return data.guilds[guildId]?.activeChannels?.[channelId] ?? null;
}

function getChannelOfOwner(guildId, ownerId) {
    const data = load();
    const active = data.guilds[guildId]?.activeChannels || {};
    for (const [channelId, oId] of Object.entries(active)) {
        if (oId === ownerId) return channelId;
    }
    return null;
}

function transferOwnership(guildId, channelId, newOwnerId) {
    const data = load();
    ensureGuild(data, guildId).activeChannels[channelId] = newOwnerId;
    save(data);
}

const DEFAULT_USER_SETTINGS = () => ({
    name: null,
    limit: 0,
    locked: false,
    chatLocked: false,
    waitingRoom: false,
    trustedUserIds: [],
    blockedUserIds: []
});

function getUserSettings(guildId, userId) {
    const data = load();
    const g = ensureGuild(data, guildId);
    if (!g.userSettings[userId]) {
        g.userSettings[userId] = DEFAULT_USER_SETTINGS();
        save(data);
    }
    return g.userSettings[userId];
}

function updateUserSettings(guildId, userId, updater) {
    const data = load();
    const g = ensureGuild(data, guildId);
    if (!g.userSettings[userId]) g.userSettings[userId] = DEFAULT_USER_SETTINGS();
    updater(g.userSettings[userId]);
    save(data);
    return g.userSettings[userId];
}

module.exports = {
    getSetup, saveSetup,
    registerChannel, unregisterChannel, getOwnerOfChannel, getChannelOfOwner, transferOwnership,
    getUserSettings, updateUserSettings
};
