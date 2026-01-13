const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { getWishlist } = require('../utils/wishlistManager');

async function execute(interaction) {
    const userId = interaction.user.id;
    const wishlist = getWishlist(userId);

    // Check if wishlist is empty or has no keys
    if (!wishlist || Object.keys(wishlist).length === 0 || Object.values(wishlist).every(arr => arr.length === 0)) {
        return interaction.reply({ content: 'Your wishlist is empty!', ephemeral: true });
    }

    // Create category select menu
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('wishlist_select')
        .setPlaceholder('Select a category to view')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Movies')
                .setValue('movies')
                .setEmoji({ name: '🎬' }),
            new StringSelectMenuOptionBuilder()
                .setLabel('Series')
                .setValue('series')
                .setEmoji({ name: '📺' }),
            new StringSelectMenuOptionBuilder()
                .setLabel('Anime')
                .setValue('anime')
                .setEmoji({ name: '⛩️' }),
            new StringSelectMenuOptionBuilder()
                .setLabel('Books')
                .setValue('books')
                .setEmoji({ name: '📚' }),
            new StringSelectMenuOptionBuilder()
                .setLabel('Games')
                .setValue('games')
                .setEmoji({ name: '🎮' })
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setTitle('Your Wishlist')
        .setDescription('Select a category from the menu below to view your saved items.')
        .setColor('#FF0000');

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleSelectMenu(interaction) {
    if (interaction.customId !== 'wishlist_select') return;

    const category = interaction.values[0];
    const userId = interaction.user.id;
    const wishlist = getWishlist(userId);
    const items = wishlist[category];

    if (!items || items.length === 0) {
        return interaction.reply({ content: `You have no items in your ${category} wishlist.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setTitle(`Your ${category.charAt(0).toUpperCase() + category.slice(1)} Wishlist`)
        .setColor('#0099ff');

    // Simple list for now. If it gets too long, we might need pagination.
    // Discord embed description limit is 4096 chars.
    let description = '';
    items.forEach((item, index) => {
        const title = item.title || item.name || 'Unknown Title';
        const date = item.release_date || item.first_publish_year || 'N/A';
        const score = item.vote_average ? `⭐ ${item.vote_average}` : '';

        // Try to make a link if we have an ID
        let link = '';
        if (category === 'movies') link = `https://www.themoviedb.org/movie/${item.id}`;
        else if (category === 'series') link = `https://www.themoviedb.org/tv/${item.id}`;
        else if (category === 'anime') link = `https://myanimelist.net/anime/${item.id}`;
        else if (category === 'books') link = `https://openlibrary.org${item.id}`; // item.id is /works/OL...
        else if (category === 'games') link = `https://store.steampowered.com/app/${item.id}`;
        let kLink = '';
        const gaurl = item.title.split(' ').join('+');
        const aurl = item.title.split(' ').join('%20');
        if (category === 'books') kLink = `https://libgen.li/index.php?req=${gaurl}`;
        else if (category === 'games') kLink = `https://game3rb.com/?s=${gaurl}`;
        else if (category === 'anime') kLink = `https://witanime.day/?search_param=animes&s=${gaurl}`;
        else if (category === 'movies') kLink = `https://flixer.sh/search?q=${aurl}`;
        else if (category === 'series') kLink = `https://flixer.sh/search?q=${aurl}`;
        description += `**${index + 1}. ${title}**\n`;
        if (date !== 'N/A') description += `📅 ${date} `;
        if (score) description += `${score}`;
        if (link) description += ` | [View](${link}) `;
        if (kLink) description += ` | [View to download](${kLink}) `;
        description += '\n\n';
    });

    embed.setDescription(description.substring(0, 4096));

    // Update the message with the list. 
    // We keep the menu so they can switch categories easily.
    await interaction.update({ embeds: [embed] });
}

module.exports = {
    name: 'wishlist',
    description: 'View your wishlist',
    execute,
    handleSelectMenu
};
