const { cacheGuildInvites } = require('../utils/inviteTracker');

module.exports = {
    name: 'guildCreate',
    async execute(guild) {
        await cacheGuildInvites(guild);
    }
};
