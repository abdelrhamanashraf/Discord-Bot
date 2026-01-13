const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder
} = require('discord.js');
const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
require('dotenv').config();

const RIOT_API_KEY = process.env.RIOT_API_KEY;

// --- Config & Helpers ---
const regionToCluster = {
    'na1': 'americas', 'br1': 'americas', 'la1': 'americas', 'la2': 'americas',
    'euw1': 'europe', 'eun1': 'europe', 'tr1': 'europe', 'ru': 'europe',
    'kr': 'asia', 'jp1': 'asia', 'ph2': 'asia', 'sg2': 'asia', 'tw2': 'asia', 'th2': 'asia', 'vn2': 'asia',
    'oc1': 'sea'
};

const resolveCluster = (region) => regionToCluster[region.toLowerCase()] || 'americas';

// Cache Data Dragon version
let ddragonVersion = '15.24.1';
let championMap = {};
let itemMap = {};
let runeMap = {};
let spellMap = {};
let lastDDragonUpdate = 0;

async function updateDataDragon() {
    const now = Date.now();
    if (now - lastDDragonUpdate < 3600000 && Object.keys(championMap).length > 0) return; // Cache for 1 hour

    try {
        const vRes = await axios.get("https://ddragon.leagueoflegends.com/api/versions.json");
        ddragonVersion = vRes.data[0];

        const [cRes, iRes, rRes, sRes] = await Promise.all([
            axios.get(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/champion.json`),
            axios.get(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/item.json`),
            axios.get(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/runesReforged.json`),
            axios.get(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/summoner.json`)
        ]);

        // Champions
        championMap = {};
        const champs = cRes.data.data;
        for (const name in champs) championMap[champs[name].key] = champs[name];

        // Items
        itemMap = iRes.data.data; // Key is Item ID

        // Runes (Tree structure)
        runeMap = {};
        rRes.data.forEach(tree => {
            runeMap[tree.id] = { name: tree.name, icon: tree.icon }; // Primary/Sub Tree
            tree.slots.forEach(slot => {
                slot.runes.forEach(rune => {
                    runeMap[rune.id] = { name: rune.name, icon: rune.icon };
                });
            });
        });

        // Summoner Spells
        spellMap = {};
        const spells = sRes.data.data;
        for (const name in spells) spellMap[spells[name].key] = spells[name];

        lastDDragonUpdate = now;
        console.log(`[LoL Cmd] DD updated: v${ddragonVersion} | ${Object.keys(championMap).length} Ch, ${Object.keys(itemMap).length} It, ${Object.keys(runeMap).length} Ru, ${Object.keys(spellMap).length} Sp.`);
    } catch (e) {
        console.error("Failed to update Data Dragon:", e.message);
    }
}

// --- API Helpers ---
const headers = { 'X-Riot-Token': RIOT_API_KEY };

async function getAccount(name, tag, cluster) {
    const url = `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
    return (await axios.get(url, { headers })).data;
}

async function getSummoner(puuid, platform) {
    const url = `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
    return (await axios.get(url, { headers })).data;
}

async function getRank(summonerId, platform) {
    if (!summonerId) return null;
    try {
        const url = `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`;
        const res = await axios.get(url, { headers });
        return res.data;
    } catch (e) { return null; }
}

async function getMastery(puuid, platform, count = 10) {
    const url = `https://${platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=${count}`;
    return (await axios.get(url, { headers })).data;
}

async function getMatchIds(puuid, cluster, count = 5) {
    const url = `https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`;
    return (await axios.get(url, { headers })).data;
}

