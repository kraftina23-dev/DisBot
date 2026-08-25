const fs = require('fs');
const path = require('path');

const storePath = path.join(__dirname, '..', 'reactionRoles.json');

function load() {
    if (!fs.existsSync(storePath)) {
        fs.writeFileSync(storePath, JSON.stringify({ messages: {} }, null, 4));
    }
    try {
        return JSON.parse(fs.readFileSync(storePath, 'utf8'));
    } catch (err) {
        console.error('❌ reactionRoles.json פגום, נוצר קובץ חדש:', err);
        const fresh = { messages: {} };
        fs.writeFileSync(storePath, JSON.stringify(fresh, null, 4));
        return fresh;
    }
}

function save(data) {
    fs.writeFileSync(storePath, JSON.stringify(data, null, 4));
}

/**
 * מוסיף/מעדכן מיפוי אימוג'י -> רול עבור הודעה מסוימת.
 * emojiKey: מזהה ה-ID של אימוג'י מותאם אישית, או התו של אימוג'י יוניקוד רגיל.
 */
function addReactionRole(messageId, guildId, channelId, emojiKey, roleId) {
    const data = load();
    if (!data.messages[messageId]) {
        data.messages[messageId] = { guildId, channelId, roles: {} };
    }
    data.messages[messageId].roles[emojiKey] = roleId;
    save(data);
}

function getMessageConfig(messageId) {
    const data = load();
    return data.messages[messageId] || null;
}

module.exports = { addReactionRole, getMessageConfig };
