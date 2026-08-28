const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    UserSelectMenuBuilder
} = require('discord.js');
const {
    getOwnerOfChannel, transferOwnership, unregisterChannel,
    getUserSettings, updateUserSettings
} = require('./tempVoiceStore');
 
function getOwnedTempChannel(interaction) {
    const channelId = interaction.member.voice.channelId;
    if (!channelId) return { error: '❌ אתה חייב להיות מחובר לחדר הקול הזמני שלך כדי להשתמש בכפתור הזה.' };
 
    const ownerId = getOwnerOfChannel(interaction.guild.id, channelId);
    if (!ownerId) return { error: '❌ החדר שאתה בו הוא לא חדר זמני שנוצר על ידי המערכת.' };
 
    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) return { error: '❌ לא מצאתי את החדר.' };
 
    return { channelId, ownerId, channel, isOwner: ownerId === interaction.user.id };
}
 
function requireOwner(interaction) {
    const result = getOwnedTempChannel(interaction);
    if (result.error) return result;
    if (!result.isOwner) return { error: '⛔ רק הבעלים של החדר יכול להשתמש בכפתור הזה.' };
    return result;
}
 
// מעביר את הרשאות הניהול המיוחדות (Manage Channels/Move/Mute/Deafen) מבעלים קודם לבעלים חדש
async function reassignOwnerPermissions(channel, previousOwnerId, newOwnerId) {
    if (previousOwnerId) {
        await channel.permissionOverwrites.edit(previousOwnerId, {
            ManageChannels: null,
            MoveMembers: null,
            MuteMembers: null,
            DeafenMembers: null
        }).catch(err => console.error('❌ שגיאה בהסרת הרשאות מהבעלים הקודם:', err));
    }
 
    await channel.permissionOverwrites.edit(newOwnerId, {
        ViewChannel: true, Connect: true, Speak: true,
        MuteMembers: true, DeafenMembers: true, MoveMembers: true, ManageChannels: true
    }).catch(err => console.error('❌ שגיאה בעדכון הרשאות הבעלים החדש:', err));
}
 
async function handleTempVoiceInteraction(interaction) {
    const customId = interaction.customId;
    if (!customId) return false;
 
    const isOurs = customId.startsWith('tempvoice_') || customId.startsWith('modal_tempvoice_') || customId.startsWith('select_tempvoice_');
    if (!isOurs) return false;
 
    try {
        await dispatch(interaction, customId);
    } catch (err) {
        console.error('❌ שגיאה במערכת TempVoice:', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ קרתה שגיאה. נסה שוב.', ephemeral: true }).catch(() => {});
        }
    }
    return true;
}
 
async function dispatch(interaction, customId) {
    if (interaction.isButton()) {
        switch (customId) {
            case 'tempvoice_name': return handleNameButton(interaction);
            case 'tempvoice_limit': return handleLimitButton(interaction);
            case 'tempvoice_privacy': return handlePrivacyToggle(interaction);
            case 'tempvoice_chat': return handleChatToggle(interaction);
            case 'tempvoice_trust': return promptUserSelect(interaction, 'select_tempvoice_trust', 'בחר משתמש לאמון (יוכל להיכנס תמיד):');
            case 'tempvoice_untrust': return promptUserSelect(interaction, 'select_tempvoice_untrust', 'בחר משתמש להסרת אמון:');
            case 'tempvoice_invite': return handleInviteButton(interaction);
            case 'tempvoice_kick': return promptUserSelect(interaction, 'select_tempvoice_kick', 'בחר משתמש לניתוק מהחדר:');
            case 'tempvoice_block': return promptUserSelect(interaction, 'select_tempvoice_block', 'בחר משתמש לחסימה:');
            case 'tempvoice_unblock': return promptUserSelect(interaction, 'select_tempvoice_unblock', 'בחר משתמש להסרת חסימה:');
            case 'tempvoice_claim': return handleClaimButton(interaction);
            case 'tempvoice_transfer': return promptUserSelect(interaction, 'select_tempvoice_transfer', 'בחר משתמש שיקבל בעלות על החדר:');
        }
    }
 
    if (interaction.isModalSubmit()) {
        if (customId === 'modal_tempvoice_name') return handleNameSubmit(interaction);
        if (customId === 'modal_tempvoice_limit') return handleLimitSubmit(interaction);
    }
 
    if (interaction.isUserSelectMenu()) {
        if (customId === 'select_tempvoice_trust') return handleTrustSelect(interaction);
        if (customId === 'select_tempvoice_untrust') return handleUntrustSelect(interaction);
        if (customId === 'select_tempvoice_kick') return handleKickSelect(interaction);
        if (customId === 'select_tempvoice_block') return handleBlockSelect(interaction);
        if (customId === 'select_tempvoice_unblock') return handleUnblockSelect(interaction);
        if (customId === 'select_tempvoice_transfer') return handleTransferSelect(interaction);
    }
}
 