async function getMatchDetail(matchId, cluster) {
    const url = `https://${cluster}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
    return (await axios.get(url, { headers })).data;
}

// --- UI Generators ---

async function createProfileEmbed(account, summoner, rankData) {
    const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/profileicon/${summoner.profileIconId}.png`;

    let rankStr = "Unranked";
    if (rankData && rankData.length > 0) {
        // Prioritize Solo/Duo
        const solo = rankData.find(q => q.queueType === 'RANKED_SOLO_5x5');
        const flex = rankData.find(q => q.queueType === 'RANKED_FLEX_SR');
        const q = solo || flex || rankData[0];
        rankStr = `${q.tier} ${q.rank} (${q.leaguePoints} LP)`;
        if (queue = solo) rankStr = "Solo/Duo: " + rankStr;
        else if (queue = flex) rankStr = "Flex: " + rankStr;
    }

    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`${account.gameName} #${account.tagLine}`)
        .setThumbnail(iconUrl)
        .addFields(
            { name: 'Level', value: `${summoner.summonerLevel}`, inline: true },
            { name: 'Rank', value: rankStr, inline: true }
        )
        .setFooter({ text: 'League of Legends Profile', iconURL: 'https://i.imgur.com/4M34hi2.png' });

    return embed;
}

async function createMasteryListEmbed(masteryData, account) {
    const embed = new EmbedBuilder()
        .setColor(0xD4AF37)
        .setTitle(`Top Mastery: ${account.gameName} #${account.tagLine}`)
        .setDescription("Select a champion below for detailed stats.")
        .setThumbnail(account.profileIconId ? `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/profileicon/${account.profileIconId}.png` : null);

    masteryData.slice(0, 10).forEach((m, i) => {
        const champ = championMap[m.championId];
        const name = champ ? champ.name : `ID: ${m.championId}`;
        embed.addFields({
            name: `#${i + 1} ${name}`,
            value: `${m.championPoints.toLocaleString()} pts (Lvl ${m.championLevel})`,
            inline: true
        });
    });

    return embed;
}

async function createMasteryDetailEmbed(mastery, account) {
    const champ = championMap[mastery.championId];
    const name = champ ? champ.name : `ID: ${mastery.championId}`;
    const title = champ ? champ.title : "Unknown";

    // Calculate progress if needed, or just show points
    const embed = new EmbedBuilder()
        .setColor(0xD4AF37)
        .setTitle(`${name} - ${title}`)
        .setAuthor({ name: `${account.gameName} #${account.tagLine}`, iconURL: `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/profileicon/${account.profileIconId}.png` })
        .setDescription(`**Mastery Level ${mastery.championLevel}**`)
        .setThumbnail(champ ? `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${champ.id}.png` : null)
        .addFields(
            { name: 'Total Points', value: `${mastery.championPoints.toLocaleString()}`, inline: true },
            { name: 'Last Played', value: `<t:${Math.floor(mastery.lastPlayTime / 1000)}:R>`, inline: true },

        )
        .setImage(champ ? `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champ.id}_0.jpg` : null); // Splash art

    return embed;
}

async function createHistoryEmbed(matches, puuid) {
    const embed = new EmbedBuilder()
        .setColor(0x0ACDFF)
        .setTitle(`Recent Matches`)
        .setDescription("Select a match below for details.");

    for (const m of matches) {
        const info = m.info;
        const p = info.participants.find(p => p.puuid === puuid);
        const champ = championMap[p.championId] ? championMap[p.championId].name : p.championName;
        const result = p.win ? "✅ Victory" : "❌ Defeat";
        const mode = info.gameMode === "ARAM" ? "ARAM" : (info.queueId === 420 ? "Ranked Solo" : "Normals");

        embed.addFields({
            name: `${result} - ${champ} (${mode})`,
            value: `KDA: ${p.kills}/${p.deaths}/${p.assists} | CS: ${p.totalMinionsKilled + p.neutralMinionsKilled}`
        });
    }

    return embed;
}

