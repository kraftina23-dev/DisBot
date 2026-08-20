const fs = require('fs');
const path = require('path');

const giveawaysPath = path.join(__dirname, '..', 'giveaways.json');

function loadGiveaways() {
    if (!fs.existsSync(giveawaysPath)) {
        fs.writeFileSync(giveawaysPath, JSON.stringify({ giveaways: {} }, null, 4));
    }
    const raw = fs.readFileSync(giveawaysPath, 'utf8');
    try {
        return JSON.parse(raw);
    } catch (err) {
        console.error('❌ giveaways.json פגום, נוצר קובץ חדש:', err);
        const fresh = { giveaways: {} };
        fs.writeFileSync(giveawaysPath, JSON.stringify(fresh, null, 4));
        return fresh;
    }
}

function saveGiveaways(data) {
    fs.writeFileSync(giveawaysPath, JSON.stringify(data, null, 4));
}

function createGiveaway(giveaway) {
    const data = loadGiveaways();
    data.giveaways[giveaway.id] = giveaway;
    saveGiveaways(data);
    return giveaway;
}

function getGiveaway(id) {
    const data = loadGiveaways();
    return data.giveaways[id] || null;
}

function getAllGiveaways() {
    const data = loadGiveaways();
    return data.giveaways;
}

function updateGiveaway(id, updater) {
    const data = loadGiveaways();
    if (!data.giveaways[id]) return null;
    updater(data.giveaways[id]);
    saveGiveaways(data);
    return data.giveaways[id];
}

function deleteGiveaway(id) {
    const data = loadGiveaways();
    delete data.giveaways[id];
    saveGiveaways(data);
}

module.exports = { loadGiveaways, saveGiveaways, createGiveaway, getGiveaway, getAllGiveaways, updateGiveaway, deleteGiveaway };