// ===================== NAME =====================
 
async function handleNameButton(interaction) {
    const result = requireOwner(interaction);
    if (result.error) return interaction.reply({ content: result.error, ephemeral: true });
 
    const modal = new ModalBuilder().setCustomId('modal_tempvoice_name').setTitle('שינוי שם החדר');
    const input = new TextInputBuilder().setCustomId('name').setLabel('שם חדש לחדר').setStyle(TextInputStyle.Short).setMaxLength(90).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}
 
async function handleNameSubmit(interaction) {
    const result = requireOwner(interaction);
    if (result.error) return interaction.reply({ content: result.error, ephemeral: true });
 
    const newName = interaction.fields.getTextInputValue('name');
    try {
        await result.channel.setName(newName);
        updateUserSettings(interaction.guild.id, interaction.user.id, s => { s.name = newName; });
        await interaction.reply({ content: `✅ שם החדר עודכן ל-**${newName}**`, ephemeral: true });
    } catch (err) {
        console.error('❌ שגיאה בשינוי שם:', err);
        await interaction.reply({ content: '❌ לא הצלחתי לשנות את השם (ייתכן שינוי יתר על המידה בזמן קצר).', ephemeral: true });
    }
}
 
// ===================== LIMIT =====================
 
async function handleLimitButton(interaction) {
    const result = requireOwner(interaction);
    if (result.error) return interaction.reply({ content: result.error, ephemeral: true });
 
    const modal = new ModalBuilder().setCustomId('modal_tempvoice_limit').setTitle('הגבלת כמות משתתפים');
    const input = new TextInputBuilder().setCustomId('limit').setLabel('כמות מקסימלית (0 = ללא הגבלה)').setStyle(TextInputStyle.Short).setPlaceholder('לדוגמה: 5').setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}
 
async function handleLimitSubmit(interaction) {
    const result = requireOwner(interaction);
    if (result.error) return interaction.reply({ content: result.error, ephemeral: true });
 
    const limit = parseInt(interaction.fields.getTextInputValue('limit'), 10);
    if (isNaN(limit) || limit < 0 || limit > 99) {
        return interaction.reply({ content: '❌ יש להזין מספר בין 0 ל-99.', ephemeral: true });
    }
 
    try {
        await result.channel.setUserLimit(limit);
        updateUserSettings(interaction.guild.id, interaction.user.id, s => { s.limit = limit; });
        await interaction.reply({ content: limit === 0 ? '✅ הוסרה הגבלת המשתתפים.' : `✅ הוגבל ל-${limit} משתתפים.`, ephemeral: true });
    } catch (err) {
        console.error('❌ שגיאה בהגבלת משתתפים:', err);
        await interaction.reply({ content: '❌ קרתה שגיאה.', ephemeral: true });
    }
}
 
// ===================== PRIVACY =====================
 
async function handlePrivacyToggle(interaction) {
    const result = requireOwner(interaction);
    if (result.error) return interaction.reply({ content: result.error, ephemeral: true });
 
    const settings = getUserSettings(interaction.guild.id, interaction.user.id);
    const newLocked = !settings.locked;
 
    try {
        // ViewChannel נשאר מותר תמיד - רק Connect משתנה, כדי שהחדר עדיין ייראה גם כשהוא נעול
        await result.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            ViewChannel: true,
            Connect: newLocked ? false : true
        });
        updateUserSettings(interaction.guild.id, interaction.user.id, s => { s.locked = newLocked; });
        await interaction.reply({ content: newLocked ? '🔒 החדר ננעל - אף אחד לא יכול להיכנס בלי אישור.' : '🔓 החדר נפתח - כולם יכולים להיכנס.', ephemeral: true });
    } catch (err) {
        console.error('❌ שגיאה בשינוי פרטיות:', err);
        await interaction.reply({ content: '❌ קרתה שגיאה.', ephemeral: true });
    }
}
 
