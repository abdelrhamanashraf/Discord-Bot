const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function handleVoteCommand(interaction) {
    const question = interaction.options.getString('question');
    const options = interaction.options.getString('options').split(',').map(option => option.trim());
    
    if (options.length < 2) {
        return interaction.reply({ content: 'Please provide at least two options separated by commas.', ephemeral: true });
    }
    
    if (options.length > 10) {
        return interaction.reply({ content: 'You can only have up to 10 options.', ephemeral: true });
    }
    
    // Create the vote embed
    const embed = new EmbedBuilder()
        .setTitle('📊 ' + question)
        .setDescription('Vote by clicking the buttons below!')
        .setColor('#FF5733')
        .setFooter({ text: `Poll created by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
    
    // Add fields for each option with 0 votes initially
    options.forEach((option, index) => {
        embed.addFields({ name: `Option ${index + 1}: ${option}`, value: '0 votes', inline: true });
    });
    
    // Create buttons for voting
    const rows = [];
    let currentRow = new ActionRowBuilder();
    
    options.forEach((option, index) => {
        if (index > 0 && index % 5 === 0) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }
        
        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`vote_${index}`)
                .setLabel(`${index + 1}`)
                .setStyle(ButtonStyle.Primary)
        );
    });
    
    rows.push(currentRow);
    
    // Add a row with end poll button for the creator
    const controlRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('end_poll')
                .setLabel('End Poll')
                .setStyle(ButtonStyle.Danger)
        );
    
    rows.push(controlRow);
    
    // Store the votes
    const votes = new Map();
    options.forEach((_, index) => {
        votes.set(index, 0);
    });
    
    // Send the initial message
    const message = await interaction.reply({ embeds: [embed], components: rows, fetchReply: true });
    
    // Create a collector for the buttons
    const collector = message.createMessageComponentCollector({ time: 10 * 60 * 1000 }); // 10 minutes
    
    // Track who has voted
    const voters = new Set();
    
    collector.on('collect', async i => {
        // Handle end poll button
        if (i.customId === 'end_poll') {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Only the poll creator can end the poll.', ephemeral: true });
            }
            
            collector.stop('ended by creator');
            return;
        }
        
        // Handle vote buttons
        const optionIndex = parseInt(i.customId.replace('vote_', ''));
        
        // Check if user has already voted
        if (voters.has(i.user.id)) {
            return i.reply({ content: 'You have already voted in this poll!', ephemeral: true });
        }
        
        // Record the vote
        votes.set(optionIndex, votes.get(optionIndex) + 1);
        voters.add(i.user.id);
        
        // Update the embed
        const updatedEmbed = EmbedBuilder.from(message.embeds[0]);
        
        options.forEach((option, index) => {
            const voteCount = votes.get(index);
            updatedEmbed.spliceFields(index, 1, { 
                name: `Option ${index + 1}: ${option}`, 
                value: `${voteCount} vote${voteCount !== 1 ? 's' : ''}`, 
                inline: true 
            });
        });
        
        await i.update({ embeds: [updatedEmbed] });
    });
    
    collector.on('end', async (_, reason) => {
        // Find the winning option(s)
        let maxVotes = 0;
        let winners = [];
        
        votes.forEach((count, index) => {
            if (count > maxVotes) {
                maxVotes = count;
                winners = [index];
            } else if (count === maxVotes) {
                winners.push(index);
            }
        });
        
        // Create the final embed
        const finalEmbed = EmbedBuilder.from(message.embeds[0]);
        
        // Update the description to show the poll has ended
        finalEmbed.setDescription('This poll has ended.');
        
        // Update the fields to show final vote counts and highlight winners
        options.forEach((option, index) => {
            const voteCount = votes.get(index);
            const isWinner = winners.includes(index);
            
            finalEmbed.spliceFields(index, 1, { 
                name: `Option ${index + 1}: ${option}${isWinner ? ' 👑' : ''}`, 
                value: `${voteCount} vote${voteCount !== 1 ? 's' : ''}`, 
                inline: true 
            });
        });
        
        // Add a field showing the winner(s)
        if (maxVotes > 0) {
            const winnerText = winners.length === 1 
                ? `Option ${winners[0] + 1}: ${options[winners[0]]}` 
                : `Tie between: ${winners.map(w => `Option ${w + 1}: ${options[w]}`).join(', ')}`;
            
            finalEmbed.addFields({ name: 'Winner', value: winnerText, inline: false });
        } else {
            finalEmbed.addFields({ name: 'Result', value: 'No votes were cast.', inline: false });
        }
        
        // Update the message with the final results and disable buttons
        await interaction.editReply({ embeds: [finalEmbed], components: [] });
    });
}

// Export as a command object that index.js can use
module.exports = {
    name: 'vote',
    description: 'Create a poll with multiple options',
    execute: async function(interaction) {
        return handleVoteCommand(interaction);
    },
    handleButton: async function(interaction) {
        // Button handling is done within the collector in handleVoteCommand
        // This is just a placeholder to match the expected structure
    }
};