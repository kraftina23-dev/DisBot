const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGiveaway, getAllGiveaways, updateGiveaway } = require('./giveaways');
 
// setTimeout לא תומך בהשהיות ארוכות מ-~24.8 ימים (מגבלת 32-bit של Node)
const MAX_TIMEOUT_MS = 2_147_483_647;
 
function pickWinners(participants, count) {
    const pool = [...participants];
    const winners = [];
    while (winners.length < count && pool.length > 0) {
        const index = Math.floor(Math.random() * pool.length);
        winners.push(pool.splice(index, 1)[0]);
    }
    return winners;
}
 
async function endGiveaway(client, giveaway) {
    try {
        const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
        const message = channel ? await channel.messages.fetch(giveaway.messageId).catch(() => null) : null;
 
        const winners = pickWinners(giveaway.participants, giveaway.winnersCount);
        const colorHex = giveaway.color || '5865F2';
 
        const resultEmbed = (message && message.embeds[0])
            ? EmbedBuilder.from(message.embeds[0])
            : new EmbedBuilder().setTitle(`🎉 ${giveaway.title}`);
 
        resultEmbed
            .setColor(parseInt(colorHex, 16))
            .setFooter({ text: `ההגרלה הסתיימה • ${giveaway.participants.length} משתתפים` });
 
        if (winners.length > 0) {
            resultEmbed.addFields({ name: '🏆 זוכים', value: winners.map(id => `<@${id}>`).join(', ') });
        } else {
            resultEmbed.addFields({ name: '🏆 זוכים', value: 'לא היו מספיק משתתפים 😕' });
        }
 
        if (message) {
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`giveaway_ended_${giveaway.id}`)
                    .setLabel('🎉 ההגרלה הסתיימה')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
            await message.edit({ embeds: [resultEmbed], components: [disabledRow] });
        }
 
        if (channel) {
            if (winners.length > 0) {
                await channel.send(`🎉 מזל טוב ל-${winners.map(id => `<@${id}>`).join(', ')}! זכיתם ב**${giveaway.title}**!`);
            } else {
                await channel.send(`😕 לא היו מספיק משתתפים בהגרלה **${giveaway.title}**, לא נבחר זוכה.`);
            }
        }
 
        // שומרים את ההגרלה (במקום למחוק) כדי שיהיה אפשר לגלגל מחדש עם /greroll
        updateGiveaway(giveaway.id, g => {
            g.ended = true;
            g.winners = winners;
        });
    } catch (err) {
        console.error('❌ שגיאה בסיום הגרלה:', err);
    }
}
 
// טוען מחדש את ההגרלה מהדיסק (למקרה שהשתנתה) ומוודא שהיא לא כבר הסתיימה, לפני שמסיימים אותה בפועל
async function endGiveawayIfStillActive(client, giveawayId) {
    const fresh = getGiveaway(giveawayId);
    if (!fresh || fresh.ended) return;
 
    updateGiveaway(giveawayId, g => { g.ended = true; });
    await endGiveaway(client, fresh);
}
 
/**
 * מתזמן טיימר מדויק (setTimeout) שיורה בדיוק ברגע שההגרלה אמורה להסתיים - בלי דיליי.
 * בטוח לקרוא לפונקציה הזו גם כמה שניות אחרי שההגרלה כבר הייתה אמורה להסתיים - היא תסיים אותה מיד.
 */
function scheduleGiveawayEnd(client, giveaway) {
    if (giveaway.ended) return;
 
    const remaining = giveaway.endTimestamp - Date.now();
 
    if (remaining <= 0) {
        // כבר עבר הזמן - מסיימים כבר עכשיו
        endGiveawayIfStillActive(client, giveaway.id);
        return;
    }
 
    if (remaining > MAX_TIMEOUT_MS) {
        // הגרלה ארוכה מדי בשביל setTimeout בודד - הבדיקה התקופתית תתפוס אותה בהמשך
        return;
    }
 
    setTimeout(() => {
        endGiveawayIfStillActive(client, giveaway.id);
    }, remaining);
}
 
