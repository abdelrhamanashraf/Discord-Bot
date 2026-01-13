const { REST, Routes } = require('discord.js');
require('dotenv').config();
const commands = require('./commandsList');

// Use the token from .env
const token = process.env.DISCORD_TOKEN;
// We need the client/application ID. Usually it's in .env too, or we can just fetch it from the token (but rest needs it).
// Assuming DISCORD_CLIENT_ID is in .env or the user knows they need it.
// If it's not in .env, we might fail. Let's try to assume it's in .env as CLIENT_ID or APPLICATION_ID.
// Checking previous interactions, I didn't see the .env content, but usually bots need it.
// If it's missing, the script will error and the user will know to add it.
const clientId = '408973537764835328';

if (!token) {
    console.error('Error: DISCORD_TOKEN is missing in .env');
    process.exit(1);
}
if (!clientId) {
    console.error('Error: CLIENT_ID (or APPLICATION_ID / DISCORD_CLIENT_ID) is missing in .env');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        // If you want global commands, remove the guildId part (but global commands take 1 hour to update).
        // Since "upload" is a global command usually, we'll try global registration.
        // Routes.applicationCommands(clientId) is for global commands.
        // Routes.applicationGuildCommands(clientId, guildId) is for guild-specific commands.

        // I will use global commands as per the index.js logic which used Routes.applicationCommands(client.user.id)

        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
