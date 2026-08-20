
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
require('dotenv').config();
 
// שרת HTTP זעיר - קיים רק כדי ש-Render יראה פורט פתוח ולא יעשה Timeout.
// אם תעבור בעתיד ל-Background Worker ב-Render, אפשר למחוק את הבלוק הזה.
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('הבוט רץ בהצלחה!');
}).listen(PORT, () => console.log(`🌐 שרת בדיקה מאזין על פורט ${PORT}`));
 
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});
 
client.commands = new Collection();
 
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
 
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  const commandName = command.data ? command.data.name : command.name;
 
  if (!commandName) {
    console.log(`[WARNING] ${file} name data.name.`);
    continue;
  }
 
  client.commands.set(commandName, command);
}
 
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
 
for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}
 
client.login(process.env.TOKEN);
 