const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const { createCodenamesSession } = require('../server');

module.exports = {
    name: 'codenames',
    description: 'Start a Codenames-style word game in the browser',

    async execute(interaction) {
        const sessionId = uuidv4();
        const user = interaction.user;

        // Create a codenames session with host data
        const result = createCodenamesSession(sessionId, {
            odiscordId: user.id,
            username: user.username,
            displayName: user.displayName || user.username,
            avatarUrl: user.displayAvatarURL({ format: 'png', size: 128 }),
            channelId: interaction.channelId
        });

        if (!result) {
            return interaction.reply({
                content: '⚠️ Maximum number of concurrent Codenames games reached. Please wait for an existing game to finish.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('🕵️ Codenames — Word Spy Game')
            .setDescription(
                `**${user.displayName || user.username}** is hosting a Codenames game!\n\n` +
                `Click the button below to join the lobby.\n` +
                `Teams, roles, and language are configured in the browser.`
            )
            .addFields(
                {
                    name: '🎯 How to Play',
                    value:
                        '1. Click "Join Game" below\n' +
                        '2. Pick your team & role (Spy or Operative)\n' +
                        '3. Spies give one-word clues\n' +
                        '4. Operatives guess the right cards!'
                },
                {
                    name: '👥 Requirements',
                    value: 'Min 4 players (1 Spy + 1 Operative per team)'
                },
                {
                    name: '⏱️ Session',
                    value: 'This link expires in 15 minutes if the game doesn\'t start.'
                }
            )
            .setThumbnail(user.displayAvatarURL({ format: 'png', size: 128 }))
            .setColor('#E63946')
            .setFooter({ text: 'MeowBot Codenames' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`codenames_join_${sessionId}`)
                    .setLabel('🕵️ Join Game')
                    .setStyle(ButtonStyle.Primary)
            );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    // Handle button clicks — capture the clicking user's Discord info and give them a personalized link
    async handleButton(interaction) {
        const customId = interaction.customId;

        if (!customId.startsWith('codenames_join_')) return;

        const sessionId = customId.replace('codenames_join_', '');
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

        const gameUrl = `${baseUrl}/codenames?${params.toString()}`;

        // Reply with a clickable link — ephemeral so only the clicking user sees it
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('🚀 Open Game')
                    .setStyle(ButtonStyle.Link)
                    .setURL(gameUrl)
            );

        await interaction.reply({
            content: `Your game link is ready! Click below to join:`,
            components: [row],
            ephemeral: true
        });
    }
};
