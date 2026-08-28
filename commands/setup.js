const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const { getGuildConfig, updateGuildConfig } = require('../utils/config');
const { setupTextMuteRole, setupVoiceMuteRole } = require('../utils/muteRoleSetup');
const { saveSetup } = require('../utils/tempVoiceStore');
 
module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('הגדרות התקנה עבור מערכות בבוט')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('verify')
                .setDescription('הקמת מערכת אימות עם כפתור')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('החדר בו תישלח הודעת האימות')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('הרול שיינתן לאחר לחיצה על הכפתור')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('mute')
                .setDescription('יצירת/עדכון רול המיוט לצ׳אטים, וחסימתו מלכתוב בכל החדרים')
        )
        .addSubcommand(sub =>
            sub.setName('vmute')
                .setDescription('יצירת/עדכון רול השתקת הקול, וחסימתו מלדבר בכל חדרי הקול')
        )
        .addSubcommand(sub =>
            sub.setName('tempvoice')
                .setDescription('הקמת מערכת חדרי קול זמניים (TempVoice) - קטגוריה, חדר יצירה, וחדר בקרה')
        ),
 
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        if (sub === 'verify') return handleSetupVerify(interaction);
        if (sub === 'mute') return handleSetupMute(interaction);
        if (sub === 'vmute') return handleSetupVmute(interaction);
        if (sub === 'tempvoice') return handleSetupTempVoice(interaction);
    }
};
 
