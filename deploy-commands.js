// deploy-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
 
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
 
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing "data" or "execute"`);
    }
}
 
const rest = new REST().setToken(process.env.TOKEN);
 
(async () => {
    try {
        console.log(`Started refreshing ${commands.length} GLOBAL application (/) commands.`);
 
        // applicationCommands (בלי guildId) = גלובלי, עובד בכל שרת שהבוט נמצא בו
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );
 
        console.log(`Successfully reloaded ${data.length} GLOBAL application (/) commands.`);
        console.log('שים לב: פקודות גלובליות יכולות לקחת עד שעה להופיע בכל השרתים (בדרך כלל מהר יותר).');
    } catch (error) {
        console.error(error);
    }
})();
 