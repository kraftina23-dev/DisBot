const { applyNicknameForMember } = require('../utils/nicknameEngine');

module.exports = {
    name: 'guildMemberUpdate',
    async execute(oldMember, newMember) {
        // מפעילים את המערכת רק כשהרולים באמת השתנו - כדי למנוע לולאה אינסופית
        // (שינוי כינוי בעצמו גם מייצר אירוע guildMemberUpdate, אז אסור להגיב לכל שינוי)
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;

        const rolesChanged = oldRoles.size !== newRoles.size || !oldRoles.every((_, id) => newRoles.has(id));
        if (!rolesChanged) return;

        try {
            await applyNicknameForMember(newMember);
        } catch (err) {
            console.error('❌ שגיאה במערכת שינוי השם האוטומטי:', err);
        }
    }
};
