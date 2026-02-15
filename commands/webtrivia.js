const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const { createTriviaSession } = require('../server');

module.exports = {
    name: 'webtrivia',
    description: 'Start a multiplayer trivia game in the browser',

    async execute(interaction) {
        const sessionId = uuidv4();
        const user = interaction.user;

        // Create a trivia session with host data
        createTriviaSession(sessionId, {
            odiscordId: user.id,
            username: user.username,
            displayName: user.displayName || user.username,
            avatarUrl: user.displayAvatarURL({ format: 'png', size: 128 }),
            channelId: interaction.channelId
        });

        const embed = new EmbedBuilder()
            .setTitle('🎮 Web Trivia - Multiplayer Game')
            .setDescription(
                `**${user.displayName || user.username}** is hosting a trivia game!\n\n` +
                `Click the button below to join the lobby.\n` +
                `The host can configure the game settings in the browser.`
            )
            .addFields(
                { name: '🌐 How to Play', value: '1. Click "Join Game" below\n2. Wait in the lobby for other players\n3. Host starts the game\n4. Answer questions faster for more points!' },
                { name: '⏱️ Session', value: 'This link expires in 10 minutes if the game doesn\'t start.' }
            )
            .setThumbnail(user.displayAvatarURL({ format: 'png', size: 128 }))
            .setColor('#7C3AED')
            .setFooter({ text: 'MeowBot Web Trivia' })
            .setTimestamp();

        // Use a regular button (not a Link button) so we can capture the clicking user's info
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`webtrivia_join_${sessionId}`)
                    .setLabel('🎮 Join Game')
                    .setStyle(ButtonStyle.Primary)
            );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    // Handle button clicks — capture the clicking user's Discord info and give them a personalized link
    async handleButton(interaction) {
        const customId = interaction.customId;

        if (!customId.startsWith('webtrivia_join_')) return;

        const sessionId = customId.replace('webtrivia_join_', '');
        const user = interaction.user;

        const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';

        // Build personalized URL with user identity baked in
        const params = new URLSearchParams({
            id: sessionId,
            odiscordId: user.id,
            username: user.username,
            displayName: user.displayName || user.username,
            avatarUrl: user.displayAvatarURL({ format: 'png', size: 128 })
        });

        const triviaUrl = `${baseUrl}/trivia?${params.toString()}`;

        // Reply with a clickable link — ephemeral so only the clicking user sees it
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('🚀 Open Game')
                    .setStyle(ButtonStyle.Link)
                    .setURL(triviaUrl)
            );

        await interaction.reply({
            content: `Your game link is ready! Click below to join:`,
            components: [row],
            ephemeral: true
        });
    }
};
