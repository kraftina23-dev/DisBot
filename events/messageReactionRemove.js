const { getMessageConfig } = require('../utils/reactionRoles');

function emojiKeyFromReaction(reaction) {
    return reaction.emoji.id || reaction.emoji.name;
}

module.exports = {
    name: 'messageReactionRemove',
    async execute(reaction, user) {
        if (user.bot) return;

        try {
            if (reaction.partial) await reaction.fetch();
            if (reaction.message.partial) await reaction.message.fetch();
        } catch (err) {
            console.error('❌ שגיאה בטעינת ריאקשן חלקי:', err);
            return;
        }

        const config = getMessageConfig(reaction.message.id);
        if (!config) return;

        const roleId = config.roles[emojiKeyFromReaction(reaction)];
        if (!roleId) return;

        try {
            const member = await reaction.message.guild.members.fetch(user.id);
            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(roleId);
            }
        } catch (err) {
            console.error('❌ שגיאה בהסרת רול-ריאקשן:', err);
        }
    }
};
