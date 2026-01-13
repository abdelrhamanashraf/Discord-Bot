const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

async function handleQuoteOfTheDay(interaction) {
    await interaction.deferReply();

    try {
        // 1. Fetch Coffee Image
        let coffeeImage = 'https://coffee.alexflipnote.dev/random'; // Default fallback
        try {
            const coffeeResponse = await axios.get('https://coffee.alexflipnote.dev/random.json');
            if (coffeeResponse.data && coffeeResponse.data.file) {
                coffeeImage = coffeeResponse.data.file;
            }
        } catch (error) {
            console.error('Error fetching coffee image:', error.message);
        }

        // 2. Fetch Quote (Randomly select from pool of providers)
        let quoteData = null;

        // Define quote providers
        const providers = [
            // ZenQuotes
            async () => {
                const response = await axios.get('https://zenquotes.io/api/random');
                if (response.data && response.data[0]) {
                    return {
                        content: response.data[0].q,
                        author: response.data[0].a,
                        source: 'ZenQuotes'
                    };
                }
                throw new Error('Invalid ZenQuotes response');
            },
            // Game of Thrones
            async () => {
                const response = await axios.get('https://api.gameofthronesquotes.xyz/v1/random');
                if (response.data && response.data.sentence) {
                    return {
                        content: response.data.sentence,
                        author: response.data.character.name,
                        source: 'Game of Thrones'
                    };
                }
                throw new Error('Invalid GoT response');
            },
            // Animechan (kept as requested, though noted as unreliable)
            async () => {
                const response = await axios.get('https://api.animechan.io/v1/quotes/random');
                if (response.data) {
                    return {
                        content: response.data.data.content,
                        author: response.data.data.character.name,
                        source: response.data.data.anime.name
                    }
                }
                throw new Error('Invalid Animechan response');
            }
        ];

        // Shuffle providers to randomize source
        const shuffledProviders = providers.sort(() => Math.random() - 0.5);

        // Try providers one by one until success
        for (const provider of shuffledProviders) {
            try {
                quoteData = await provider();
                break; // Success!
            } catch (err) {
                console.log(`Provider failed, trying next... (${err.message})`);
                continue;
            }
        }

        // Fallback if all fail
        if (!quoteData) {
            quoteData = {
                content: 'Life is like coffee, the darker it gets, the more it energizes you.',
                author: 'Unknown',
                source: 'Coffee Wisdom'
            };
        }

        // 3. Create Stylish Embed
        const embed = new EmbedBuilder()
            .setTitle('☕ Quote of the Day')
            .setDescription(`*"${quoteData.content}"*`)
            .setColor('#6f4e37') // Coffee brown color
            .setImage(coffeeImage)
            .addFields(
                { name: 'Author', value: quoteData.author, inline: true },
                { name: 'Source', value: quoteData.source, inline: true }
            )
            .setFooter({ text: 'Powered by Coffee & Quotes', iconURL: 'https://emojigraph.org/media/apple/hot-beverage_2615.png' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Critical error in quote-of-the-day:', error);
        await interaction.editReply('Sorry, I spilled the coffee! Something went wrong while fetching your quote.');
    }
}

module.exports = [
    {
        name: 'quote-of-the-day',
        description: 'Get a random quote with a nice cup of coffee',
        execute: handleQuoteOfTheDay
    }
];
