const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Import the color and thumbnail constants
const COLORS = {
    HELP: '#9B59B6',    // Purple
};

const THUMBNAILS = {
    HELP: 'https://cdn-icons-png.freepik.com/256/7498/7498864.png?semt=ais_hybrid', // Help icon
};

// Export the help command function
module.exports = {
    name: 'help',
    description: 'Show all available commands',
    execute: async function (interaction) {
        // Group 1: Utilities (AI, Notes, Reminder, Upload, Wishlist, WhatsApp)
        const embed1 = new EmbedBuilder()
            .setTitle('🤖 Bot Commands - Part 1: Utilities')
            .setDescription('Essential tools and utilities.')
            .setColor(COLORS.HELP)
            .setThumbnail(THUMBNAILS.HELP)
            .addFields(
                {
                    name: '🤖 AI Chat',
                    value: '`/chat [message] [model] [private]`\nChat with models like Sonar Pro, Gemini, etc.',
                    inline: false
                },
                {
                    name: '📝 Notes',
                    value: '`/mynotes`\nView, add & manage your personal notes.',
                    inline: true
                },
                {
                    name: '⏰ Reminders',
                    value: '`/remind [msg] [time] [unit]`\n`/zakerny [msg] [num] [unit]`\n`/clear-zakerny`',
                    inline: true
                },
                {
                    name: '🕌 Prayer Times',
                    value: '`/prayer-subscribe [city] [country]`\n`/prayer-unsubscribe`',
                    inline: true
                },
                {
                    name: '📤 File Upload',
                    value: '`/upload [provider]`\nUpload files to Gofile, Fileq, etc.',
                    inline: true
                },
                {
                    name: '✨ Wishlist',
                    value: '`/wishlist`\nView saved Movies, Books, Games, etc.',
                    inline: true
                },
                {
                    name: '🔐 Leak Check',
                    value: '`/leakcheck [email]`\nCheck if an email has been leaked.',
                    inline: true
                },
                {
                    name: '🔗 Invite QR',
                    value: '`/invite`\nGenerate a QR code for a Discord invite.',
                    inline: true
                },
                {
                    name: '📱 WhatsApp',
                    value: '`/whatsapp connect`\n`/whatsapp send`\n`/whatsapp schedule`\n`/whatsapp contacts/groups`\nAuto-reply enabled.',
                    inline: false
                }
            );

        // Group 2: Entertainment (League, Steam, Anime, Movies, Books, Trivia, Fun)
        const embed2 = new EmbedBuilder()
            .setTitle('🎮 Bot Commands - Part 2: Entertainment')
            .setDescription('Games, Movies, and Fun.')
            .setColor('#E67E22') // Orange
            .addFields(
                {
                    name: '🎮 League of Legends',
                    value: '`/summoner-profile [name] [tag] [region]`\nView Profile, History, and Mastery.',
                    inline: false
                },
                {
                    name: '🎮 Steam Games',
                    value: '`/steam-top`\n`/steam-search [query]`\n`/steam-genre [genre]`',
                    inline: true
                },
                {
                    name: '🎮 Free Games',
                    value: '`/freenotify subscribe`\n`/freenotify status`',
                    inline: true
                },
                {
                    name: '🎬 Anime',
                    value: '`/anime-current`\n`/anime-search [query]`\n`/anime-top`\n`/anime-season [year] [season]`',
                    inline: false
                },
                {
                    name: '🎥 Movies & TV',
                    value: '`/movie-trending`\n`/movie-search [query]`\n`/series-trending`\n`/series-search [query]`',
                    inline: true
                },
                {
                    name: '📚 Books',
                    value: '`/book-search [query]`\nSearch books & add to wishlist.',
                    inline: true
                },
                {
                    name: '🎯 Trivia',
                    value: '`/trivia [questions] [category] [difficulty]`\n`/webtrivia` — browser multiplayer trivia',
                    inline: true
                },
                {
                    name: '🕹️ Codenames',
                    value: '`/codenames`\nStart a Codenames-style word spy game.',
                    inline: true
                },
                {
                    name: '🎲 Fun & Quotes',
                    value: '`/roll [numbers/names]`\n`/vote [question] [options]`\n`/quote-of-the-day`\n`/movie-random`',
                    inline: true
                },
                {
                    name: '🎮 Valorant',
                    value: '`/valorant profile [name] [tag]`\n`/valorant leaderboard [region]`',
                    inline: true
                },
                {
                    name: '♟️ TFT',
                    value: '`/tft [summoner] [tag] [region]`\nProfile & match history.',
                    inline: true
                }
            )
            .setFooter({
                text: 'Made with ❤️ by Abdelrhman'
            })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('GitHub')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://github.com/abdelrhamanashraf`)
            ).addComponents(
                new ButtonBuilder()
                    .setLabel('LinkedIn')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://www.linkedin.com/in/abdelrahman-ashraf-a10070222/`)
            );

        // Send both embeds
        await interaction.reply({ embeds: [embed1, embed2], components: [row], ephemeral: true });
    }
};