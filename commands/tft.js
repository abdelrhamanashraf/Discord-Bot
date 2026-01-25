const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const Canvas = require('canvas');

// --- CACHE & CONFIG ---
let DDRAGON_VER = '14.23.1';
let TFT_SET = '16';

const REGIONS = [
    { name: 'EUNE', value: 'eun1', cluster: 'europe' },
    { name: 'EUW', value: 'euw1', cluster: 'europe' },
    { name: 'NA', value: 'na1', cluster: 'americas' },
];

// Asset Cache
const ASSET_CACHE = {
    champions: {},
    traits: {},
    items: {},
    augments: {},
    initialized: false
};

// Initialize Data Dragon
async function initDataDragon() {
    if (ASSET_CACHE.initialized) return;

    try {
        console.log('[TFT] Initializing Data Dragon...');
        const verRes = await axios.get('https://ddragon.leagueoflegends.com/api/versions.json');
        DDRAGON_VER = verRes.data[0];
        console.log(`[TFT] Version: ${DDRAGON_VER}`);

        const baseDataUrl = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VER}/data/en_US`;

        const [champRes, traitRes, itemRes, augRes] = await Promise.all([
            axios.get(`${baseDataUrl}/tft-champion.json`).catch(e => ({ data: { data: {} } })),
            axios.get(`${baseDataUrl}/tft-trait.json`).catch(e => ({ data: { data: {} } })),
            axios.get(`${baseDataUrl}/tft-item.json`).catch(e => ({ data: { data: {} } })),
            axios.get(`${baseDataUrl}/tft-augment.json`).catch(e => ({ data: { data: {} } }))
        ]);

        // Index Champions
        for (const [id, data] of Object.entries(champRes.data.data)) ASSET_CACHE.champions[id] = data.image;

        // Index Traits
        for (const [id, data] of Object.entries(traitRes.data.data)) {
            ASSET_CACHE.traits[id] = data.image;
            ASSET_CACHE.traits[id.toLowerCase()] = data.image;
            const shortName = data.name.toLowerCase();
            if (!ASSET_CACHE.traits[shortName]) ASSET_CACHE.traits[shortName] = data.image;
        }

        // Index Items
        for (const [id, data] of Object.entries(itemRes.data.data)) {
            ASSET_CACHE.items[id] = data.image;
        }

        // Index Augments
        for (const [id, data] of Object.entries(augRes.data.data)) {
            ASSET_CACHE.augments[id] = data.image;
        }

        ASSET_CACHE.initialized = true;

    } catch (e) {
        console.error('[TFT] Failed to init DataDragon:', e.message);
    }
}

// --- HELPER CLASS ---
class RiotAPI {
    constructor(apiKey, region) {
        this.apiKey = apiKey;
        this.region = region;
        this.cluster = REGIONS.find(r => r.value === region)?.cluster || 'europe';
        this.headers = { 'X-Riot-Token': this.apiKey };
    }
    async getAccount(name, tag) {
        const url = `https://${this.cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${name}/${tag}`;
        return (await axios.get(url, { headers: this.headers })).data;
    }
    async getSummoner(puuid) {
        const url = `https://${this.region}.api.riotgames.com/tft/summoner/v1/summoners/by-puuid/${puuid}`;
        return (await axios.get(url, { headers: this.headers })).data;
    }
    async getLeagueEntry(puuid) {
        const url = `https://${this.region}.api.riotgames.com/tft/league/v1/by-puuid/${puuid}`;
        return (await axios.get(url, { headers: this.headers })).data;
    }
    async getMatchIds(puuid, count = 10) {
        const url = `https://${this.cluster}.api.riotgames.com/tft/match/v1/matches/by-puuid/${puuid}/ids?count=${count}`;
        return (await axios.get(url, { headers: this.headers })).data;
    }
    async getMatch(matchId) {
        const url = `https://${this.cluster}.api.riotgames.com/tft/match/v1/matches/${matchId}`;
        return (await axios.get(url, { headers: this.headers })).data;
    }
}

