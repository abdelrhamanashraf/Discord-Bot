const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const notesFile = path.join(dataDir, 'notes.json');

// Initialize or load notes
let notes = {};
try {
    notes = JSON.parse(fs.readFileSync(notesFile, 'utf8'));
} catch (error) {
    notes = {};
    fs.writeFileSync(notesFile, JSON.stringify(notes, null, 2));
}

function saveNotes() {
    fs.writeFileSync(notesFile, JSON.stringify(notes, null, 2));
}

function createNoteId(userId, title) {
    return `${userId}-${title}`;
}

function getUserNotes(userId) {
    return Object.entries(notes)
        .filter(([noteId, note]) => note.userId === userId)
        .map(([noteId, note]) => ({
            id: noteId,
            ...note
        }));
}

async function handleNoteCommand(interaction) {
    const title = interaction.options.getString('title');
    const content = interaction.options.getString('content');
    const saveToChannel = interaction.options.getBoolean('save_to_channel') || false;

    const noteId = createNoteId(interaction.user.id, title);
    notes[noteId] = {
        title,
        content,
        userId: interaction.user.id,
        createdAt: new Date().toISOString(),
        author: interaction.user.username
    };

    saveNotes();

    if (saveToChannel) {
        const noteEmbed = new EmbedBuilder()
            .setTitle('📝 Note Saved')
            .setDescription(`**${title}**\n\n${content}`)
            .setColor('#2ECC71')
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/2232/2232688.png')
            .setFooter({ text: `Note created by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.channel.send({ embeds: [noteEmbed] });
    }

    await interaction.reply({ content: `Note "${title}" has been saved!`, ephemeral: true });
}

async function handleGetNotesCommand(interaction) {
    const userNotes = getUserNotes(interaction.user.id);

    if (userNotes.length === 0) {
        return interaction.reply({ content: 'You have no saved notes!', ephemeral: true });
    }

    const notesPerPage = 5;
    const pages = Math.ceil(userNotes.length / notesPerPage);
    let currentPage = 0;

    const getNotesEmbed = (page) => {
        const start = page * notesPerPage;
        const end = start + notesPerPage;
        const pageNotes = userNotes.slice(start, end);

        const embed = new EmbedBuilder()
            .setTitle('📝 Your Notes')
            .setColor('#2ECC71')
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/2232/2232688.png')
            .setFooter({ text: `Page ${page + 1}/${pages} • Total Notes: ${userNotes.length}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        pageNotes.forEach(note => {
            embed.addFields({ name: note.title, value: note.content });
        });

        return embed;
    };

    const navigationRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('prev_page')
                .setLabel('◀️ Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('next_page')
                .setLabel('Next ▶️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(pages <= 1)
        );

    const message = await interaction.reply({ 
        embeds: [getNotesEmbed(currentPage)], 
        components: [navigationRow],
        ephemeral: true 
    });

    const collector = message.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
            return i.reply({ content: 'This interaction is not for you!', ephemeral: true });
        }

        if (i.customId === 'prev_page' && currentPage > 0) {
            currentPage--;
        } else if (i.customId === 'next_page' && currentPage < pages - 1) {
            currentPage++;
        }

        navigationRow.components[0].setDisabled(currentPage === 0);
        navigationRow.components[1].setDisabled(currentPage === pages - 1);

        await i.update({ embeds: [getNotesEmbed(currentPage)], components: [navigationRow] });
    });

    collector.on('end', () => {
        navigationRow.components.forEach(button => button.setDisabled(true));
        interaction.editReply({ components: [navigationRow] }).catch(console.error);
    });
}