async function createMatchDetailEmbed(match, puuid) {
    const info = match.info;
    const p = info.participants.find(part => part.puuid === puuid);
    const champ = championMap[p.championId] || { name: p.championName, id: p.championName };
    const result = p.win ? "Victory" : "Defeat";
    const color = p.win ? 0x00FF00 : 0xFF0000;

    // Runes
    const primaryStyle = runeMap[p.perks.styles[0].style]?.name || "Unknown";
    const subStyle = runeMap[p.perks.styles[1].style]?.name || "Unknown";
    const keyRuneId = p.perks.styles[0].selections[0].perk;
    const keyRune = runeMap[keyRuneId]; // { name, icon }

    // Spells
    const s1 = spellMap[p.summoner1Id]?.name || `Spell ${p.summoner1Id}`;
    const s2 = spellMap[p.summoner2Id]?.name || `Spell ${p.summoner2Id}`;

    // Items
    let itemNames = [];
    let itemUrls = [];
    for (let i = 0; i <= 6; i++) {
        const itemId = p[`item${i}`];
        if (itemId && itemId > 0) {
            itemNames.push(itemMap[itemId]?.name || `Item ${itemId}`);
            itemUrls.push(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/item/${itemId}.png`);
        }
    }
    const itemStr = itemNames.length > 0 ? itemNames.join(', ') : "None";

    // Canvas Merge
    let attachment = null;
    let imageUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champ.id}_0.jpg`; // Default

    if (itemUrls.length > 0) {
        try {
            const size = 64;
            const padding = 10;
            const width = (size * itemUrls.length) + (padding * (itemUrls.length - 1));
            const height = size;
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            for (let i = 0; i < itemUrls.length; i++) {
                const img = await loadImage(itemUrls[i]);
                ctx.drawImage(img, i * (size + padding), 0, size, size);
            }

            attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'items.png' });
            imageUrl = 'attachment://items.png';
        } catch (e) {
            console.error("Canvas merge failed:", e);
        }
    }

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${result} - ${champ.name}`)
        .setDescription(`**Mode**: ${info.gameMode} | **Duration**: ${Math.floor(info.gameDuration / 60)}m ${info.gameDuration % 60}s`)
        .setThumbnail(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${champ.id}.png`)
        .setAuthor({
            name: `${p.summonerName} - ${result}`,
            iconURL: keyRune ? `https://ddragon.leagueoflegends.com/cdn/img/${keyRune.icon}` : undefined
        })
        .setImage(imageUrl)
        .addFields(
            { name: 'K/D/A', value: `${p.kills}/${p.deaths}/${p.assists} (${((p.kills + p.assists) / Math.max(1, p.deaths)).toFixed(2)})`, inline: true },
            { name: 'Level', value: `${p.champLevel}`, inline: true },
            { name: 'CS', value: `${p.totalMinionsKilled + p.neutralMinionsKilled}`, inline: true },
            { name: 'Damage', value: `${p.totalDamageDealtToChampions.toLocaleString()}`, inline: true },
            { name: 'Gold', value: `${p.goldEarned.toLocaleString()}`, inline: true },
            { name: 'Vision', value: `${p.visionScore}`, inline: true },
            { name: 'Runes', value: `**${primaryStyle}** (${keyRune?.name || '?'}) / **${subStyle}**`, inline: false },
            { name: 'Spells', value: `${s1}, ${s2}`, inline: true },
            { name: 'Items', value: itemStr, inline: false },
        );

    return { embed, attachment };
}