async function handleSetupVerify(interaction) {
    const channel = interaction.options.getChannel('channel');
    const role = interaction.options.getRole('role');
 
    const botMember = interaction.guild.members.me;
    if (role.position >= botMember.roles.highest.position) {
        return interaction.reply({
            content: `❌ אני לא יכול לתת את הרול ${role} כי הוא גבוה מדי בהיררכיה של הרולים שלי. יש להעביר את הרול של הבוט למעלה יותר, או לבחור רול נמוך יותר.`,
            ephemeral: true
        });
    }
 
    const embed = new EmbedBuilder()
        .setTitle('🔒 אימות גישה לשרת')
        .setDescription('כדי לקבל גישה מלאה לשרת ולראות את כל הערוצים, יש ללחוץ על הכפתור למטה.\n\nהתהליך אוטומטי ולוקח שנייה אחת.')
        .setColor(0x57F287)
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setTimestamp();
 
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`verify_role_${role.id}`)
            .setLabel('אימות')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success)
    );
 
    try {
        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ הודעת האימות נשלחה ל-${channel}. הרול שיינתן בלחיצה: ${role}`, ephemeral: true });
    } catch (err) {
        console.error('❌ שגיאה בשליחת הודעת אימות:', err);
        await interaction.reply({ content: '❌ לא הצלחתי לשלוח הודעה לחדר הזה. יש לוודא שיש לבוט הרשאת שליחת הודעות שם.', ephemeral: true });
    }
}
 
async function handleSetupMute(interaction) {
    await interaction.deferReply({ ephemeral: true });
 
    const config = getGuildConfig(interaction.guild.id).moderation;
 
    try {
        const role = await setupTextMuteRole(interaction.guild, config.muteRoleId);
        updateGuildConfig(interaction.guild.id, cfg => { cfg.moderation.muteRoleId = role.id; });
        await interaction.editReply(`✅ רול המיוט (${role}) מוכן - הוא חסום מלשלוח הודעות בכל חדרי הטקסט בשרת. כל חדר חדש שייווצר בעתיד ייחסם אוטומטית גם הוא.`);
    } catch (err) {
        console.error('❌ שגיאה ב-/setup mute:', err);
        await interaction.editReply('❌ קרתה שגיאה בהקמת רול המיוט. יש לוודא שיש לבוט הרשאת Manage Roles ו-Manage Channels.');
    }
}
 
async function handleSetupVmute(interaction) {
    await interaction.deferReply({ ephemeral: true });
 
    const config = getGuildConfig(interaction.guild.id).moderation;
 
    try {
        const role = await setupVoiceMuteRole(interaction.guild, config.vmuteRoleId);
        updateGuildConfig(interaction.guild.id, cfg => { cfg.moderation.vmuteRoleId = role.id; });
        await interaction.editReply(`✅ רול השתקת הקול (${role}) מוכן - הוא חסום מלדבר בכל חדרי הקול בשרת. כל חדר קול חדש שייווצר בעתיד ייחסם אוטומטית גם הוא.`);
    } catch (err) {
        console.error('❌ שגיאה ב-/setup vmute:', err);
        await interaction.editReply('❌ קרתה שגיאה בהקמת רול השתקת הקול. יש לוודא שיש לבוט הרשאת Manage Roles ו-Manage Channels.');
    }
}
 
async function handleSetupTempVoice(interaction) {
    await interaction.deferReply({ ephemeral: true });
 
    const guild = interaction.guild;
    const everyone = guild.roles.everyone;
 
    try {
        const category = await guild.channels.create({
            name: 'Temp Voice',
            type: ChannelType.GuildCategory
        });
 
        const createChannel = await guild.channels.create({
            name: '🎙️・Create Voice',
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: everyone.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
                    deny: [PermissionFlagsBits.SendMessages]
                }
            ]
        });
 
        const controllerChannel = await guild.channels.create({
            name: '📋・Voice Controller',
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: everyone.id,
                    allow: [PermissionFlagsBits.ViewChannel],
                    deny: [PermissionFlagsBits.SendMessages]
                }
            ]
        });
 
        saveSetup(guild.id, {
            categoryId: category.id,
            createChannelId: createChannel.id,
            controllerChannelId: controllerChannel.id
        });
 
        await sendTempVoiceControllerMessage(controllerChannel);
 
        await interaction.editReply(`✅ מערכת TempVoice הוקמה!\nקטגוריה: **${category.name}**\nחדר יצירה: ${createChannel}\nחדר בקרה: ${controllerChannel}`);
    } catch (err) {
        console.error('❌ שגיאה בהקמת TempVoice:', err);
        await interaction.editReply('❌ קרתה שגיאה בהקמת המערכת. יש לוודא שיש לבוט הרשאת Manage Channels.');
    }
}
 
async function sendTempVoiceControllerMessage(channel) {
    const embed = new EmbedBuilder()
        .setTitle('TempVoice Interface')
        .setDescription('הממשק הזה משמש לניהול חדר הקול הזמני שלך.\nיש להיכנס קודם לחדר שלך, ואז ללחוץ על הכפתורים למטה.\nרק הבעלים של החדר יכול להשתמש בכפתורים (חוץ מ-CLAIM, שפתוח לכולם).')
        .setColor(0x2B2D31);
 
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tempvoice_name').setLabel('שם').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tempvoice_limit').setLabel('הגבלה').setEmoji('👥').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tempvoice_privacy').setLabel('פרטיות').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tempvoice_chat').setLabel('צ׳אט').setEmoji('💬').setStyle(ButtonStyle.Secondary)
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tempvoice_trust').setLabel('אמון').setEmoji('🤝').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tempvoice_untrust').setLabel('הסר אמון').setEmoji('🚷').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tempvoice_invite').setLabel('הזמנה').setEmoji('📨').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tempvoice_kick').setLabel('ניתוק').setEmoji('📵').setStyle(ButtonStyle.Secondary)
    );
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tempvoice_block').setLabel('חסימה').setEmoji('🚫').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tempvoice_unblock').setLabel('הסר חסימה').setEmoji('♻️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tempvoice_claim').setLabel('תפיסה').setEmoji('👑').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tempvoice_transfer').setLabel('העברה').setEmoji('🔁').setStyle(ButtonStyle.Secondary)
    );
 
    await channel.send({ embeds: [embed], components: [row1, row2, row3] });
}
 