async function handleGetNoteCommand(interaction) {
    const title = interaction.options.getString('title');
    const noteId = createNoteId(interaction.user.id, title);
    const note = notes[noteId];

    if (!note) {
        return interaction.reply({ content: 'Note not found!', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setTitle('📝 Note Details')
        .setDescription(`**${note.title}**\n\n${note.content}`)
        .setColor('#2ECC71')
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/2232/2232688.png')
        .addFields(
            { name: 'Created At', value: new Date(note.createdAt).toLocaleString(), inline: true },
            { name: 'Author', value: note.author, inline: true }
        )
        .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`save_note_${noteId}`)
                .setLabel('Save to Channel')
                .setStyle(ButtonStyle.Success)
                .setEmoji('📌'),
            new ButtonBuilder()
                .setCustomId(`edit_note_${noteId}`)
                .setLabel('Edit')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✏️'),
            new ButtonBuilder()
                .setCustomId(`delete_note_${noteId}`)
                .setLabel('Delete')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️')
        );

    await interaction.reply({ embeds: [embed], components: [actionRow], ephemeral: true });
}

// Add this new function after the handleGetNoteCommand function
async function handleNoteButtons(interaction) {
    const customId = interaction.customId;
    console.log(`Handling note button: ${customId}`);
    
    // Handle different button actions based on customId format with underscores
    if (customId.startsWith('save_note_')) {
        const noteId = customId.replace('save_note_', '');
        return handleSaveToChannel(interaction, noteId);
    } 
    else if (customId.startsWith('edit_note_')) {
        const noteId = customId.replace('edit_note_', '');
        return handleEditNote(interaction, noteId);
    }
    else if (customId.startsWith('delete_note_')) {
        const noteId = customId.replace('delete_note_', '');
        return handleDeleteNote(interaction, noteId);
    }
    else if (customId.startsWith('confirm_delete_')) {
        const noteId = customId.replace('confirm_delete_', '');
        return confirmDeleteNote(interaction, noteId);
    }
    else if (customId === 'cancel_delete') {
        return interaction.update({ 
            content: 'Delete operation cancelled.', 
            components: [] 
        });
    }
    
    // Legacy format handling with colons (for backward compatibility)
    if (customId.includes(':')) {
        const [action, noteId] = customId.split(':');
        
        console.log(`Handling button with colon format: ${action} for note: ${noteId}`);
        
        if (action === 'save_note') {
            return handleSaveToChannel(interaction, noteId);
        } 
        else if (action === 'edit_note') {
            return handleEditNote(interaction, noteId);
        }
        else if (action === 'delete_note') {
            return handleDeleteNote(interaction, noteId);
        }
        else if (action === 'confirm_delete') {
            return confirmDeleteNote(interaction, noteId);
        }
    }
    
    return false; // Return false if no handler was found
}

// Now update the module.exports to use this centralized function
module.exports = [
    {
        name: 'note',
        description: 'Save a note',
        execute: async function(interaction) {
            return handleNoteCommand(interaction);
        },
        handleButton: async function(interaction) {
            return handleNoteButtons(interaction);
        }
    },
    {
        name: 'getnotes',
        description: 'View all your saved notes',
        execute: async function(interaction) {
            return handleGetNotesCommand(interaction);
        },
        handleButton: async function(interaction) {
            const customId = interaction.customId;
            
            // Handle pagination buttons
            if (customId === 'prev_page' || customId === 'next_page') {
                // The pagination is already handled in the collector in handleGetNotesCommand
                // No need to implement anything here as it's handled by the collector
            }
        }
    },
    {
        name: 'getnote',
        description: 'Retrieve a saved note',
        execute: async function(interaction) {
            return handleGetNoteCommand(interaction);
        },
        handleButton: async function(interaction) {
            return handleNoteButtons(interaction);
        },
        handleModal: async function(interaction) {
            // Keep the existing modal handler code
            if (interaction.customId.startsWith('edit_modal_')) {
                const noteId = interaction.customId.replace('edit_modal_', '');
                const note = notes[noteId];
                
                if (!note) {
                    return interaction.reply({ content: 'Note not found!', ephemeral: true });
                }
                
                const newTitle = interaction.fields.getTextInputValue('title');
                const newContent = interaction.fields.getTextInputValue('content');
                
                // If the title changed, we need to create a new note ID and delete the old one
                if (newTitle !== note.title) {
                    const newNoteId = createNoteId(interaction.user.id, newTitle);
                    
                    // Copy the note with new title and content
                    notes[newNoteId] = {
                        ...note,
                        title: newTitle,
                        content: newContent,
                        updatedAt: new Date().toISOString()
                    };
                    
                    // Delete the old note
                    delete notes[noteId];
                } else {
                    // Just update the content
                    note.content = newContent;
                    note.updatedAt = new Date().toISOString();
                }
                
                // Save the changes
                saveNotes();
                
                return interaction.reply({ 
                    content: `Note "${newTitle}" has been updated!`, 
                    ephemeral: true 
                });
            }
        }
    }
];

// Implement the button handler functions
async function handleSaveToChannel(interaction, noteId) {
    // Implementation for saving note to channel
    const note = notes[noteId];
    if (!note) {
        return interaction.reply({ content: 'Note not found!', ephemeral: true });
    }
    
    // Create an embed for the note
    const embed = new EmbedBuilder()
        .setTitle(note.title)
        .setDescription(note.content)
        .setColor('#2ECC71')
        .setFooter({ text: `Note by ${interaction.user.tag}` })
        .setTimestamp();
    
    // Send the note to the channel
    await interaction.channel.send({ embeds: [embed] });
    
    // Update the button interaction
    return interaction.update({ 
        content: 'Note has been posted to the channel!', 
        components: [] 
    });
}

// Implement the missing handleEditNote function based on index1.js
async function handleEditNote(interaction, noteId) {
    const note = notes[noteId];
    if (!note) {
        return interaction.reply({ content: 'Note not found!', ephemeral: true });
    }
    
    try {
        const modal = new ModalBuilder()
            .setCustomId(`edit_modal_${noteId}`)
            .setTitle('Edit Note');

        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setValue(note.title)
            .setRequired(true)
            .setMaxLength(100);

        const contentInput = new TextInputBuilder()
            .setCustomId('content')
            .setLabel('Content')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(note.content)
            .setRequired(true)
            .setMaxLength(4000);

        const firstRow = new ActionRowBuilder().addComponents(titleInput);
        const secondRow = new ActionRowBuilder().addComponents(contentInput);

        modal.addComponents(firstRow, secondRow);
        await interaction.showModal(modal);
    } catch (error) {
        console.error('Error showing edit modal:', error);
        await interaction.reply({ 
            content: 'Failed to open edit modal. Please try again later.',
            ephemeral: true
        });
    }
}

// Update the handleDeleteNote function to use consistent ID format
async function handleDeleteNote(interaction, noteId) {
    const note = notes[noteId];
    if (!note) {
        return interaction.reply({ content: 'Note not found!', ephemeral: true });
    }
    
    // Create confirmation buttons with consistent format using underscores
    const confirmRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_delete_${noteId}`)
                .setLabel('Confirm Delete')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️'),
            new ButtonBuilder()
                .setCustomId('cancel_delete')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌')
        );
    
    // Update the interaction with confirmation buttons
    return interaction.update({
        content: `Are you sure you want to delete the note "${note.title}"?`,
        components: [confirmRow]
    });
}

async function confirmDeleteNote(interaction, noteId) {
    // Implementation for confirming note deletion
    const note = notes[noteId];
    if (!note) {
        return interaction.reply({ content: 'Note not found!', ephemeral: true });
    }
    
    // Delete the note
    delete notes[noteId];
    saveNotes();
    
    // Update the interaction
    return interaction.update({
        content: `Note "${note.title}" has been deleted.`,
        components: []
    });
}