const axios = require('axios');
const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    SlashCommandBuilder
} = require('discord.js');

const API_KEY = process.env.HENRIK_API_KEY;
const API_BASE = 'https://api.henrikdev.xyz';

const apiClient = axios.create({
    baseURL: API_BASE,
    headers: {
        'Authorization': API_KEY,
        'User-Agent': 'MeowAI-Valorant-Bot'
    }
});
module.exports = {
    name: "valorant",
    description: "Valorant stats and match history",
    options: [
        {
            name: "profile",
            description: "Get player profile stats and rank",
            type: 1, // SUB_COMMAND
            options: [
                { name: "name", type: 3, description: "Riot Name", required: true },
                { name: "tag", type: 3, description: "Riot Tag", required: true }
            ]
        },

        {
            name: "leaderboard",
            description: "Get top 5 players in a region",
            type: 1, // SUB_COMMAND
            options: [
                {
                    name: "region",
                    type: 3,
                    description: "Region",
                    required: true,
                    choices: [
                        { name: "EU", value: "eu" },
                        { name: "NA", value: "na" },
                        { name: "AP", value: "ap" },
                        { name: "KR", value: "kr" },
                        { name: "LATAM", value: "latam" },
                        { name: "BR", value: "br" }
                    ]
                }
            ]
        }
    ],

    execute: async (interaction) => {
        const subCommand = interaction.options.getSubcommand();

        if (subCommand === 'profile') {
            await handleProfile(interaction);
        } else if (subCommand === 'leaderboard') {
            await handleLeaderboard(interaction);
        }
    },

    // Export query handlers so they can be reused if needed, 
    // though for select menu we'll use a specific handler function exported below.
    handleSelectMenu: async (interaction) => {
        if (!interaction.customId.startsWith('val_match_')) return;

        await interaction.deferReply();

        // Format: region:matchId:name:tag
        const matchId = interaction.values[0];

        const parts = matchId.split(':');
        const region = parts[0];
        const realMatchId = parts[1];
        const playerName = parts[2]; // Passed for highlighting
        const playerTag = parts[3];

        try {
            const response = await apiClient.get(`/valorant/v2/match/${realMatchId}`);
            const match = response.data.data;

            const player = match.players.all_players.find(p =>
                p.name.toLowerCase() === playerName.toLowerCase() &&
                p.tag.toLowerCase() === playerTag.toLowerCase()
            );

            const embed = new EmbedBuilder()
                .setTitle(`Match Details: ${match.metadata.map}`)
                .setDescription(`Mode: ${match.metadata.mode} | Region: ${match.metadata.region.toUpperCase()}`)
                .addFields(
                    { name: 'Score', value: `${match.teams.blue.rounds_won} - ${match.teams.red.rounds_won}`, inline: true },
                    { name: 'Duration', value: `${(match.metadata.game_length / 60).toFixed(0)} mins`, inline: true },
                    { name: 'Date', value: `<t:${Math.floor(match.metadata.game_start)}:R>`, inline: true }
                );

            if (player) {
                const kda = `${player.stats.kills}/${player.stats.deaths}/${player.stats.assists}`;
                const agent = player.character;
                const hsp = ((player.stats.headshots / (player.stats.bodyshots + player.stats.headshots + player.stats.legshots)) * 100).toFixed(1);

                embed.addFields(
                    { name: 'Your Agent', value: agent, inline: true },
                    { name: 'K/D/A', value: kda, inline: true },
                    { name: 'HS%', value: `${hsp}%`, inline: true },
                    { name: 'ADR', value: `${(player.damage_made / match.metadata.rounds_played).toFixed(0)}`, inline: true },
                    { name: 'Score', value: `${player.stats.score}`, inline: true }
                );
                embed.setThumbnail(player.assets.agent.small);

                // Color based on win
                const team = player.team.toLowerCase();
                const winningTeam = match.teams.red.has_won ? 'red' : 'blue';
                embed.setColor(team === winningTeam ? 'Green' : 'Red');
            } else {
                embed.setColor('Blue');
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'Failed to fetch match details.', ephemeral: true });
        }
    }
};

