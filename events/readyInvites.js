const { cacheGuildInvites } = require('../utils/inviteTracker');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        for (const guild of client.guilds.cache.values()) {
            await cacheGuildInvites(guild);
        }
        console.log('📨 מטמון ההזמנות נטען לכל השרתים.');
    }
};