/**
 * מתחיל את מנגנון ההגרלות:
 * 1. מתזמן טיימר מדויק לכל הגרלה פעילה (כולל אחרי הפעלה מחדש של הבוט)
 * 2. בדיקה תקופתית כרשת ביטחון בלבד (למקרה נדיר שטיימר לא נורה, למשל בעיית זיכרון/קריסה)
 * בטוח לקרוא לפונקציה הזו כמה פעמים - היא תתחיל רק פעם אחת.
 */
let schedulerStarted = false;
function startGiveawayScheduler(client) {
    if (schedulerStarted) return;
    schedulerStarted = true;
 
    // תזמון מיידי לכל ההגרלות הפעילות שכבר קיימות (למשל אחרי הפעלה מחדש)
    const existing = getAllGiveaways();
    for (const giveaway of Object.values(existing)) {
        if (!giveaway.ended) {
            scheduleGiveawayEnd(client, giveaway);
        }
    }
 
    // רשת ביטחון - בודקת כל 5 שניות אם משהו "נשמט" מהטיימרים
    setInterval(async () => {
        const giveaways = getAllGiveaways();
        const now = Date.now();
 
        for (const giveaway of Object.values(giveaways)) {
            if (!giveaway.ended && giveaway.endTimestamp <= now) {
                await endGiveawayIfStillActive(client, giveaway.id);
            }
        }
    }, 5_000);
 
    console.log('🎉 מתזמן ההגרלות הופעל.');
}
 
/**
 * מסיים הגרלה מוקדם (משמש את /gend). מחזיר true אם ההגרלה אכן הסתיימה עכשיו.
 */
async function forceEndGiveaway(client, giveawayId) {
    const giveaway = getGiveaway(giveawayId);
    if (!giveaway || giveaway.ended) return false;
 
    updateGiveaway(giveawayId, g => { g.ended = true; });
    await endGiveaway(client, giveaway);
    return true;
}
 
/**
 * בוחר זוכים חדשים עבור הגרלה שכבר הסתיימה (משמש את /greroll).
 * מעדכן את הודעת ההגרלה המקורית ושולח הכרזה חדשה בערוץ.
 * מחזיר { winners } או null אם משהו נכשל.
 */
async function rerollGiveaway(client, giveawayId) {
    const giveaway = getGiveaway(giveawayId);
    if (!giveaway || !giveaway.ended) return null;
 
    const newWinners = pickWinners(giveaway.participants, giveaway.winnersCount);
 
    try {
        const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
        const message = channel ? await channel.messages.fetch(giveaway.messageId).catch(() => null) : null;
 
        if (message && message.embeds[0]) {
            const winnersFieldValue = newWinners.length > 0
                ? newWinners.map(id => `<@${id}>`).join(', ')
                : 'לא היו מספיק משתתפים 😕';
 
            const existingFields = message.embeds[0].fields.filter(f => f.name !== '🏆 זוכים');
            const resultEmbed = EmbedBuilder.from(message.embeds[0])
                .setFields([...existingFields, { name: '🏆 זוכים', value: winnersFieldValue }]);
 
            await message.edit({ embeds: [resultEmbed] });
        }
 
        if (channel) {
            if (newWinners.length > 0) {
                await channel.send(`🔄 **גלגול מחדש!** הזוכה/ים החדש/ים ב-**${giveaway.title}**: ${newWinners.map(id => `<@${id}>`).join(', ')} 🎉`);
            } else {
                await channel.send(`🔄 ניסינו לגלגל מחדש את **${giveaway.title}**, אבל אין מספיק משתתפים לבחור זוכה.`);
            }
        }
    } catch (err) {
        console.error('❌ שגיאה בגלגול מחדש של הגרלה:', err);
        return null;
    }
 
    updateGiveaway(giveawayId, g => { g.winners = newWinners; });
    return { winners: newWinners };
}
 
module.exports = { startGiveawayScheduler, scheduleGiveawayEnd, forceEndGiveaway, rerollGiveaway };
 