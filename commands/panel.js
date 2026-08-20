const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');
const { buildMainPanelPayload } = require('../events/interactionCreate');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('פותח את פאנל השליטה על הבוט בשרת')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.reply(buildMainPanelPayload(interaction.guild.id));
    }
};
