const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
 
// פקודות עם קידומת "!" אינן שמורות באוסף אוטומטי כמו פקודות ה-Slash,
// אז צריך לעדכן את הרשימה כאן ידנית בכל פעם שמוסיפים/משנים פקודת "!" חדשה.
const PREFIX_COMMANDS = [
    { name: '!vt', description: 'בדיקת וותק בשרת וקבלת רול וטרן במידה ועומדים בדרישה' },
    { name: '!h', description: 'קריאה לעזרה/תמיכה - מתייג את הצוות המוגדר' },
    { name: '!clear <כמות>', description: 'מחיקת מספר הודעות בחדר (עד 100). דורש הרשאה מתאימה.' },
    { name: '!rr add [חדר] <msg_id> <אימוג׳י> <רול>', description: 'הגדרת רול-ריאקשן על הודעה קיימת. רק אדמין.' }
];
 
// מערכות פנימיות בבוט שרצות ברקע (לא פקודות שמריצים ישירות) - גם אלו מתעדכנות ידנית.
const BOT_SYSTEMS = [
    { name: 'שינוי שם אוטומטי', description: 'קידומת/שם אוטומטי לפי הרול הגבוה ביותר שיש למשתמש. ניתן להגדיר דרך `/panel`.' },
    { name: 'מעקב הזמנות', description: 'עד 5 חדרים מורשים לפקודות `/invite`. ניתן להגדיר דרך `/panel`.' },
    { name: 'מודרציה (מיוט)', description: 'רולי מיוט/השתקת קול, רולים וחדרים מורשים ל-mute/vmute. רול המיוט עצמו מוקם דרך `/setup mute` ו-`/setup vmute`, שאר ההגדרות דרך `/panel`.' },
    { name: 'ניקוי הודעות', description: 'רולים מורשים לפקודת `!clear`. ניתן להגדיר דרך `/panel`.' },
    { name: 'רול-ריאקשן', description: 'קבלת רול בלחיצה על אימוג׳י תחת הודעה. מוגדר דרך `!rr add`.' }
];
 
const SUBCOMMAND_TYPE = 1; // ApplicationCommandOptionType.Subcommand
 
/**
 * מחזיר שורת תיאור לכל פקודה. פקודות עם תת-פקודות (כמו /setup verify)
 * מוצגות כשורה נפרדת לכל תת-פקודה, כדי שיהיה ברור בדיוק איך להשתמש בהן.
 */
function buildSlashCommandLines(commands) {
    const lines = [];
 
    const sorted = [...commands.values()].sort((a, b) => a.data.name.localeCompare(b.data.name));
 
    for (const cmd of sorted) {
        const json = cmd.data.toJSON();
        const subcommands = (json.options || []).filter(opt => opt.type === SUBCOMMAND_TYPE);
 
        if (subcommands.length > 0) {
            for (const sub of subcommands) {
                lines.push(`\`/${json.name} ${sub.name}\` – ${sub.description}`);
            }
        } else {
            lines.push(`\`/${json.name}\` – ${json.description}`);
        }
    }
 
    return lines;
}
 
module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('הצגת רשימת כל הפקודות הזמינות בבוט'),
 
    async execute(interaction) {
        const commands = interaction.client.commands;
 
        const slashLines = buildSlashCommandLines(commands);
        const prefixLines = PREFIX_COMMANDS.map(cmd => `\`${cmd.name}\` – ${cmd.description}`);
        const systemLines = BOT_SYSTEMS.map(sys => `**${sys.name}** – ${sys.description}`);
 
        const embed = new EmbedBuilder()
            .setTitle('📖 רשימת פקודות')
            .setColor(0x5865F2)
            .addFields(
                { name: '🔹 פקודות Slash', value: slashLines.join('\n') || 'אין פקודות זמינות כרגע.' },
                { name: '🔸 פקודות עם !', value: prefixLines.join('\n') || 'אין פקודות זמינות כרגע.' },
                { name: '⚙️ מערכות בבוט', value: systemLines.join('\n') || 'אין מערכות זמינות כרגע.' }
            )
            .setFooter({ text: `סה"כ ${slashLines.length + prefixLines.length} פקודות` });
 
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
 