// --- CANVAS GENERATOR ---
async function generateMatchImage(match, participant) {
    if (!ASSET_CACHE.initialized) await initDataDragon();

    // Widen canvas to prevent overflow
    const width = 1100;
    const height = 550;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // --- 1. Background ---
    const grd = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, 800);
    grd.addColorStop(0, '#1a1c2e');
    grd.addColorStop(1, '#050505');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);

    // --- 2. Header Info ---
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 5;

    // Placement
    const winColor = '#FFD700'; // Gold
    const loseColor = '#888';
    const isWin = participant.placement <= 4;

    ctx.fillStyle = isWin ? winColor : '#fff';
    ctx.font = 'bold 50px Sans';
    ctx.fillText(`#${participant.placement}`, 40, 70);

    ctx.fillStyle = '#ccc';
    ctx.font = '24px Sans';
    ctx.fillText(participant.placement === 1 ? 'VICTORY' : 'PLACEMENT', 110, 70);

    // Stats Line
    ctx.font = '22px Sans';
    ctx.fillStyle = '#b0b0b0';
    let infoX = 40;
    ctx.fillText(`Lvl ${participant.level}`, infoX, 110);
    infoX += 100;
    ctx.fillText(`Gold: ${participant.gold_left}`, infoX, 110);
    infoX += 120;
    ctx.fillText(`Set: ${TFT_SET}`, infoX, 110);
    infoX += 100;
    ctx.fillText(`Mode: ${match.info.tft_set_core_name || 'Standard'}`, infoX, 110);

    // NOTE: Hextech Augments section removed - Riot API no longer provides augment data (as of Nov 2024)

    ctx.shadowBlur = 0;

    // --- 4. Champions ---
    const startY = 160;
    let x = 40;
    const iconSize = 80;
    const gap = 20;

    for (const unit of participant.units) {
        const charId = unit.character_id; // e.g. "TFT11_Kobuko"

        // Resolve Image URL
        let imageUrl = '';
        if (ASSET_CACHE.champions[charId]) {
            imageUrl = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VER}/img/tft-champion/${ASSET_CACHE.champions[charId].full}`;
        } else {
            // Fallback 1: Standard LoL
            const cleanName = charId.split('_').pop();
            imageUrl = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VER}/img/champion/${cleanName}.png`;
        }

        // Draw Champ
        let imageLoaded = false;
        try {
            const img = await Canvas.loadImage(imageUrl);
            drawChampIcon(ctx, img, x, startY, iconSize);
            imageLoaded = true;
        } catch (e) {
            // Fallback 2: Community Dragon for TFT exclusives
            try {
                const lowerId = charId.toLowerCase();
                // URL: /hud/{id}_square.tft_set{set}.png
                const cdUrl = `https://raw.communitydragon.org/latest/game/assets/characters/${lowerId}/hud/${lowerId}_square.tft_set${TFT_SET}.png`;
                const img = await Canvas.loadImage(cdUrl);
                drawChampIcon(ctx, img, x, startY, iconSize);
                imageLoaded = true;
            } catch (e2) {
                // Final Fallback Box
                ctx.fillStyle = '#222';
                ctx.fillRect(x, startY, iconSize, iconSize);
                ctx.fillStyle = '#fff';
                ctx.font = '12px Sans';
                ctx.fillText(charId.substring(0, 5), x + 5, startY + 40);
            }
        }

        // Rarity Border
        const rarityColors = [
            '#a0a0a0', // 0 - Gray
            '#11b288', // 1 - Green
            '#0077ff', // 2 - Blue
            '#c440da', // 3 - Purple
            '#c440da', // 4 - Gold
            '#ffb93b', // 5 - Gold
            '#ffb93b', // 6 - Gold
            '#ffb93b'  // 7 - Gold
        ];

        ctx.strokeStyle = rarityColors[unit.rarity] || '#fff';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, startY, iconSize, iconSize);

        // Star Level
        if (unit.tier > 1) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(x, startY, iconSize, 24);

            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 18px Sans';
            ctx.textAlign = 'center';
            const starStr = '★'.repeat(unit.tier);
            ctx.fillText(starStr, x + (iconSize / 2), startY + 18);
            ctx.textAlign = 'left';
        }

        // Items
        if (unit.itemNames && unit.itemNames.length > 0) {
            const itemSize = 22;
            let itemX = x + (iconSize / 2) - ((unit.itemNames.length * itemSize) / 2); // Center items
            const itemY = startY + iconSize - (itemSize / 2);

            for (const item of unit.itemNames) {
                const itemUrl = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VER}/img/tft-item/${item}.png`;
                try {
                    const iImg = await Canvas.loadImage(itemUrl);
                    ctx.drawImage(iImg, itemX, itemY, itemSize, itemSize);
                    ctx.strokeStyle = '#222';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(itemX, itemY, itemSize, itemSize);
                } catch (e) {
                    ctx.fillStyle = '#999';
                    ctx.fillRect(itemX, itemY, itemSize, itemSize);
                }
                itemX += itemSize + 2;
            }
        }

        x += iconSize + gap;
    }

    // --- 5. Traits ---
    const traitY = 380;
    ctx.fillStyle = '#a0a0a0';
    ctx.font = '20px Sans';
    ctx.fillText('Active Traits:', 40, 350);

    x = 40;
    const activeTraits = participant.traits.filter(t => t.tier_current > 0).sort((a, b) => b.style - a.style);

    for (const trait of activeTraits) {
        // 0: None, 1: Bronze, 2: Silver, 3: Gold, 4: Prismatic
        const styleColors = ['#111', '#cd7f32', '#c0c0c0', '#ffd700', '#56f0f5'];
        const traitColor = styleColors[trait.style] || '#333';

        // Prepare Asset
        let traitKey = trait.name;
        let traitUrl = '';

        if (ASSET_CACHE.traits[traitKey]) traitUrl = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VER}/img/tft-trait/${ASSET_CACHE.traits[traitKey].full}`;
        else if (ASSET_CACHE.traits[traitKey.toLowerCase()]) traitUrl = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VER}/img/tft-trait/${ASSET_CACHE.traits[traitKey.toLowerCase()].full}`;
        else traitUrl = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VER}/img/tft-trait/${trait.name}.png`;

        const boxSize = 40;

        // Glow for Prismatic
        if (trait.style === 4) {
            ctx.shadowColor = "#00FFFF";
            ctx.shadowBlur = 15;
        } else if (trait.style === 3) {
            ctx.shadowColor = "#FFD700";
            ctx.shadowBlur = 10;
        }

        // Draw Hexagonish Shape
        ctx.fillStyle = traitColor;
        drawFlatHex(ctx, x + boxSize / 2, traitY + boxSize / 2, boxSize / 2 + 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner Black Hex
        ctx.fillStyle = '#111';
        drawFlatHex(ctx, x + boxSize / 2, traitY + boxSize / 2, boxSize / 2 - 2);
        ctx.fill();

        // Trait Icon
        if (traitUrl) {
            try {
                const tImg = await Canvas.loadImage(traitUrl);
                ctx.drawImage(tImg, x + 8, traitY + 8, boxSize - 16, boxSize - 16);
            } catch (e) { }
        }

        // Number badge
        ctx.font = 'bold 12px Sans';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeText(trait.num_units, x + boxSize - 5, traitY + boxSize + 5);
        ctx.fillText(trait.num_units, x + boxSize - 5, traitY + boxSize + 5);

        // Trait Name
        ctx.font = '12px Sans';
        ctx.fillStyle = '#ddd';
        const displayName = trait.name.split('_').pop().substring(0, 9);
        ctx.textAlign = 'center';
        ctx.fillText(displayName, x + boxSize / 2, traitY + boxSize + 22);
        ctx.textAlign = 'left';

        x += 55;
    }

    return canvas.toBuffer();
}