// ===================== CHAT =====================
 
async function handleChatToggle(interaction) {
    const result = requireOwner(interaction);
    if (result.error) return interaction.reply({ content: result.error, ephemeral: true });
 
    const settings = getUserSettings(interaction.guild.id, interaction.user.id);
    const newChatLocked = !settings.chatLocked;
 
    try {
        await result.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: newChatLocked ? false : null });
        updateUserSettings(interaction.guild.id, interaction.user.id, s => { s.chatLocked = newChatLocked; });
        await interaction.reply({ content: newChatLocked ? '💬 הצ׳אט של החדר נסגר.' : '💬 הצ׳אט של החדר נפתח.', ephemeral: true });
    } catch (err) {
        console.error('❌ שגיאה בשינוי הצ׳אט:', err);
        await interaction.reply({ content: '❌ קרתה שגיאה.', ephemeral: true });
    }
}
 
// ===================== INVITE =====================
 
async function handleInviteButton(interaction) {
    const result = getOwnedTempChannel(interaction);
    if (result.error) return interaction.reply({ content: result.error, ephemeral: true });
 
    try {
        const invite = await result.channel.createInvite({ maxAge: 3600, maxUses: 0 });
        await interaction.reply({ content: `🔗 קישור הזמנה לחדר (בתוקף לשעה): ${invite.url}`, ephemeral: true });
    } catch (err) {
        console.error('❌ שגיאה ביצירת הזמנה:', err);
        await interaction.reply({ content: '❌ לא הצלחתי ליצור הזמנה.', ephemeral: true });
    }
}
 
// ===================== TRUST / UNTRUST =====================
 
