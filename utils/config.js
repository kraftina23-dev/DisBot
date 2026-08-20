const fs = require('fs');
const path = require('path');
 
// שים לב: הנתיב מניח שהתיקייה utils/ נמצאת ברמה אחת מתחת לשורש הפרויקט
// (כלומר config.json נמצא ב-root של הבוט). אם המבנה שלך שונה - תעדכן את הנתיב.
const configPath = path.join(__dirname, '..', 'config.json');
 
const DEFAULT_GUILD_CONFIG = {
    veteran: {
        roleId: null,
        requiredDays: 365,
        allowedChannels: [], // מערך ריק = מותר בכל חדר
        bannerUrl: 'https://media.discordapp.net/attachments/1521175085585797300/1524413914442367086/file_00000000d280720a89156b9c7e2fb073.png?ex=6a4fa897&is=6a4e5717&hm=953b88b514b40d582f6c4054d233a954e53f53e2aaa545c49c8553fc2f974af3&=&format=webp&quality=lossless&width=1632&height=653'
    },
    welcome: {
        channelId: null
    },
    help: {
        roleIds: [], // עד שני רולי צוות/תמיכה שיתויגו בפקודת !h
        cooldownMs: 300000, // קולדאון בין שימושים, במילישניות (300000 = 5 דקות)
        allowedChannels: [] // מערך ריק = מותר בכל חדר
    },
    nickname: {
        rules: {} // { roleId: 'תבנית עם {name} אופציונלי', ... }
    },
    invites: {
        allowedChannels: [] // עד 5 חדרים, מערך ריק = מותר בכל חדר (לא חל על בעלי הרשאת Administrator)
    },
    moderation: {
        muteRoleId: null, // נוצר/מוגדר דרך /setup mute
        vmuteRoleId: null, // נוצר/מוגדר דרך /setup vmute
        allowedRoles: [], // מי שמחזיק אחד מהרולים האלה יכול להשתמש ב-mute/unmute/vmute/unvmute. ריק = רק Administrator
        allowedChannels: [] // עד 5 חדרים בהם ניתן להשתמש בפקודות המודרציה. ריק = מותר בכל חדר
    }
};
 
function loadConfig() {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({ guilds: {} }, null, 4));
    }
    const raw = fs.readFileSync(configPath, 'utf8');
    try {
        return JSON.parse(raw);
    } catch (err) {
        console.error('❌ config.json פגום, נוצר קובץ חדש:', err);
        const fresh = { guilds: {} };
        fs.writeFileSync(configPath, JSON.stringify(fresh, null, 4));
        return fresh;
    }
}
 
function saveConfig(data) {
    fs.writeFileSync(configPath, JSON.stringify(data, null, 4));
}
 
/**
 * מחזיר את ההגדרות של שרת מסוים. יוצר ברירת מחדל אם לא קיימות,
 * וממזג אוטומטית מקטעי הגדרות חדשים (כמו help) לשרתים שכבר היו קיימים בקובץ.
 */
function getGuildConfig(guildId) {
    const data = loadConfig();
 
    if (!data.guilds[guildId]) {
        data.guilds[guildId] = JSON.parse(JSON.stringify(DEFAULT_GUILD_CONFIG));
        saveConfig(data);
        return data.guilds[guildId];
    }
 
    let changed = false;
    for (const key of Object.keys(DEFAULT_GUILD_CONFIG)) {
        if (!data.guilds[guildId][key]) {
            data.guilds[guildId][key] = JSON.parse(JSON.stringify(DEFAULT_GUILD_CONFIG[key]));
            changed = true;
        }
    }
 
    // מיגרציה: מי שהגדיר בעבר רול צוות יחיד (help.roleId) - מעבירים אותו למערך החדש help.roleIds
    if (data.guilds[guildId].help && data.guilds[guildId].help.roleId && (!data.guilds[guildId].help.roleIds || data.guilds[guildId].help.roleIds.length === 0)) {
        data.guilds[guildId].help.roleIds = [data.guilds[guildId].help.roleId];
        delete data.guilds[guildId].help.roleId;
        changed = true;
    }
 
    // מיגרציה: הוספת שדות חדשים למקטע help שכבר קיים אצל שרתים ישנים, בלי לדרוס מה שכבר הוגדר
    if (data.guilds[guildId].help && data.guilds[guildId].help.allowedChannels === undefined) {
        data.guilds[guildId].help.allowedChannels = [];
        changed = true;
    }
 
    if (changed) saveConfig(data);
 
    return data.guilds[guildId];
}
 
/**
 * מעדכן את ההגדרות של שרת מסוים דרך פונקציית updater שמקבלת את האובייקט ומשנה אותו ישירות.
 * לדוגמה: updateGuildConfig(guildId, cfg => { cfg.veteran.roleId = '123'; });
 */
function updateGuildConfig(guildId, updater) {
    const data = loadConfig();
    if (!data.guilds[guildId]) {
        data.guilds[guildId] = JSON.parse(JSON.stringify(DEFAULT_GUILD_CONFIG));
    }
    updater(data.guilds[guildId]);
    saveConfig(data);
    return data.guilds[guildId];
}
 
module.exports = { loadConfig, saveConfig, getGuildConfig, updateGuildConfig };
 