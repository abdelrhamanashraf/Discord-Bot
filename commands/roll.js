const { EmbedBuilder } = require('discord.js');

async function handleRollCommand(interaction) {
    const numbersArg = interaction.options.getString('numbers');
    const namesArg = interaction.options.getString('names');

    let result;
    let description;
    let color;
    let thumbnail;
    let title;
    let footerText;

    // If no arguments provided, default to dice
    if (!numbersArg && !namesArg) {
        result = Math.floor(Math.random() * 6) + 1;
        color = '#5865F2';
        thumbnail = 'https://png.pngtree.com/png-clipart/20230819/original/pngtree-red-design-dice-icon-picture-image_8043729.png';
        title = '🎲 Dice Roll';
        description = `**You rolled a ${result}!**`;
        footerText = 'Try /roll numbers:1-100 for a custom range!';
    } else if (numbersArg) {
        if (numbersArg.toLowerCase() === 'dice') {
            result = Math.floor(Math.random() * 6) + 1;
            color = '#5865F2';
            thumbnail = 'https://png.pngtree.com/png-clipart/20230819/original/pngtree-red-design-dice-icon-picture-image_8043729.png';
            title = '🎲 Dice Roll';
            description = `**You rolled a ${result}!**`;
            footerText = 'Try /roll numbers:1-100 for a custom range!';
        } else {
            const [min, max] = numbersArg.split('-').map(Number);
            if (isNaN(min) || isNaN(max) || min >= max) {
                return interaction.reply({ content: 'Invalid range. Please provide a valid range like `1-100`.', ephemeral: true });
            }
            result = Math.floor(Math.random() * (max - min + 1)) + min;
            color = '#5865F2';
            thumbnail = 'https://images.dwncdn.net/images/t_app-icon-l/p/d07213dc-cadb-11e8-97a8-02420a00091a/1262880248/31711_4-78088057-logo';
            title = '🔢 Random Number';
            description = `**You got a random number: ${result}!**`;
            footerText = 'Try /roll numbers:dice for a dice roll!';
        }
    } else if (namesArg) {
        if (namesArg.toLowerCase() === 'coin') {
            result = Math.random() < 0.5 ? 'Heads' : 'Tails';
            color = '#5865F2';
            thumbnail = 'https://w7.pngwing.com/pngs/479/691/png-transparent-coin-flipping-coin-flipper-android-flippers-game-logo-sign-thumbnail.png';
            title = '🪙 Coin Toss';
            description = `**You flipped a coin and got: ${result}!**`;
            footerText = 'Try /roll names:John,Mary,Alex for a random name!';
        } else {
            const nameList = namesArg.split(',').map(name => name.trim());
            if (nameList.length < 2) {
                return interaction.reply({ content: 'Please provide at least two names separated by commas.', ephemeral: true });
            }
            result = nameList[Math.floor(Math.random() * nameList.length)];
            color = '#5865F2';
            thumbnail = 'https://images.dwncdn.net/images/t_app-icon-l/p/d07213dc-cadb-11e8-97a8-02420a00091a/1262880248/31711_4-78088057-logo';
            title = '🎉 Random Name';
            description = `**The chosen name is: ${result}!**`;
            footerText = 'Try /roll names:coin for a coin toss!';
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setThumbnail(thumbnail)
        .setFooter({ text: footerText, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

// Export as a command object that index.js can use
module.exports = {
    name: 'roll',
    description: 'Roll dice, flip coins, or pick random names/numbers',
    execute: async function(interaction) {
        return handleRollCommand(interaction);
    }
};