async function handleProfile(interaction) {
    await interaction.deferReply();
    const name = interaction.options.getString('name');
    const tag = interaction.options.getString('tag');

    try {
        // 1. Get Account Data
        const accountReq = await apiClient.get(`/valorant/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
        const account = accountReq.data.data;
        const region = account.region;

        // 2. Try Get MMR (Rank)
        let rank = 'Unknown';
        let elo = 'N/A';

        try {
            const mmrRes = await apiClient.get(`/valorant/v3/mmr/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
            rank = mmrRes.data.data.current_data.currenttierpatched || 'Unranked';
            elo = mmrRes.data.data.elo || 0;
        } catch (mmrError) {
            console.log(`MMR fetch failed for ${name}#${tag}, trying fallback to match history.`);
        }

        // 3. Get Match History (Last 5)
        let matches = [];
        const matchOptions = [];

        try {
            const matchesRes = await apiClient.get(`/valorant/v3/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
            matches = matchesRes.data.data.slice(0, 5);

            if (matches.length > 0) {
                // FALLBACK RANK LOGIC
                if (rank === 'Unknown' || rank === 'Unranked') {
                    const meInMatch = matches[0].players.all_players.find(p =>
                        p.name.toLowerCase() === name.toLowerCase() &&
                        p.tag.toLowerCase() === tag.toLowerCase()
                    );
                    if (meInMatch && meInMatch.currenttier_patched) {
                        rank = meInMatch.currenttier_patched;
                        console.log(`Fallback rank found: ${rank}`);
                    }
                }

                // Build Match Options for Select Menu
                matches.forEach((match) => {
                    const player = match.players.all_players.find(p =>
                        p.name.toLowerCase() === name.toLowerCase() &&
                        p.tag.toLowerCase() === tag.toLowerCase()
                    );

                    const agent = player ? player.character : 'Unknown';
                    const kda = player ? `${player.stats.kills}/${player.stats.deaths}/${player.stats.assists}` : 'N/A';
                    const map = match.metadata.map;

                    // Safe check for result
                    let result = 'N/A';
                    if (player && match.teams && player.team && match.teams[player.team.toLowerCase()]) {
                        result = match.teams[player.team.toLowerCase()].has_won ? 'WIN' : 'LOSS';
                    } else if (match.metadata.mode === 'Deathmatch' && player) { result = 'N/A'; }
                    matchOptions.push({
                        label: `${map} - ${agent} (${kda})`,
                        description: `${result} - ${match.metadata.game_start_patched}`,
                        value: `${region}:${match.metadata.matchid}:${name}:${tag}`
                    });
                });
            }

        } catch (matchError) {
            console.error('Match history fetch failed:', matchError.message);
        }

        const embed = new EmbedBuilder()
            .setTitle(`${account.name}#${account.tag}`)
            .setThumbnail(account.card.small)
            .addFields(
                { name: 'Level', value: `${account.account_level}`, inline: true },
                { name: 'Region', value: region.toUpperCase(), inline: true },
                { name: 'Rank', value: rank, inline: true },
                { name: 'Elo', value: `${elo}`, inline: true }
            )
            .setColor('Red')
            .setFooter({ text: `Last Initialized: ${account.last_update}` });

        const components = [];
        if (matchOptions.length > 0) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('val_match_history_select')
                        .setPlaceholder('Select a match for details')
                        .addOptions(matchOptions)
                );
            components.push(row);
        }

        await interaction.editReply({ embeds: [embed], components: components });

    } catch (error) {
        console.error(error);
        if (error.response && error.response.status === 404) {
            await interaction.editReply(`Player ${name}#${tag} not found. Make sure the name and tag are correct.`);
        } else {
            await interaction.editReply(`Error fetching profile: ${error.message}`);
        }
    }
}

async function handleLeaderboard(interaction) {
    await interaction.deferReply();
    const region = interaction.options.getString('region');

    try {
        const lbRes = await apiClient.get(`/valorant/v3/leaderboard/${region}/pc`);
        // Handle different response structures
        let leaderboard = [];
        if (lbRes.data && lbRes.data.data && Array.isArray(lbRes.data.data.players)) {
            leaderboard = lbRes.data.data.players;
        } else if (lbRes.data && Array.isArray(lbRes.data.data)) {
            // Fallback for some other potential structure or v2
            leaderboard = lbRes.data.data;
        } else if (Array.isArray(lbRes.data)) {
            leaderboard = lbRes.data;
        }

        leaderboard = leaderboard.slice(0, 5);

        const embed = new EmbedBuilder()
            .setTitle(`Top 5 Players - ${region.toUpperCase()}`)
            .setColor('Gold');

        leaderboard.forEach((player, index) => {
            const rank = player.leaderboard_rank;
            const name = player.name || player.gameName; // Fallback
            const tag = player.tag || player.tagLine;   // Fallback
            const rr = player.rr || player.rankedRating; // Fallback
            const wins = player.wins || player.numberOfWins; // Fallback

            embed.addFields({
                name: `#${rank} ${name}#${tag}`,
                value: `Rating: ${rr}RR | Wins: ${wins}`,
                inline: false
            });
        });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error(error);
        await interaction.editReply(`Error fetching leaderboard: ${error.message}`);
    }
}
