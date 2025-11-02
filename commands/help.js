const { EmbedBuilder } = require('discord.js');

// Import the color and thumbnail constants
const COLORS = {
    NOTE: '#2ECC71',    // Green
    VOTE: '#3498DB',    // Blue
    REMINDER: '#E74C3C', // Red
    HELP: '#9B59B6',    // Purple
    MOVIE: '#E50914'    // Netflix red
};

const THUMBNAILS = {
    HELP: 'https://cdn-icons-png.freepik.com/256/7498/7498864.png?semt=ais_hybrid', // Help icon
};

// Export the help command function
module.exports = {
    name: 'help',
    description: 'Show all available commands',
    execute: async function(interaction) {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🤖 Bot Commands')
            .setDescription('Here are all the available commands you can use:')
            .setColor(COLORS.HELP)
            .setThumbnail(THUMBNAILS.HELP)
            .addFields(
                { 
                    name: '🤖 AI Chat', 
                    value: '```/chat [message] [model] [private]\nChat with MeowAI using different models\nModels: Sonar pro, Gemini\nSet private:true for private responses```',
                    inline: false
                },
                { 
                    name: '📝 Notes', 
                    value: '```/note [title] [content] [save_to_channel]\nSave a note with optional channel posting\n\n/getnotes\nView all your saved notes\n\n/getnote [title]\nRetrieve a saved note```',
                    inline: false
                },
                { 
                    name: '🗳️ Voting', 
                    value: '```/vote [question] [options]\nCreate a poll with multiple options\nOptions should be comma-separated```',
                    inline: false
                },
                { 
                    name: '⏰ Reminders', 
                    value: '```/remind [message] [time] [unit]\nSet a reminder (mins, hours)\n\n/zakerny [message] [number] [unit]\nSet a recurring reminder (seconds/minutes/hours/days)\n\n/clear-zakerny\nStop your recurring reminder```',
                    inline: false
                },
                { 
                    name: '🕌 Prayer Times', 
                    value: '```/prayer-subscribe [city] [country] [timezone]\nSubscribe to daily prayer time notifications\n\n/prayer-unsubscribe\nUnsubscribe from prayer time notifications```',
                    inline: false
                },
                { 
                    name: '🎮 Steam Games', 
                    value: '```/steam-top\nGet the top 10 most played games on Steam\n\n/steam-search [query]\nSearch for a game on Steam\n\n/steam-genre [genre]\nGet top-rated games by genre on Steam```',
                    inline: false
                },
                { 
                    name: '🎮 Game Notifications', 
                    value: '```/freenotify subscribe\nSubscribe to free game notifications\n\n/freenotify unsubscribe\nUnsubscribe from notifications\n\n/freenotify status\nCheck your subscription status```',
                    inline: false
                },
                {
                    name: '🎮 Riot Games',
                    value: '```/riot valorant-profile [username] [tag] [region]\nGet Valorant profile information\n\n/riot league-profile [summoner] [region]\nGet League of Legends profile information```',
                    inline: false
                },
                { 
                    name: '🎬 Anime Information', 
                    value: '```/anime-current\nGet a list of anime from the current season\n\n/anime-search [query]\nSearch for an anime by name\n\n/anime-top [genre]\nGet a list of top-rated anime, optionally filtered by genre\n\n/anime-season [year] [season]\nGet anime from a specific year and season```',
                    inline: false
                },
                {
                    name: '🎥 Movies & TV Series',
                    value: '```/movie-trending\nGet trending movies this week\n\n/series-trending\nGet trending TV series this week\n\n/movie-search [query]\nSearch for a movie by title\n\n/series-search [query]\nSearch for a TV series by title\n\n/movie-random\nGet a random movie recommendation```',
                    inline: false
                },
                { 
                    name: '🎯 Trivia Game', 
                    value: '```/trivia [questions] [category] [difficulty]\nPlay a trivia game with multiple-choice questions\n- Questions: 1-10\n- Categories: General, Books, Film, Music, TV, Games, Science, etc.\n- Difficulty: Easy, Medium, Hard```',
                    inline: false
                },
                { 
                    name: '🎲 Fun Commands', 
                    value: '```/roll [numbers] [names]\nRoll a dice, pick a random number, or toss a coin\nExamples:\n/roll numbers:dice - Roll a 6-sided dice\n/roll numbers:1-100 - Random number between 1-100\n/roll names:coin - Toss a coin\n/roll names:John,Mary,Alex - Pick a random name```',
                    inline: false
                }
            )
            .setFooter({ 
                text: `Requested by ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();
        
        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    }
};