// --- Main Export ---
module.exports = {
    name: 'summoner-profile',
    data: new SlashCommandBuilder()
        .setName('summoner-profile')
        .setDescription('League of Legends Summoner Profile & History')
        .addStringOption(option =>
            option.setName('name').setDescription('Riot ID Game Name').setRequired(true))
        .addStringOption(option =>
            option.setName('tag').setDescription('Riot ID Tag Line').setRequired(true))
        .addStringOption(option =>
            option.setName('region').setDescription('Region (e.g. EUW1, NA1)').setRequired(false)
                .addChoices(
                    { name: 'EU West', value: 'euw1' },
                    { name: 'EU Nordic & East', value: 'eun1' },
                    { name: 'North America', value: 'na1' },
                    { name: 'Korea', value: 'kr' },
                    { name: 'Brazil', value: 'br1' }
                )),

    async execute(interaction) {
        await interaction.deferReply();
        await updateDataDragon();

        const name = interaction.options.getString('name');
        const tag = interaction.options.getString('tag');
        const region = (interaction.options.getString('region') || 'eun1').toLowerCase();
        const cluster = resolveCluster(region);

        try {
            // 1. Fetch Account
            const account = await getAccount(name, tag, cluster);
            // 2. Fetch Summoner
            const summoner = await getSummoner(account.puuid, region);
            // 3. (Try) Fetch Rank
            const rank = await getRank(summoner.id, region);

            const embed = await createProfileEmbed(account, summoner, rank);

            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`sumprof:menu:${account.puuid}:${region}`)
                        .setPlaceholder('Select an option')
                        .addOptions(
                            { label: 'Match History', value: 'history', description: 'Last 5 matches', emoji: '📜' },
                            { label: 'Top Mastery', value: 'mastery', description: 'Top 10 Champions', emoji: '🏆' }
                        )
                );

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error(error);
            const msg = error.response?.status === 404 ? "User not found." : "Error fetching data.";
            await interaction.editReply({ content: msg, embeds: [] });
        }
    },

    // Handle Select Menus
    async handleSelectMenu(interaction) {
        // ID format: sumprof_menu_PUUID_REGION
        const parts = interaction.customId.split(':');
        const type = parts[1]; // menu, match
        const puuid = parts[2];
        const region = parts[3];
        const cluster = resolveCluster(region);

        await interaction.deferUpdate();
        await updateDataDragon();

        if (type === 'menu') {
            const selection = interaction.values[0];

            if (selection === 'mastery') {
                const account = { gameName: 'User', tagLine: '...' }; // We might lose name context here, can refetch account if vital or just ignore title name. 
                // To keep it fast, let's just show stats. Or fetch account again (fast).
                const acc = await axios.get(`https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-puuid/${puuid}`, { headers }).then(r => r.data);

                const mastery = await getMastery(puuid, region, 25); // Fetch top 25 for selection
                const embed = await createMasteryListEmbed(mastery, acc);

                const select = new StringSelectMenuBuilder()
                    .setCustomId(`sumprof:masel:${puuid}:${region}`) // masel = mastery select
                    .setPlaceholder('Select a Champion');

                mastery.slice(0, 25).forEach((m, i) => {
                    const champ = championMap[m.championId];
                    if (champ) {
                        select.addOptions({
                            label: `${i + 1}. ${champ.name}`,
                            value: m.championId.toString(),
                            description: `${m.championPoints.toLocaleString()} pts`,
                            emoji: '🏆'
                        });
                    }
                });

                // Back Button
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`sumprof:back:${puuid}:${region}`).setLabel('Back to Profile').setStyle(ButtonStyle.Secondary)
                );
                const rowSelect = new ActionRowBuilder().addComponents(select);

                await interaction.editReply({ embeds: [embed], components: [rowSelect, row] });

            } else if (selection === 'history') {
                const ids = await getMatchIds(puuid, cluster);
                const matches = [];
                for (const id of ids) {
                    matches.push(await getMatchDetail(id, cluster));
                }
                const embed = await createHistoryEmbed(matches, puuid);

                const select = new StringSelectMenuBuilder()
                    .setCustomId(`sumprof:match:${puuid}:${region}`)
                    .setPlaceholder('Select a match for details');

                matches.forEach((m, i) => {
                    const info = m.info;
                    const p = info.participants.find(p => p.puuid === puuid);
                    const champ = championMap[p.championId]?.name || p.championName;
                    select.addOptions({
                        label: `${p.win ? 'W' : 'L'} - ${champ} (${info.gameMode})`,
                        value: m.metadata.matchId,
                        description: `${info.gameCreation}`.substring(0, 10) // timestamp
                    });
                });

                const row = new ActionRowBuilder().addComponents(select);
                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`sumprof:back:${puuid}:${region}`).setLabel('Back').setStyle(ButtonStyle.Secondary)
                );

                await interaction.editReply({ embeds: [embed], components: [row, row2] });
            }
        } // end type=menu

        else if (type === 'match') {
            const matchId = interaction.values[0];
            const match = await getMatchDetail(matchId, cluster);
            const { embed, attachment } = await createMatchDetailEmbed(match, puuid);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`sumprof:hist:${puuid}:${region}`).setLabel('Back to History').setStyle(ButtonStyle.Secondary)
            );

            await interaction.editReply({ embeds: [embed], components: [row], files: attachment ? [attachment] : [] });
        }
        else if (type === 'masel') { // Mastery Select
            const champId = interaction.values[0];
            const acc = await axios.get(`https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-puuid/${puuid}`, { headers }).then(r => r.data);

            // Fetch specific champion mastery (or reuse getMastery list if API valid, but specific endpoint is cleaner)
            const url = `https://${region}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/by-champion/${champId}`;
            const mRes = await axios.get(url, { headers });
            const m = mRes.data;

            const embed = await createMasteryDetailEmbed(m, acc);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`sumprof:mastery:${puuid}:${region}`).setLabel('Back to List').setStyle(ButtonStyle.Secondary)
            );
            await interaction.editReply({ embeds: [embed], components: [row] });
        }
    },

    // Handle Buttons (Back)
    async handleButton(interaction) {
        const parts = interaction.customId.split(':');
        const action = parts[1]; // back, hist
        const puuid = parts[2];
        const region = parts[3];
        const cluster = resolveCluster(region);

        await interaction.deferUpdate();
        await updateDataDragon();

        if (action === 'back') {
            // Re-show Profile
            const acc = await axios.get(`https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-puuid/${puuid}`, { headers }).then(r => r.data);
            const summoner = await getSummoner(puuid, region);
            const rank = await getRank(summoner.id, region);
            const embed = await createProfileEmbed(acc, summoner, rank);

            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`sumprof:menu:${puuid}:${region}`)
                        .setPlaceholder('Select an option')
                        .addOptions(
                            { label: 'Match History', value: 'history', description: 'Last 5 matches', emoji: '📜' },
                            { label: 'Top Mastery', value: 'mastery', description: 'Top 10 Champions', emoji: '🏆' }
                        )
                );
            await interaction.editReply({ embeds: [embed], components: [row] });
        }
        else if (action === 'hist') {
            // Re-show History
            const ids = await getMatchIds(puuid, cluster);
            const matches = [];
            for (const id of ids) {
                matches.push(await getMatchDetail(id, cluster));
            }
            const embed = await createHistoryEmbed(matches, puuid);

            const select = new StringSelectMenuBuilder()
                .setCustomId(`sumprof:match:${puuid}:${region}`)
                .setPlaceholder('Select a match for details');

            matches.forEach((m, i) => {
                const info = m.info;
                const p = info.participants.find(p => p.puuid === puuid);
                const champ = championMap[p.championId]?.name || p.championName;
                select.addOptions({
                    label: `${p.win ? 'W' : 'L'} - ${champ} (${info.gameMode})`,
                    value: m.metadata.matchId,
                    description: `KDA: ${p.kills}/${p.deaths}/${p.assists}`
                });
            });

            const row = new ActionRowBuilder().addComponents(select);
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`sumprof:back:${puuid}:${region}`).setLabel('Back').setStyle(ButtonStyle.Secondary)
            );

            await interaction.editReply({ embeds: [embed], components: [row, row2] });
        }
        else if (action === 'mastery') {
            // Go back to Mastery List
            const acc = await axios.get(`https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-puuid/${puuid}`, { headers }).then(r => r.data);
            const mastery = await getMastery(puuid, region, 25);
            const embed = await createMasteryListEmbed(mastery, acc);

            const select = new StringSelectMenuBuilder()
                .setCustomId(`sumprof:masel:${puuid}:${region}`)
                .setPlaceholder('Select a Champion');

            mastery.slice(0, 25).forEach((m, i) => {
                const champ = championMap[m.championId];
                if (champ) {
                    select.addOptions({
                        label: `${i + 1}. ${champ.name}`,
                        value: m.championId.toString(),
                        description: `${m.championPoints.toLocaleString()} pts`,
                        emoji: '🏆'
                    });
                }
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`sumprof:back:${puuid}:${region}`).setLabel('Back to Profile').setStyle(ButtonStyle.Secondary)
            );
            const rowSelect = new ActionRowBuilder().addComponents(select);

            await interaction.editReply({ embeds: [embed], components: [rowSelect, row] });
        }
    }
};
