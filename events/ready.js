const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const cooldowns = new Map();

module.exports = {
    name: 'h',
    async execute(message, args) {
        const targetChannelId = '1183728017365815351'; 
        const supportRole = '1183728016812167202';
        const cooldownAmount = 90000;

        if (message.channel.id !== targetChannelId) {
            return message.reply(`הפקודה עובדת רק בחדר: <#${targetChannelId}>`);
        }

        const rawReason = args.join(' ');
        if (rawReason.includes('@everyone') || rawReason.includes('@')) {
            return; 
        }

        const reason = (!rawReason || rawReason.trim() === "") ? "לא צוינה סיבה" : rawReason;

        const now = Date.now();
        const expirationTime = (cooldowns.get(message.author.id) || 0) + cooldownAmount;

        if (cooldowns.has(message.author.id) && now < expirationTime) {
            const timeLeft = expirationTime - now;
            const minutes = Math.floor(timeLeft / 60000);
            const seconds = Math.floor((timeLeft % 60000) / 1000);
            return message.reply(`תוכל לעשות את הפקודה הזו שוב בעוד **${minutes} דקות ו ${seconds} שניות**`);
        }

        cooldowns.set(message.author.id, now);
        setTimeout(() => cooldowns.delete(message.author.id), cooldownAmount);

        let voiceText = 'המשתמש לא נמצא בשיחה';
        if (message.member.voice.channel) {
            voiceText = `המשתמש נמצא בוויס: <#${message.member.voice.channel.id}>`;
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('handle_help')
                .setLabel('טפל')
                .setStyle(ButtonStyle.Primary)
        );

        try {
            await message.channel.send({
                content: `<@&${supportRole}> | ${message.member}\n**צריך את עזרתכם <a:emoji_1:1520537310800773241>**\n${voiceText}\n**סיבה:** \`${reason}\`<a:emoji_1:1520537238931509294>`,
                components: [row]
            });
        } catch (error) {
            console.error("Error", error);
        }
    }
};