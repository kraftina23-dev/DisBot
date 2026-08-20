const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    RoleSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');
const { getGuildConfig, updateGuildConfig } = require('../utils/config');
const { getGiveaway, updateGiveaway } = require('../utils/giveaways');
const { startGiveawayScheduler } = require('../utils/giveawayScheduler');
const { startMuteScheduler } = require('../utils/muteScheduler');
const { reapplyForRoleHolders } = require('../utils/nicknameEngine');
 
// כל ה-customId-ים ששייכים לפאנל (משמש לבדיקת הרשאות)
const PANEL_PREFIXES = ['panel_', 'veteran_', 'select_', 'modal_', 'help_'];
 
module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // מפעיל את מתזמן ההגרלות פעם אחת - בטוח לקרוא כמה פעמים
        startGiveawayScheduler(interaction.client);
        startMuteScheduler(interaction.client);
 
        try {
            await handleInteraction(interaction);
        } catch (err) {
            console.error('❌ שגיאה לא צפויה ב-interactionCreate:', err);
            try {
                if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ קרתה שגיאה. נסה שוב.', ephemeral: true });
                }
            } catch (innerErr) {
                console.error('❌ גם שליחת הודעת השגיאה נכשלה:', innerErr);
            }
        }
    }
};
 
async function handleInteraction(interaction) {
        // ---------- הרצת פקודות Slash ----------
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                await command.execute(interaction);
            } catch (err) {
                console.error(err);
                const payload = { content: '❌ קרתה שגיאה בהרצת הפקודה.', ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(payload);
                } else {
                    await interaction.reply(payload);
                }
            }
            return;
        }
 
        // ---------- הצעות אוטומטיות (autocomplete) תוך כדי הקלדה ----------
        if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command || !command.autocomplete) return;
            try {
                await command.autocomplete(interaction);
            } catch (err) {
                console.error('❌ שגיאה ב-autocomplete:', err);
            }
            return;
        }
 
        if (!interaction.guild || !interaction.customId) return;
 
        // אם כבר ענו לאינטראקציה הזו (למשל בגלל מאזין כפול) - לא מנסים שוב
        if (interaction.replied || interaction.deferred) {
            console.warn(`⚠️ אינטראקציה ${interaction.customId} כבר טופלה קודם - כנראה יש מאזין כפול ל-interactionCreate. בדוק כפילות קבצים בתיקיית events.`);
            return;
        }
 
        // ---------- הצטרפות להגרלה (פתוח לכולם - לא רק לבעלי הרשאות) ----------
        if (interaction.isButton() && interaction.customId.startsWith('giveaway_join_')) {
            return handleGiveawayJoin(interaction);
        }
 
        // ---------- לחיצה על כפתור אימות (פתוח לכולם) ----------
        if (interaction.isButton() && interaction.customId.startsWith('verify_role_')) {
            return handleVerifyClick(interaction);
        }
 
        // ---------- לחיצה על "טפל" בקריאת עזרה (!h) - רק לאדמין או צוות ----------
        if (interaction.isButton() && interaction.customId === 'handle_help') {
            const helpConfig = getGuildConfig(interaction.guild.id).help;
            const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
            const hasStaffRole = helpConfig.roleIds.some(id => interaction.member.roles.cache.has(id));
 
            if (!isAdmin && !hasStaffRole) {
                return interaction.reply({ content: '⛔ אתה לא צוות', ephemeral: true });
            }
 
            const handledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('handle_help_taken')
                    .setLabel(`✅ מטופל ע"י ${interaction.user.username}`)
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true)
            );
            return interaction.update({ components: [handledRow] });
        }
 
        // ---------- הרשאות לכל מה ששייך לפאנל ----------
        const isPanelInteraction = PANEL_PREFIXES.some(prefix => interaction.customId.startsWith(prefix));
        if (isPanelInteraction && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            if (interaction.isRepliable()) {
                await interaction.reply({ content: '⛔ אין לך הרשאה להשתמש בפאנל הזה (נדרש Manage Server).', ephemeral: true });
            }
            return;
        }
 
        // ---------- כפתורים ----------
        if (interaction.isButton()) {
            switch (interaction.customId) {
                case 'panel_back':
                    return interaction.update(buildMainPanelPayload(interaction.guild.id));
            }
        }
 
        // ---------- בחירת פעולה במסך התמיכה ----------
        if (interaction.isStringSelectMenu() && interaction.customId === 'select_help_action') {
            const action = interaction.values[0];
 
            if (action === 'set_role') {
                const row = new ActionRowBuilder().addComponents(
                    new RoleSelectMenuBuilder()
                        .setCustomId('select_help_role')
                        .setPlaceholder('בחר עד 2 רולי צוות/תמיכה')
                        .setMinValues(1)
                        .setMaxValues(2)
                );
                return interaction.reply({ content: 'בחר עד 2 רולים שיתויגו בפקודת `!h`:', components: [row], ephemeral: true });
            }
 
            if (action === 'set_cooldown') {
                const modal = new ModalBuilder().setCustomId('modal_help_cooldown_custom').setTitle('הגדרת קולדאון ל-!h');
                const input = new TextInputBuilder()
                    .setCustomId('cooldown_seconds')
                    .setLabel('כמות שניות בין שימושים')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('לדוגמה: 300 (5 דקות)')
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return interaction.showModal(modal);
            }
 
            if (action === 'set_channels') {
                const row = new ActionRowBuilder().addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId('select_help_channels')
                        .setPlaceholder('בחר חדרים בהם !h תעבוד (עד 10)')
                        .setChannelTypes(ChannelType.GuildText)
                        .setMinValues(1)
                        .setMaxValues(10)
                );
                return interaction.reply({ content: 'בחר את החדרים בהם ניתן להשתמש בפקודת `!h`:', components: [row], ephemeral: true });
            }
 
            if (action === 'clear_channels') {
                updateGuildConfig(interaction.guild.id, cfg => { cfg.help.allowedChannels = []; });
                return interaction.update(buildHelpPanelPayload(interaction.guild.id));
            }
        }
 
        // ---------- בחירת פעולה במסך מערכת שינוי השם ----------
        if (interaction.isStringSelectMenu() && interaction.customId === 'select_nickname_action') {
            const action = interaction.values[0];
 
            if (action === 'set_role') {
                const row = new ActionRowBuilder().addComponents(
                    new RoleSelectMenuBuilder()
                        .setCustomId('select_nickname_role_target')
                        .setPlaceholder('בחר את הרול להגדרה')
                );
                return interaction.reply({ content: 'בחר את הרול שברצונך להגדיר לו שינוי שם אוטומטי:', components: [row], ephemeral: true });
            }
 
            if (action === 'remove_role') {
                const row = new ActionRowBuilder().addComponents(
                    new RoleSelectMenuBuilder()
                        .setCustomId('select_nickname_remove_role')
                        .setPlaceholder('בחר את הרול להסרה מהמערכת')
                );
                return interaction.reply({ content: 'בחר את הרול שברצונך להסיר ממערכת שינוי השם:', components: [row], ephemeral: true });
            }
 
            if (action === 'view_roles') {
                const nicknameConfig = getGuildConfig(interaction.guild.id).nickname;
                const entries = Object.entries(nicknameConfig.rules);
 
                if (entries.length === 0) {
                    return interaction.reply({ content: 'אין כרגע רולים מוגדרים במערכת שינוי השם.', ephemeral: true });
                }
 
                const sorted = entries.sort((a, b) => {
                    const roleA = interaction.guild.roles.cache.get(a[0]);
                    const roleB = interaction.guild.roles.cache.get(b[0]);
                    return (roleB?.position ?? -1) - (roleA?.position ?? -1);
                });
 
                const lines = sorted.map(([roleId, template]) => `<@&${roleId}> → \`${template}\``);
                return interaction.reply({ content: `**רולים מוגדרים במערכת שינוי השם** (מהגבוה לנמוך):\n${lines.join('\n')}`, ephemeral: true });
            }
        }
 
        // ---------- בחירת פעולה במסך ההזמנות ----------
        if (interaction.isStringSelectMenu() && interaction.customId === 'select_invites_action') {
            const action = interaction.values[0];
 
            if (action === 'set_channels') {
                const row = new ActionRowBuilder().addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId('select_invites_channels')
                        .setPlaceholder('בחר עד 5 חדרים בהם ניתן להשתמש ב-/invite')
                        .setChannelTypes(ChannelType.GuildText)
                        .setMinValues(1)
                        .setMaxValues(5)
                );
                return interaction.reply({ content: 'בחר את החדרים בהם ניתן להשתמש בפקודות `/invite` (עד 5, לא כולל אדמינים - הם יכולים בכל חדר):', components: [row], ephemeral: true });
            }
 
            if (action === 'clear_channels') {
                updateGuildConfig(interaction.guild.id, cfg => { cfg.invites.allowedChannels = []; });
                return interaction.update(buildInvitesPanelPayload(interaction.guild.id));
            }
        }
 
        // ---------- בחירת פעולה במסך המודרציה ----------
        if (interaction.isStringSelectMenu() && interaction.customId === 'select_moderation_action') {
            const action = interaction.values[0];
 
            if (action === 'set_roles') {
                const row = new ActionRowBuilder().addComponents(
                    new RoleSelectMenuBuilder()
                        .setCustomId('select_moderation_roles')
                        .setPlaceholder('בחר עד 5 רולים שמורשים לפקודות המודרציה')
                        .setMinValues(1)
                        .setMaxValues(5)
                );
                return interaction.reply({ content: 'בחר את הרולים שרשאים להשתמש ב-`/mute`, `/unmute`, `/vmute`, `/unvmute` (אדמינים תמיד רשאים בכל מקרה):', components: [row], ephemeral: true });
            }
 
            if (action === 'clear_roles') {
                updateGuildConfig(interaction.guild.id, cfg => { cfg.moderation.allowedRoles = []; });
                return interaction.update(buildModerationPanelPayload(interaction.guild.id));
            }
 
            if (action === 'set_channels') {
                const row = new ActionRowBuilder().addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId('select_moderation_channels')
                        .setPlaceholder('בחר עד 5 חדרים בהם ניתן להשתמש בפקודות המודרציה')
                        .setChannelTypes(ChannelType.GuildText)
                        .setMinValues(1)
                        .setMaxValues(5)
                );
                return interaction.reply({ content: 'בחר את החדרים בהם ניתן להשתמש בפקודות המודרציה (אדמינים פטורים מההגבלה):', components: [row], ephemeral: true });
            }
 
            if (action === 'clear_channels_mod') {
                updateGuildConfig(interaction.guild.id, cfg => { cfg.moderation.allowedChannels = []; });
                return interaction.update(buildModerationPanelPayload(interaction.guild.id));
            }
        }
 
        // ---------- בחירת פעולה במסך הוותק ----------
        if (interaction.isStringSelectMenu() && interaction.customId === 'select_veteran_action') {
            const action = interaction.values[0];
 
            switch (action) {
                case 'set_role': {
                    const row = new ActionRowBuilder().addComponents(
                        new RoleSelectMenuBuilder()
                            .setCustomId('select_veteran_role')
                            .setPlaceholder('בחר את רול הוותק')
                    );
                    return interaction.reply({ content: 'בחר את הרול שיינתן למי שעומד בדרישת הוותק:', components: [row], ephemeral: true });
                }
 
                case 'set_days': {
                    const menu = new StringSelectMenuBuilder()
                        .setCustomId('select_veteran_days')
                        .setPlaceholder('בחר כמות ימי וותק נדרשת')
                        .addOptions([
                            { label: '30 ימים', value: '30' },
                            { label: '90 ימים', value: '90' },
                            { label: '180 ימים', value: '180' },
                            { label: 'שנה (365 ימים)', value: '365' },
                            { label: 'שנתיים (730 ימים)', value: '730' },
                            { label: 'מותאם אישית...', value: 'custom' }
                        ]);
                    return interaction.reply({ content: 'בחר כמות ימים נדרשת לוותק:', components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
                }
 
                case 'set_channels': {
                    const row = new ActionRowBuilder().addComponents(
                        new ChannelSelectMenuBuilder()
                            .setCustomId('select_veteran_channels')
                            .setPlaceholder('בחר חדרים בהם הפקודה תעבוד')
                            .setChannelTypes(ChannelType.GuildText)
                            .setMinValues(1)
                            .setMaxValues(10)
                    );
                    return interaction.reply({ content: 'בחר את החדרים בהם ניתן להשתמש בפקודת `!vt` (עד 10):', components: [row], ephemeral: true });
                }
 
                case 'clear_channels':
                    updateGuildConfig(interaction.guild.id, cfg => { cfg.veteran.allowedChannels = []; });
                    return interaction.update(buildVeteranPanelPayload(interaction.guild.id));
 
                case 'set_banner': {
                    const modal = new ModalBuilder().setCustomId('modal_veteran_banner').setTitle('הגדרת באנר לבדיקת וותק');
                    const input = new TextInputBuilder()
                        .setCustomId('banner_url')
                        .setLabel('קישור לתמונת הבאנר (URL)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    return interaction.showModal(modal);
                }
 
                case 'back':
                    return interaction.update(buildMainPanelPayload(interaction.guild.id));
            }
        }
 
        // ---------- בחירת רול ----------
        if (interaction.isRoleSelectMenu() && interaction.customId === 'select_veteran_role') {
            const roleId = interaction.values[0];
            updateGuildConfig(interaction.guild.id, cfg => { cfg.veteran.roleId = roleId; });
            return interaction.update({ content: `✅ רול הוותק עודכן ל-<@&${roleId}>. חזור ל-\`/panel\` כדי לראות את המצב המעודכן.`, components: [] });
        }
 
        if (interaction.isRoleSelectMenu() && interaction.customId === 'select_help_role') {
            const roleIds = interaction.values; // עד 2 רולים
            updateGuildConfig(interaction.guild.id, cfg => { cfg.help.roleIds = roleIds; });
            return interaction.update({ content: `✅ רולי הצוות עודכנו: ${roleIds.map(id => `<@&${id}>`).join(', ')}`, components: [] });
        }
 
        if (interaction.isRoleSelectMenu() && interaction.customId === 'select_nickname_role_target') {
            const roleId = interaction.values[0];
            const modal = new ModalBuilder()
                .setCustomId(`modal_nickname_template_${roleId}`)
                .setTitle('הגדרת פורמט שינוי שם');
            const input = new TextInputBuilder()
                .setCustomId('template')
                .setLabel('פורמט השם (אפשר להשתמש ב-{name})')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('לדוגמה: HR | {name}')
                .setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }
 
        if (interaction.isRoleSelectMenu() && interaction.customId === 'select_nickname_remove_role') {
            const roleId = interaction.values[0];
            const nicknameConfig = getGuildConfig(interaction.guild.id).nickname;
 
            if (!nicknameConfig.rules[roleId]) {
                return interaction.update({ content: `⚠️ הרול <@&${roleId}> לא היה מוגדר במערכת שינוי השם.`, components: [] });
            }
 
            updateGuildConfig(interaction.guild.id, cfg => { delete cfg.nickname.rules[roleId]; });
            await interaction.update({ content: `✅ הרול <@&${roleId}> הוסר ממערכת שינוי השם. מעדכן שמות של מי שמחזיק את הרול...`, components: [] });
 
            reapplyForRoleHolders(interaction.guild, roleId).catch(err =>
                console.error('❌ שגיאה בעדכון שמות אחרי הסרת רול ממערכת שינוי השם:', err)
            );
            return;
        }
 
        if (interaction.isRoleSelectMenu() && interaction.customId === 'select_moderation_roles') {
            const roleIds = interaction.values;
            updateGuildConfig(interaction.guild.id, cfg => { cfg.moderation.allowedRoles = roleIds; });
            return interaction.update({ content: `✅ הרולים המורשים לפקודות המודרציה עודכנו: ${roleIds.map(id => `<@&${id}>`).join(', ')}`, components: [] });
        }
 
        // ---------- בחירת חדרים ----------
        if (interaction.isChannelSelectMenu()) {
            if (interaction.customId === 'select_veteran_channels') {
                const channelIds = interaction.values;
                updateGuildConfig(interaction.guild.id, cfg => { cfg.veteran.allowedChannels = channelIds; });
                return interaction.update({ content: `✅ החדרים המורשים לפקודת הוותק עודכנו: ${channelIds.map(c => `<#${c}>`).join(', ')}`, components: [] });
            }
            if (interaction.customId === 'select_welcome_channel') {
                const channelId = interaction.values[0];
                updateGuildConfig(interaction.guild.id, cfg => { cfg.welcome.channelId = channelId; });
                return interaction.update({ content: `✅ חדר הברוכים הבאים עודכן ל-<#${channelId}>`, components: [] });
            }
            if (interaction.customId === 'select_help_channels') {
                const channelIds = interaction.values;
                updateGuildConfig(interaction.guild.id, cfg => { cfg.help.allowedChannels = channelIds; });
                return interaction.update({ content: `✅ החדרים המורשים לפקודת !h עודכנו: ${channelIds.map(c => `<#${c}>`).join(', ')}`, components: [] });
            }
            if (interaction.customId === 'select_invites_channels') {
                const channelIds = interaction.values;
                updateGuildConfig(interaction.guild.id, cfg => { cfg.invites.allowedChannels = channelIds; });
                return interaction.update({ content: `✅ החדרים המורשים לפקודות /invite עודכנו: ${channelIds.map(c => `<#${c}>`).join(', ')}`, components: [] });
            }
            if (interaction.customId === 'select_moderation_channels') {
                const channelIds = interaction.values;
                updateGuildConfig(interaction.guild.id, cfg => { cfg.moderation.allowedChannels = channelIds; });
                return interaction.update({ content: `✅ החדרים המורשים לפקודות המודרציה עודכנו: ${channelIds.map(c => `<#${c}>`).join(', ')}`, components: [] });
            }
        }
 
        // ---------- בחירת מסך בפאנל הראשי ----------
        if (interaction.isStringSelectMenu() && interaction.customId === 'select_panel_section') {
            const section = interaction.values[0];
            if (section === 'veteran') {
                return interaction.update(buildVeteranPanelPayload(interaction.guild.id));
            }
            if (section === 'welcome') {
                return interaction.update(buildWelcomePanelPayload(interaction.guild.id));
            }
            if (section === 'help') {
                return interaction.update(buildHelpPanelPayload(interaction.guild.id));
            }
            if (section === 'nickname') {
                return interaction.update(buildNicknamePanelPayload(interaction.guild.id));
            }
            if (section === 'invites') {
                return interaction.update(buildInvitesPanelPayload(interaction.guild.id));
            }
            if (section === 'moderation') {
                return interaction.update(buildModerationPanelPayload(interaction.guild.id));
            }
        }
 
        // ---------- בחירת ימי וותק (preset) ----------
        if (interaction.isStringSelectMenu() && interaction.customId === 'select_veteran_days') {
            const value = interaction.values[0];
 
            if (value === 'custom') {
                const modal = new ModalBuilder().setCustomId('modal_veteran_days_custom').setTitle('ימי וותק מותאמים אישית');
                const input = new TextInputBuilder()
                    .setCustomId('days_value')
                    .setLabel('כמות ימים נדרשת')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('לדוגמה: 450')
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return interaction.showModal(modal);
            }
 
            const days = parseInt(value, 10);
            updateGuildConfig(interaction.guild.id, cfg => { cfg.veteran.requiredDays = days; });
            return interaction.update({ content: `✅ וותק נדרש עודכן ל-${days} ימים`, components: [] });
        }
 
        // ---------- שליחת מודלים ----------
        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('modal_nickname_template_')) {
                const roleId = interaction.customId.replace('modal_nickname_template_', '');
                const template = interaction.fields.getTextInputValue('template');
 
                updateGuildConfig(interaction.guild.id, cfg => { cfg.nickname.rules[roleId] = template; });
                await interaction.reply({ content: `✅ נשמר! מי שמחזיק את <@&${roleId}> יקבל את פורמט השם: \`${template}\`\nמעדכן שמות של מי שכבר מחזיק את הרול...`, ephemeral: true });
 
                reapplyForRoleHolders(interaction.guild, roleId).catch(err =>
                    console.error('❌ שגיאה בעדכון שמות אחרי הגדרת רול במערכת שינוי השם:', err)
                );
                return;
            }
 
            if (interaction.customId === 'modal_veteran_banner') {
                const url = interaction.fields.getTextInputValue('banner_url');
                updateGuildConfig(interaction.guild.id, cfg => { cfg.veteran.bannerUrl = url; });
                return interaction.reply({ content: '✅ הבאנר עודכן בהצלחה.', ephemeral: true });
            }
 
            if (interaction.customId === 'modal_help_cooldown_custom') {
                const raw = interaction.fields.getTextInputValue('cooldown_seconds');
                const seconds = parseInt(raw, 10);
                if (isNaN(seconds) || seconds <= 0) {
                    return interaction.reply({ content: '❌ יש להזין מספר תקין וגדול מ-0.', ephemeral: true });
                }
                const ms = seconds * 1000;
                updateGuildConfig(interaction.guild.id, cfg => { cfg.help.cooldownMs = ms; });
                return interaction.reply({ content: `✅ הקולדאון עודכן ל-${formatCooldown(ms)}`, ephemeral: true });
            }
 
            if (interaction.customId === 'modal_veteran_days_custom') {
                const raw = interaction.fields.getTextInputValue('days_value');
                const days = parseInt(raw, 10);
                if (isNaN(days) || days <= 0) {
                    return interaction.reply({ content: '❌ יש להזין מספר תקין וגדול מ-0.', ephemeral: true });
                }
                updateGuildConfig(interaction.guild.id, cfg => { cfg.veteran.requiredDays = days; });
                return interaction.reply({ content: `✅ וותק נדרש עודכן ל-${days} ימים`, ephemeral: true });
            }
        }
}
 
// =================== בניית מסכי הפאנל ===================
 
// באנר הבוט שמוצג בתחתית הפאנל הראשי - אפשר להחליף לתמונה אחרת בכל עת
const PANEL_BANNER_URL = 'https://media.discordapp.net/attachments/1521175085585797300/1524413914442367086/file_00000000d280720a89156b9c7e2fb073.png?ex=6a4fa897&is=6a4e5717&hm=953b88b514b40d582f6c4054d233a954e53f53e2aaa545c49c8553fc2f974af3&=&format=webp&quality=lossless&width=1632&height=653';
 
function veteranStatusText(v) {
    const role = v.roleId ? `<@&${v.roleId}>` : '❌ לא הוגדר';
    const channels = v.allowedChannels.length ? v.allowedChannels.map(c => `<#${c}>`).join(', ') : 'כל החדרים';
    return `**רול:** ${role}\n**וותק נדרש:** ${v.requiredDays} ימים\n**חדרים מורשים:** ${channels}`;
}
 
function buildMainPanelPayload(guildId) {
    const config = getGuildConfig(guildId);
 
    const menu = new StringSelectMenuBuilder()
        .setCustomId('select_panel_section')
        .setPlaceholder('בחר איזו מערכת להגדיר')
        .addOptions([
            { label: 'הגדרות וותק', description: 'רול, ימי וותק, חדרים מורשים, באנר', value: 'veteran', emoji: '🛡️' },
            { label: 'הגדרות ברוכים הבאים', description: 'חדר הוולקאם', value: 'welcome', emoji: '👋' },
            { label: 'הגדרות תמיכה', description: 'רול הצוות שיתויג ב-!h', value: 'help', emoji: '🛠️' },
            { label: 'מערכת שינוי שם', description: 'קידומות/שם אוטומטי לפי רול', value: 'nickname', emoji: '📛' },
            { label: 'מערכת הזמנות', description: 'עד 5 חדרים מורשים לפקודות /invite', value: 'invites', emoji: '📨' },
            { label: 'מודרציה (מיוט)', description: 'רולים וחדרים מורשים ל-mute/vmute', value: 'moderation', emoji: '🔇' }
        ]);
    const menuRow = new ActionRowBuilder().addComponents(menu);
 
    return {
        flags: 32768,
        components: [
            {
                type: 17,
                accent_color: 0x5865F2,
                components: [
                    { type: 10, content: '## 🎛️ פאנל שליטה\nבחר איזו מערכת תרצה להגדיר מהתפריט למטה' },
                    { type: 14 },
                    { type: 10, content: `**🛡️ מערכת וותק**\n${veteranStatusText(config.veteran)}` },
                    { type: 10, content: `**👋 ברוכים הבאים**\n**חדר:** ${config.welcome.channelId ? `<#${config.welcome.channelId}>` : '❌ לא הוגדר'}` },
                    { type: 10, content: `**🛠️ תמיכה**\n**רולי צוות:** ${config.help.roleIds.length > 0 ? config.help.roleIds.map(id => `<@&${id}>`).join(', ') : '❌ לא הוגדר'}` },
                    { type: 10, content: `**📛 שינוי שם**\n**רולים מוגדרים:** ${Object.keys(config.nickname.rules).length}` },
                    { type: 10, content: `**📨 הזמנות**\n**חדרים מורשים:** ${config.invites.allowedChannels.length > 0 ? config.invites.allowedChannels.length : 'כל החדרים'}` },
                    { type: 10, content: `**🔇 מודרציה**\n**רול מיוט:** ${config.moderation.muteRoleId ? '✅' : '❌'} | **רול השתקה:** ${config.moderation.vmuteRoleId ? '✅' : '❌'}` },
                    { type: 14 },
                    menuRow.toJSON(),
                    { type: 14 },
                    { type: 12, items: [{ media: { url: PANEL_BANNER_URL } }] }
                ]
            }
        ]
    };
}
 
function buildVeteranPanelPayload(guildId) {
    const config = getGuildConfig(guildId).veteran;
 
    const menu = new StringSelectMenuBuilder()
        .setCustomId('select_veteran_action')
        .setPlaceholder('בחר פעולה')
        .addOptions([
            { label: 'בחר רול', description: 'הרול שיינתן בעמידה בדרישת הוותק', value: 'set_role', emoji: '🎭' },
            { label: 'הגדר וותק נדרש', description: 'כמות הימים הנדרשת', value: 'set_days', emoji: '⏳' },
            { label: 'הגדר חדרים מורשים', description: 'עד 10 חדרים בהם הפקודה תעבוד', value: 'set_channels', emoji: '📍' },
            { label: 'נקה הגבלת חדרים', description: 'הפקודה תעבוד בכל חדר', value: 'clear_channels', emoji: '🗑️' },
            { label: 'הגדר באנר', description: 'תמונת הבאנר בפקודת !vt', value: 'set_banner', emoji: '🖼️' }
        ]);
    const menuRow = new ActionRowBuilder().addComponents(menu);
 
    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('panel_back').setLabel('⬅️ חזרה לתפריט הראשי').setStyle(ButtonStyle.Secondary)
    );
 
    return {
        flags: 32768,
        components: [
            {
                type: 17,
                accent_color: 0x57F287,
                components: [
                    { type: 10, content: '## 🛡️ הגדרות וותק' },
                    { type: 14 },
                    { type: 10, content: veteranStatusText(config) },
                    { type: 14 },
                    menuRow.toJSON(),
                    backRow.toJSON(),
                    { type: 14 },
                    { type: 12, items: [{ media: { url: PANEL_BANNER_URL } }] }
                ]
            }
        ]
    };
}
 
function buildWelcomePanelPayload(guildId) {
    const config = getGuildConfig(guildId).welcome;
 
    const selectRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('select_welcome_channel')
            .setPlaceholder('בחר חדר ברוכים הבאים')
            .setChannelTypes(ChannelType.GuildText)
    );
    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('panel_back').setLabel('⬅️ חזרה').setStyle(ButtonStyle.Secondary)
    );
 
    return {
        flags: 32768,
        components: [
            {
                type: 17,
                accent_color: 0x57F287,
                components: [
                    { type: 10, content: '## 👋 הגדרות ברוכים הבאים' },
                    { type: 14 },
                    { type: 10, content: `**חדר נוכחי:** ${config.channelId ? `<#${config.channelId}>` : '❌ לא הוגדר'}` },
                    { type: 14 },
                    selectRow.toJSON(),
                    backRow.toJSON(),
                    { type: 14 },
                    { type: 12, items: [{ media: { url: PANEL_BANNER_URL } }] }
                ]
            }
        ]
    };
}
 
async function handleGiveawayJoin(interaction) {
    const giveawayId = interaction.customId.replace('giveaway_join_', '');
    const giveaway = getGiveaway(giveawayId);
 
    if (!giveaway || giveaway.ended) {
        return interaction.reply({ content: '❌ ההגרלה הזו כבר לא פעילה.', ephemeral: true });
    }
 
    if (giveaway.participants.includes(interaction.user.id)) {
        return interaction.reply({ content: '✅ אתה כבר רשום להגרלה הזו, בהצלחה!', ephemeral: true });
    }
 
    const updated = updateGiveaway(giveawayId, g => { g.participants.push(interaction.user.id); });
    await interaction.reply({ content: `🎉 נרשמת בהצלחה להגרלה! משתתפים כרגע: ${updated.participants.length}`, ephemeral: true });
 
    // עדכון מונה המשתתפים בהודעת ההגרלה עצמה
    try {
        const channel = await interaction.client.channels.fetch(giveaway.channelId);
        const message = await channel.messages.fetch(giveaway.messageId);
        if (message.embeds[0]) {
            const embed = EmbedBuilder.from(message.embeds[0])
                .setFooter({ text: `לחצו על הכפתור כדי להצטרף! משתתפים: ${updated.participants.length}` });
            await message.edit({ embeds: [embed] });
        }
    } catch (err) {
        console.error('❌ שגיאה בעדכון מונה המשתתפים בהגרלה:', err);
    }
}
 
function formatCooldown(ms) {
    if (ms % 60000 === 0) return `${ms / 60000} דקות`;
    return `${Math.round(ms / 1000)} שניות`;
}
 
function buildHelpPanelPayload(guildId) {
    const config = getGuildConfig(guildId).help;
 
    const menu = new StringSelectMenuBuilder()
        .setCustomId('select_help_action')
        .setPlaceholder('בחר פעולה')
        .addOptions([
            { label: 'בחר רול צוות', description: 'הרול שיתויג בפקודת !h', value: 'set_role', emoji: '🎭' },
            { label: 'הגדר קולדאון', description: 'זמן המתנה בין שימושים ב-!h', value: 'set_cooldown', emoji: '⏱️' },
            { label: 'הגדר חדרים מורשים', description: 'עד 10 חדרים בהם !h תעבוד', value: 'set_channels', emoji: '📍' },
            { label: 'נקה הגבלת חדרים', description: 'הפקודה תעבוד בכל חדר', value: 'clear_channels', emoji: '🗑️' }
        ]);
    const menuRow = new ActionRowBuilder().addComponents(menu);
 
    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('panel_back').setLabel('⬅️ חזרה לתפריט הראשי').setStyle(ButtonStyle.Secondary)
    );
 
    const channelsText = config.allowedChannels.length > 0
        ? config.allowedChannels.map(id => `<#${id}>`).join(', ')
        : 'כל החדרים';
 
    return {
        flags: 32768,
        components: [
            {
                type: 17,
                accent_color: 0x57F287,
                components: [
                    { type: 10, content: '## 🛠️ הגדרות תמיכה' },
                    { type: 14 },
                    { type: 10, content: `**רולי צוות נוכחיים:** ${config.roleIds.length > 0 ? config.roleIds.map(id => `<@&${id}>`).join(', ') : '❌ לא הוגדר'}\n**קולדאון נוכחי:** ${formatCooldown(config.cooldownMs)}\n**חדרים מורשים:** ${channelsText}` },
                    { type: 14 },
                    menuRow.toJSON(),
                    backRow.toJSON(),
                    { type: 14 },
                    { type: 12, items: [{ media: { url: PANEL_BANNER_URL } }] }
                ]
            }
        ]
    };
}
 
function buildModerationPanelPayload(guildId) {
    const config = getGuildConfig(guildId).moderation;
 
    const menu = new StringSelectMenuBuilder()
        .setCustomId('select_moderation_action')
        .setPlaceholder('בחר פעולה')
        .addOptions([
            { label: 'הגדר רולים מורשים', description: 'עד 5 רולים שיכולים להשתמש בפקודות', value: 'set_roles', emoji: '🎭' },
            { label: 'נקה רולים מורשים', description: 'רק Administrator יוכל להשתמש', value: 'clear_roles', emoji: '🗑️' },
            { label: 'הגדר חדרים מורשים', description: 'עד 5 חדרים בהם ניתן להשתמש', value: 'set_channels', emoji: '📍' },
            { label: 'נקה הגבלת חדרים', description: 'הפקודות יעבדו בכל חדר', value: 'clear_channels_mod', emoji: '🧹' }
        ]);
    const menuRow = new ActionRowBuilder().addComponents(menu);
 
    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('panel_back').setLabel('⬅️ חזרה לתפריט הראשי').setStyle(ButtonStyle.Secondary)
    );
 
    const rolesText = config.allowedRoles.length > 0
        ? config.allowedRoles.map(id => `<@&${id}>`).join(', ')
        : 'לא הוגדר (רק Administrator רשאי)';
    const channelsText = config.allowedChannels.length > 0
        ? config.allowedChannels.map(id => `<#${id}>`).join(', ')
        : 'כל החדרים';
 
    return {
        flags: 32768,
        components: [
            {
                type: 17,
                accent_color: 0xED4245,
                components: [
                    { type: 10, content: '## 🔇 מודרציה (מיוט)' },
                    { type: 14 },
                    { type: 10, content: `**רול מיוט טקסט:** ${config.muteRoleId ? `<@&${config.muteRoleId}>` : '❌ לא הוגדר - יש להריץ `/setup mute`'}\n**רול השתקת קול:** ${config.vmuteRoleId ? `<@&${config.vmuteRoleId}>` : '❌ לא הוגדר - יש להריץ `/setup vmute`'}\n**רולים מורשים לפקודות:** ${rolesText}\n**חדרים מורשים:** ${channelsText}` },
                    { type: 14 },
                    menuRow.toJSON(),
                    backRow.toJSON(),
                    { type: 14 },
                    { type: 12, items: [{ media: { url: PANEL_BANNER_URL } }] }
                ]
            }
        ]
    };
}
 
function buildInvitesPanelPayload(guildId) {
    const config = getGuildConfig(guildId).invites;
 
    const menu = new StringSelectMenuBuilder()
        .setCustomId('select_invites_action')
        .setPlaceholder('בחר פעולה')
        .addOptions([
            { label: 'הגדר חדרים מורשים', description: 'עד 5 חדרים בהם ניתן להשתמש ב-/invite', value: 'set_channels', emoji: '📍' },
            { label: 'נקה הגבלת חדרים', description: 'הפקודות יעבדו בכל חדר', value: 'clear_channels', emoji: '🗑️' }
        ]);
    const menuRow = new ActionRowBuilder().addComponents(menu);
 
    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('panel_back').setLabel('⬅️ חזרה לתפריט הראשי').setStyle(ButtonStyle.Secondary)
    );
 
    const channelsText = config.allowedChannels.length > 0
        ? config.allowedChannels.map(id => `<#${id}>`).join(', ')
        : 'כל החדרים';
 
    return {
        flags: 32768,
        components: [
            {
                type: 17,
                accent_color: 0x2ECC71,
                components: [
                    { type: 10, content: '## 📨 מערכת הזמנות' },
                    { type: 14 },
                    { type: 10, content: `**חדרים מורשים:** ${channelsText}\nבעלי הרשאת **Administrator** יכולים להשתמש בפקודות \`/invite\` בכל חדר, גם אם ההגבלה פעילה.` },
                    { type: 14 },
                    menuRow.toJSON(),
                    backRow.toJSON(),
                    { type: 14 },
                    { type: 12, items: [{ media: { url: PANEL_BANNER_URL } }] }
                ]
            }
        ]
    };
}
 
function buildNicknamePanelPayload(guildId) {
    const config = getGuildConfig(guildId).nickname;
    const ruleCount = Object.keys(config.rules).length;
 
    const menu = new StringSelectMenuBuilder()
        .setCustomId('select_nickname_action')
        .setPlaceholder('בחר פעולה')
        .addOptions([
            { label: 'הגדר רול', description: 'קבע פורמט שם לרול (אפשר {name})', value: 'set_role', emoji: '➕' },
            { label: 'הסר רול', description: 'הסר רול ממערכת שינוי השם', value: 'remove_role', emoji: '➖' },
            { label: 'צפה ברולים מוגדרים', description: 'רשימת כל הרולים והפורמטים שלהם', value: 'view_roles', emoji: '📋' }
        ]);
    const menuRow = new ActionRowBuilder().addComponents(menu);
 
    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('panel_back').setLabel('⬅️ חזרה לתפריט הראשי').setStyle(ButtonStyle.Secondary)
    );
 
    return {
        flags: 32768,
        components: [
            {
                type: 17,
                accent_color: 0x9B59B6,
                components: [
                    { type: 10, content: '## 📛 מערכת שינוי שם' },
                    { type: 14 },
                    { type: 10, content: `**רולים מוגדרים כרגע:** ${ruleCount}\nהשתמש ב-\`{name}\` בתוך הפורמט כדי לשלב את השם המקורי של המשתמש (לדוגמה: \`HR | {name}\`).` },
                    { type: 14 },
                    menuRow.toJSON(),
                    backRow.toJSON(),
                    { type: 14 },
                    { type: 12, items: [{ media: { url: PANEL_BANNER_URL } }] }
                ]
            }
        ]
    };
}
 
async function handleVerifyClick(interaction) {
    const roleId = interaction.customId.replace('verify_role_', '');
    const role = interaction.guild.roles.cache.get(roleId);
 
    if (!role) {
        return interaction.reply({ content: '❌ הרול הזה כבר לא קיים בשרת. יש לפנות לאדמין כדי להגדיר מחדש עם `/setup verify`.', ephemeral: true });
    }
 
    if (interaction.member.roles.cache.has(roleId)) {
        return interaction.reply({ content: '✅ כבר עברת אימות בעבר, הכל תקין!', ephemeral: true });
    }
 
    try {
        await interaction.member.roles.add(roleId);
        return interaction.reply({ content: `✅ **אומתת בהצלחה!**\nקיבלת גישה מלאה לשרת.`, ephemeral: true });
    } catch (err) {
        console.error('❌ שגיאה בהוספת רול אימות:', err);
        return interaction.reply({ content: '❌ קרתה שגיאה בעת מתן הגישה. ייתכן שאין לבוט הרשאות מתאימות - יש לפנות לאדמין.', ephemeral: true });
    }
}
 
module.exports.buildMainPanelPayload = buildMainPanelPayload;
 