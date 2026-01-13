const axios = require("axios");
const { EmbedBuilder } = require("discord.js");

async function checkLeak(interaction) {
    const query = interaction.options.getString('email');
    if (!query) {
        return new EmbedBuilder()
            .setTitle('Leak Check')
            .setDescription('Please provide an email or username to check.')
            .setColor('Red');
    }

    const url = `https://leakcheck.io/api/public?check=${encodeURIComponent(query)}`;

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'NodeJS-Leak-Check'
            }
        });

        const data = response.data;

        if (data.success) {
            const embed = new EmbedBuilder()
                .setTitle('Leak Check')
                .setDescription(`⚠️ Breaches found for ${query}:`)
                .setColor('Red');

            if (Array.isArray(data.sources)) {
                // Limit fields to 25 to avoid Discord API errors
                const sources = data.sources.slice(0, 25);
                const fields = sources.map(source => ({
                    name: source.name || 'Unknown Source',
                    value: `Date: ${source.date || 'Unknown'}`,
                    inline: true
                }));

                embed.addFields(fields);

                if (data.sources.length > 25) {
                    embed.setFooter({ text: `...and ${data.sources.length - 25} more sources.` });
                }
            }
            return embed;
        } else {
            return new EmbedBuilder()
                .setTitle('Leak Check')
                .setDescription(`✅ Good news! No leaks found for ${query}.`)
                .setColor('Green');
        }

    } catch (error) {
        if (error.response && error.response.status === 429) {
            return new EmbedBuilder()
                .setTitle('Leak Check')
                .setDescription('Rate limit exceeded. You are limited to 1,000 queries per day.')
                .setColor('Red');
        }

        console.error('Leakcheck error:', error.message);
        return new EmbedBuilder()
            .setTitle('Leak Check')
            .setDescription(`Error: ${error.message || 'Unknown error occurred'}`)
            .setColor('Red');
    }
}

module.exports = {
    name: "leakcheck",
    description: "Check if an email has been leaked",
    options: [
        {
            name: "email",
            type: 3, // STRING
            description: "The email to check or username",
            required: true
        }
    ],
    execute: async (interaction) => {
        // Defer reply since API calls can take time
        await interaction.deferReply();
        const embed = await checkLeak(interaction);
        await interaction.editReply({ embeds: [embed] });
    }
}