function drawChampIcon(ctx, img, x, y, size) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 8);
    ctx.clip();
    ctx.drawImage(img, x, y, size, size);
    ctx.restore();
}

function drawFlatHex(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        ctx.lineTo(x + r * Math.cos(i * 2 * Math.PI / 6), y + r * Math.sin(i * 2 * Math.PI / 6));
    }
    ctx.closePath();
}

// --- COMMAND ---
module.exports = {
    name: 'tft',
    description: 'Get TFT Profile and Match History',
    async execute(interaction) {
        await interaction.deferReply();

        if (!ASSET_CACHE.initialized) await initDataDragon();

        const summonerName = interaction.options.getString('summoner');
        const tagLine = interaction.options.getString('tag');
        const apiKey = process.env.TFT_API_KEY || process.env.RIOT_API_KEY;
        const region = interaction.options.getString('region');

        if (!apiKey) {
            return interaction.editReply({ content: '❌ **Error**: API Key not provided via command or .env' });
        }

        const riot = new RiotAPI(apiKey, region);

        try {
            // 1. Fetch Data
            const account = await riot.getAccount(summonerName, tagLine);
            const summoner = await riot.getSummoner(account.puuid);
            const leagueEntries = await riot.getLeagueEntry(account.puuid);
            const league = leagueEntries.length > 0 ? leagueEntries[0] : null;
            const matchIds = await riot.getMatchIds(account.puuid, 10);

            // 2. Build Profile Embed
            const rankString = league
                ? `${league.tier} ${league.rank} - ${league.leaguePoints} LP`
                : 'Unranked';

            const winRate = league ? Math.round((league.wins / (league.wins + league.losses)) * 100) : 0;

            const profileEmbed = new EmbedBuilder()
                .setTitle(`${account.gameName}#${account.tagLine} - TFT Profile`)
                .setDescription(`Region: ${region.toUpperCase()}`)
                .setThumbnail(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VER}/img/profileicon/${summoner.profileIconId}.png`)
                .addFields(
                    { name: 'Rank', value: rankString, inline: true },
                    { name: 'Level', value: `${summoner.summonerLevel}`, inline: true },
                    { name: 'Winrate', value: `${winRate}% (${league?.wins || 0}W / ${league?.losses || 0}L)`, inline: true }
                )
                .setColor(0x0099FF)
                .setFooter({ text: 'Powered by Riot API' });

            // Initial Menu
            const getMainMenu = () => new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('tft_nav')
                    .setPlaceholder('Select an option')
                    .addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Match History')
                            .setValue('view_history')
                            .setDescription('View recent match summary')
                            .setEmoji('📜')
                    )
            );

            const response = await interaction.editReply({
                embeds: [profileEmbed],
                components: [getMainMenu()]
            });

            // 4. Collector
            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 600000
            });

            let userMatchesData = [];

            collector.on('collect', async i => {
                const selection = i.values[0];
                await i.deferUpdate();

                if (selection === 'view_profile') {
                    await i.editReply({ embeds: [profileEmbed], components: [getMainMenu()], files: [] });
                }
                else if (selection === 'view_history') {
                    if (userMatchesData.length === 0) {
                        try {
                            const recentMatchIds = matchIds.slice(0, 5);
                            userMatchesData = await Promise.all(recentMatchIds.map(id => riot.getMatch(id)));
                        } catch (err) {
                            console.error("Error fetching match history details:", err);
                            await i.editReply({ content: "Error fetching match data. Please try again." });
                            return;
                        }
                    }

                    const historyEmbed = new EmbedBuilder()
                        .setTitle(`${account.gameName}#${account.tagLine} - Match History`)
                        .setDescription('Select a specific match below for detailed view.')
                        .setColor(0x0099FF);

                    userMatchesData.forEach((match, index) => {
                        const participant = match.info.participants.find(p => p.puuid === account.puuid);
                        const placement = participant.placement;
                        const isWin = placement <= 4;
                        const icon = isWin ? '✅' : '❌';
                        const mode = match.info.tft_set_core_name || 'TFT';
                        const date = new Date(match.info.game_datetime).toLocaleDateString();

                        historyEmbed.addFields({
                            name: `${icon} Match ${index + 1} (${date})`,
                            value: `**Placement:** #${placement} ${isWin ? '(Top 4)' : ''}\n**Mode:** ${mode}\n**Level:** ${participant.level}`,
                            inline: false
                        });
                    });

                    const historyMenu = new StringSelectMenuBuilder()
                        .setCustomId('tft_nav')
                        .setPlaceholder('Select a match to view details')
                        .addOptions(
                            new StringSelectMenuOptionBuilder()
                                .setLabel('Back to Profile')
                                .setValue('view_profile')
                                .setEmoji('👤')
                        );

                    userMatchesData.forEach((match, index) => {
                        const participant = match.info.participants.find(p => p.puuid === account.puuid);
                        const matchId = match.metadata.match_id;
                        const placement = participant.placement;

                        historyMenu.addOptions(
                            new StringSelectMenuOptionBuilder()
                                .setLabel(`Match ${index + 1} (Place #${placement})`)
                                .setValue(`match_${matchId}`)
                                .setDescription(`View full details for Match ${index + 1}`)
                                .setEmoji('🎮')
                        );
                    });

                    await i.editReply({ embeds: [historyEmbed], components: [new ActionRowBuilder().addComponents(historyMenu)], files: [] });
                }
                else if (selection.startsWith('match_')) {
                    const matchId = selection.replace('match_', '');
                    const matchData = userMatchesData.find(m => m.metadata.match_id === matchId);

                    if (!matchData) {
                        await i.editReply({ content: 'Match data not found in cache.' });
                        return;
                    }

                    try {
                        const participant = matchData.info.participants.find(p => p.puuid === account.puuid);
                        const buffer = await generateMatchImage(matchData, participant);
                        const attachment = new AttachmentBuilder(buffer, { name: 'match-details.png' });

                        const matchEmbed = new EmbedBuilder()
                            .setTitle(`Match Details - ${new Date(matchData.info.game_datetime).toLocaleString()}`)
                            .setDescription(`Placement: **#${participant.placement}**\nLevel: ${participant.level}\nAvg Rank: ${matchData.info.tft_set_core_name || 'TFT'}`)
                            .setImage('attachment://match-details.png')
                            .setColor(participant.placement === 1 ? 0xFFD700 : 0x0099FF);

                        const detailMenu = new StringSelectMenuBuilder()
                            .setCustomId('tft_nav')
                            .setPlaceholder('Navigation')
                            .addOptions(
                                new StringSelectMenuOptionBuilder()
                                    .setLabel('Back to Match History')
                                    .setValue('view_history')
                                    .setEmoji('📜'),
                                new StringSelectMenuOptionBuilder()
                                    .setLabel('Back to Profile')
                                    .setValue('view_profile')
                                    .setEmoji('👤')
                            );

                        await i.editReply({ embeds: [matchEmbed], components: [new ActionRowBuilder().addComponents(detailMenu)], files: [attachment] });

                    } catch (err) {
                        console.error(err);
                        await i.editReply({ content: `Error loading match details: ${err.message}`, embeds: [], files: [] });
                    }
                }
            });

        } catch (error) {
            console.error('TFT Command Error:', error);
            if (error.response && error.response.status === 403) {
                await interaction.editReply({ content: '❌ **API Key Error**: The provided key is invalid or expired.' });
            } else if (error.response && error.response.status === 404) {
                await interaction.editReply({ content: '❌ **Not Found**: Could not find Summoner or Match data.' });
            } else {
                await interaction.editReply({ content: `❌ Error: ${error.message}` });
            }
        }
    }
};