async function promptUserSelect(interaction, customId, placeholder) {
    const result = requireOwner(interaction);
    if (result.error) return interaction.reply({ content: result.error, ephemeral: true });
 
    const menu = new UserSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder);
    await interaction.reply({ content: placeholder, components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
}
 
async function handleTrustSelect(interaction) {
    const result = requireOwner(interaction);
    if (result.error) return interaction.update({ content: result.error, components: [] });
 
    const targetId = interaction.values[0];
    try {
        await result.channel.permissionOverwrites.edit(targetId, { ViewChannel: true, Connect: true });
        updateUserSettings(interaction.guild.id, interaction.user.id, s => {
            if (!s.trustedUserIds.includes(targetId)) s.trustedUserIds.push(targetId);
            s.blockedUserIds = s.blockedUserIds.filter(id => id !== targetId);
        });
        await interaction.update({ content: `✅ <@${targetId}> קיבל אמון - יכול להיכנס תמיד.`, components: [] });
    } catch (err) {
        console.error('❌ שגיאה בהוספת אמון:', err);
        await interaction.update({ content: '❌ קרתה שגיאה.', components: [] });
    }
}
 
async function handleUntrustSelect(interaction) {
    const result = requireOwner(interaction);
    if (result.error) return interaction.update({ content: result.error, components: [] });
 
    const targetId = interaction.values[0];
    try {
        await result.channel.permissionOverwrites.delete(targetId).catch(() => {});
        updateUserSettings(interaction.guild.id, interaction.user.id, s => {
            s.trustedUserIds = s.trustedUserIds.filter(id => id !== targetId);
        });
        await interaction.update({ content: `✅ האמון של <@${targetId}> הוסר.`, components: [] });
    } catch (err) {
        console.error('❌ שגיאה בהסרת אמון:', err);
        await interaction.update({ content: '❌ קרתה שגיאה.', components: [] });
    }
}
 
// ===================== KICK =====================
 
async function handleKickSelect(interaction) {
    const result = requireOwner(interaction);
    if (result.error) return interaction.update({ content: result.error, components: [] });
 
    const targetId = interaction.values[0];
    const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
 
    if (!targetMember || targetMember.voice.channelId !== result.channelId) {
        return interaction.update({ content: '❌ המשתמש הזה לא נמצא בחדר שלך כרגע.', components: [] });
    }
 
    try {
        await targetMember.voice.disconnect();
        await interaction.update({ content: `✅ <@${targetId}> נותק מהחדר.`, components: [] });
    } catch (err) {
        console.error('❌ שגיאה בניתוק משתמש:', err);
        await interaction.update({ content: '❌ קרתה שגיאה.', components: [] });
    }
}
 
// ===================== BLOCK / UNBLOCK =====================
 
async function handleBlockSelect(interaction) {
    const result = requireOwner(interaction);
    if (result.error) return interaction.update({ content: result.error, components: [] });
 
    const targetId = interaction.values[0];
    try {
        await result.channel.permissionOverwrites.edit(targetId, { ViewChannel: false, Connect: false });
        updateUserSettings(interaction.guild.id, interaction.user.id, s => {
            if (!s.blockedUserIds.includes(targetId)) s.blockedUserIds.push(targetId);
            s.trustedUserIds = s.trustedUserIds.filter(id => id !== targetId);
        });
 
        const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
        if (targetMember && targetMember.voice.channelId === result.channelId) {
            await targetMember.voice.disconnect().catch(() => {});
        }
 
        await interaction.update({ content: `🚫 <@${targetId}> נחסם מהחדר.`, components: [] });
    } catch (err) {
        console.error('❌ שגיאה בחסימה:', err);
        await interaction.update({ content: '❌ קרתה שגיאה.', components: [] });
    }
}
 
async function handleUnblockSelect(interaction) {
    const result = requireOwner(interaction);
    if (result.error) return interaction.update({ content: result.error, components: [] });
 
    const targetId = interaction.values[0];
    try {
        await result.channel.permissionOverwrites.delete(targetId).catch(() => {});
        updateUserSettings(interaction.guild.id, interaction.user.id, s => {
            s.blockedUserIds = s.blockedUserIds.filter(id => id !== targetId);
        });
        await interaction.update({ content: `✅ החסימה של <@${targetId}> הוסרה.`, components: [] });
    } catch (err) {
        console.error('❌ שגיאה בהסרת חסימה:', err);
        await interaction.update({ content: '❌ קרתה שגיאה.', components: [] });
    }
}
 
// ===================== CLAIM =====================
 
async function handleClaimButton(interaction) {
    const result = getOwnedTempChannel(interaction);
    if (result.error) return interaction.reply({ content: result.error, ephemeral: true });
 
    if (result.isOwner) {
        return interaction.reply({ content: 'ℹ️ אתה כבר הבעלים של החדר הזה.', ephemeral: true });
    }
 
    if (result.channel.members.has(result.ownerId)) {
        return interaction.reply({ content: '❌ הבעלים הנוכחי עדיין בחדר - אי אפשר לתפוס בעלות.', ephemeral: true });
    }
 
    const previousOwnerId = result.ownerId;
    transferOwnership(interaction.guild.id, result.channelId, interaction.user.id);
    await reassignOwnerPermissions(result.channel, previousOwnerId, interaction.user.id);
 
    await interaction.reply({ content: '👑 תפסת בעלות על החדר!', ephemeral: true });
}
 
// ===================== TRANSFER =====================
 
async function handleTransferSelect(interaction) {
    const result = requireOwner(interaction);
    if (result.error) return interaction.update({ content: result.error, components: [] });
 
    const targetId = interaction.values[0];
    const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
 
    if (!targetMember || targetMember.voice.channelId !== result.channelId) {
        return interaction.update({ content: '❌ אפשר להעביר בעלות רק למישהו שנמצא כרגע בחדר.', components: [] });
    }
 
    const previousOwnerId = result.ownerId;
    transferOwnership(interaction.guild.id, result.channelId, targetId);
    await reassignOwnerPermissions(result.channel, previousOwnerId, targetId);
 
    await interaction.update({ content: `👑 הבעלות הועברה במלואה ל-<@${targetId}> (כולל הרשאות הניהול).`, components: [] });
}
 
module.exports = { handleTempVoiceInteraction };
 