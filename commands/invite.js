const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getInviteCount, resetInvite, resetAllInvites, getAllInvites } = require('../utils/invites');
const { getGuildConfig } = require('../utils/config');

function isChannelAllowed(interaction) {
    if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
    const allowed = getGuildConfig(interaction.guild.id).invites.allowedChannels;
    if (allowed.length === 0) return true;
    return allowed.includes(interaction.channel.id);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('מערכת מעקב הזמנות')
        .addSubcommand(sub =>
            sub.setName('check')
                .setDescription('בדיקת כמות ההזמנות שלך, או של מישהו אחר')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('המשתמש לבדיקה (ברירת מחדל: אתה)')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('top')
                .setDescription('טבלת המובילים בהזמנות בשרת')
        )
        .addSubcommand(sub =>
            sub.setName('reset')
                .setDescription('איפוס כמות הזמנות - למשתמש ספציפי או לכולם (רק אדמין)')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('המשתמש לאיפוס')
                        .setRequired(false)
                )
                .addBooleanOption(opt =>
                    opt.setName('all')
                        .setDescription('לאפס לכולם בשרת (true/false)')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'reset') {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '⛔ רק אדמין יכול לאפס הזמנות.', ephemeral: true });
            }
            return handleReset(interaction);
        }

        if (!isChannelAllowed(interaction)) {
            const allowed = getGuildConfig(interaction.guild.id).invites.allowedChannels;
            return interaction.reply({
                content: `❌ אפשר להשתמש בפקודה הזו רק בחדרים הבאים: ${allowed.map(id => `<#${id}>`).join(', ')}`,
                ephemeral: true
            });
        }

        if (sub === 'check') return handleCheck(interaction);
        if (sub === 'top') return handleTop(interaction);
    }
};

async function handleCheck(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const count = getInviteCount(interaction.guild.id, targetUser.id);

    const embed = new EmbedBuilder()
        .setTitle('📨 בדיקת הזמנות')
        .setDescription(`${targetUser} הזמין/ה **${count}** אנשים לשרת.`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setColor(0x5865F2);

    await interaction.reply({ embeds: [embed] });
}

async function handleTop(interaction) {
    const all = getAllInvites(interaction.guild.id);
    const entries = Object.entries(all)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    if (entries.length === 0) {
        return interaction.reply({ content: 'אין עדיין הזמנות רשומות בשרת הזה.', ephemeral: true });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = entries.map(([userId, count], i) => `${medals[i] || `**${i + 1}.**`} <@${userId}> — ${count} הזמנות`);

    const embed = new EmbedBuilder()
        .setTitle('🏆 טבלת המובילים בהזמנות')
        .setDescription(lines.join('\n'))
        .setColor(0xF1C40F);

    await interaction.reply({ embeds: [embed] });
}

async function handleReset(interaction) {
    const targetUser = interaction.options.getUser('user');
    const all = interaction.options.getBoolean('all');

    if (!targetUser && !all) {
        return interaction.reply({ content: '❌ יש לבחור משתמש לאיפוס, או לסמן `all` כדי לאפס לכולם.', ephemeral: true });
    }
    if (targetUser && all) {
        return interaction.reply({ content: '❌ יש לבחור רק אחת מהאופציות - משתמש ספציפי, או `all`.', ephemeral: true });
    }

    if (all) {
        resetAllInvites(interaction.guild.id);
        return interaction.reply('✅ כל ההזמנות בשרת אופסו.');
    }

    resetInvite(interaction.guild.id, targetUser.id);
    return interaction.reply(`✅ ההזמנות של ${targetUser} אופסו.`);
}
