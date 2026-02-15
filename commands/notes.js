const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const notesFile = path.join(dataDir, 'notes.json');
const defaultThumbnail = 'https://cdn-icons-png.flaticon.com/512/2232/2232688.png';
const imageLIST = [
    'https://cdn.discordapp.com/attachments/1435289217122041937/1435289449708912680/saved2.png?ex=690b6cf7&is=690a1b77&hm=79bb4e6cc0121d310deafe29d062934038fe218caa8cfb62ce0514fc30c82426&',
    'https://cdn.discordapp.com/attachments/1435289217122041937/1435289451667394560/saved1.png?ex=690b6cf7&is=690a1b77&hm=20b527b756c5435d57b76c686f7046a36fe0d768d2a18cab6b6368e907d74608&',
    'https://cdn.discordapp.com/attachments/1435289217122041937/1435289450304372746/saved3.png?ex=690b6cf7&is=690a1b77&hm=4c37438d9c28e5f3eb97904c22218c308af02361bdea0c75969d9e0a787c8c94&',
];
const getRandomImage = () => imageLIST[Math.floor(Math.random() * imageLIST.length)];

// ── Data helpers ──────────────────────────────────────────────
let notes = {};
try {
    notes = JSON.parse(fs.readFileSync(notesFile, 'utf8'));
} catch {
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
        .filter(([, note]) => note.userId === userId)
        .map(([noteId, note]) => ({ id: noteId, ...note }));
}

// ── Embed builders ───────────────────────────────────────────
function buildMainEmbed(userNotes, user) {
    const embed = new EmbedBuilder()
        .setTitle('📝 My Notes')
        .setColor('#2ECC71')
        .setThumbnail(getRandomImage() || defaultThumbnail)
        .setFooter({ text: `${user.username}'s notebook`, iconURL: user.displayAvatarURL() })
        .setTimestamp();

    if (userNotes.length === 0) {
        embed.setDescription('You don\'t have any notes yet.\nClick **➕ Add Note** to create your first one!');
    } else {
        const list = userNotes.map((n, i) => {
            const preview = n.content.length > 60 ? n.content.substring(0, 60) + '…' : n.content;
            return `**${i + 1}.** ${n.title}\n> ${preview}`;
        }).join('\n\n');
        embed.setDescription(`You have **${userNotes.length}** note${userNotes.length > 1 ? 's' : ''}:\n\n${list}`);
    }

    return embed;
}

function buildNoteDetailEmbed(note, user) {
    return new EmbedBuilder()
        .setTitle(`📝 ${note.title}`)
        .setDescription(note.content)
        .setColor('#2ECC71')
        .setThumbnail(getRandomImage() || defaultThumbnail)
        .addFields(
            { name: 'Created', value: new Date(note.createdAt).toLocaleString(), inline: true },
            { name: 'Author', value: note.author, inline: true }
        )
        .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL() })
        .setTimestamp();
}

// ── Component builders ───────────────────────────────────────
function buildMainButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('notes_add')
            .setLabel('Add Note')
            .setStyle(ButtonStyle.Success)
            .setEmoji('➕'),
        new ButtonBuilder()
            .setCustomId('notes_manage')
            .setLabel('Manage Notes')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📋')
    );
}

function buildNoteActionRow(noteId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`notes_save_${noteId}`)
            .setLabel('Save to Channel')
            .setStyle(ButtonStyle.Success)
            .setEmoji('📌'),
        new ButtonBuilder()
            .setCustomId(`notes_edit_${noteId}`)
            .setLabel('Edit')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✏️'),
        new ButtonBuilder()
            .setCustomId(`notes_delete_${noteId}`)
            .setLabel('Delete')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),
        new ButtonBuilder()
            .setCustomId('notes_back')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('◀️')
    );
}

function buildManageSelectMenu(userNotes) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('notes_select')
        .setPlaceholder('Select a note to manage…')
        .addOptions(
            userNotes.slice(0, 25).map(n =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(n.title.substring(0, 100))
                    .setDescription(n.content.substring(0, 100))
                    .setValue(n.id)
            )
        );
    return new ActionRowBuilder().addComponents(menu);
}

// ── Core command ─────────────────────────────────────────────
async function execute(interaction) {
    const userNotes = getUserNotes(interaction.user.id);
    const embed = buildMainEmbed(userNotes, interaction.user);
    const buttons = buildMainButtons();

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}

// ── Button handler ───────────────────────────────────────────
async function handleButton(interaction) {
    const id = interaction.customId;

    // ── Add Note ──
    if (id === 'notes_add') {
        const modal = new ModalBuilder()
            .setCustomId('notes_add_modal')
            .setTitle('Create a New Note');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('title')
                    .setLabel('Title')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(100)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('content')
                    .setLabel('Content')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(4000)
            )
        );

        return interaction.showModal(modal);
    }

    // ── Manage Notes ──
    if (id === 'notes_manage') {
        const userNotes = getUserNotes(interaction.user.id);
        if (userNotes.length === 0) {
            return interaction.reply({ content: 'You have no notes to manage!', ephemeral: true });
        }

        const selectRow = buildManageSelectMenu(userNotes);
        const embed = new EmbedBuilder()
            .setTitle('📋 Manage Notes')
            .setDescription('Select a note from the menu below to view, edit, or delete it.')
            .setColor('#3498DB')
            .setFooter({ text: `${userNotes.length} note${userNotes.length > 1 ? 's' : ''} available` });

        return interaction.update({ embeds: [embed], components: [selectRow] });
    }

    // ── Back to main view ──
    if (id === 'notes_back') {
        const userNotes = getUserNotes(interaction.user.id);
        const embed = buildMainEmbed(userNotes, interaction.user);
        return interaction.update({ embeds: [embed], components: [buildMainButtons()] });
    }

    // ── Save to Channel ──
    if (id.startsWith('notes_save_')) {
        const noteId = id.replace('notes_save_', '');
        const note = notes[noteId];
        if (!note) return interaction.reply({ content: 'Note not found!', ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle(note.title)
            .setDescription(note.content)
            .setColor('#2ECC71')
            .setFooter({ text: `Note by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.channel.send({ embeds: [embed] });
        return interaction.update({ content: '📌 Note posted to the channel!', embeds: [], components: [] });
    }

    // ── Edit Note ──
    if (id.startsWith('notes_edit_')) {
        const noteId = id.replace('notes_edit_', '');
        const note = notes[noteId];
        if (!note) return interaction.reply({ content: 'Note not found!', ephemeral: true });

        const modal = new ModalBuilder()
            .setCustomId(`notes_edit_modal_${noteId}`)
            .setTitle('Edit Note');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('title')
                    .setLabel('Title')
                    .setStyle(TextInputStyle.Short)
                    .setValue(note.title)
                    .setRequired(true)
                    .setMaxLength(100)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('content')
                    .setLabel('Content')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(note.content)
                    .setRequired(true)
                    .setMaxLength(4000)
            )
        );

        return interaction.showModal(modal);
    }

    // ── Delete Note (confirmation) ──
    if (id.startsWith('notes_delete_')) {
        const noteId = id.replace('notes_delete_', '');
        const note = notes[noteId];
        if (!note) return interaction.reply({ content: 'Note not found!', ephemeral: true });

        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`notes_confirm_delete_${noteId}`)
                .setLabel('Confirm Delete')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️'),
            new ButtonBuilder()
                .setCustomId('notes_cancel_delete')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌')
        );

        return interaction.update({
            content: `Are you sure you want to delete **"${note.title}"**?`,
            embeds: [],
            components: [confirmRow]
        });
    }

    // ── Confirm Delete ──
    if (id.startsWith('notes_confirm_delete_')) {
        const noteId = id.replace('notes_confirm_delete_', '');
        const note = notes[noteId];
        if (!note) return interaction.reply({ content: 'Note not found!', ephemeral: true });

        const title = note.title;
        delete notes[noteId];
        saveNotes();

        // Return to main view after deletion
        const userNotes = getUserNotes(interaction.user.id);
        const embed = buildMainEmbed(userNotes, interaction.user);
        return interaction.update({ content: `🗑️ Note **"${title}"** deleted.`, embeds: [embed], components: [buildMainButtons()] });
    }

    // ── Cancel Delete ──
    if (id === 'notes_cancel_delete') {
        const userNotes = getUserNotes(interaction.user.id);
        const embed = buildMainEmbed(userNotes, interaction.user);
        return interaction.update({ content: null, embeds: [embed], components: [buildMainButtons()] });
    }

    return false;
}

// ── Select Menu handler ──────────────────────────────────────
async function handleSelectMenu(interaction) {
    if (interaction.customId !== 'notes_select') return;

    const noteId = interaction.values[0];
    const note = notes[noteId];
    if (!note) return interaction.reply({ content: 'Note not found!', ephemeral: true });

    const embed = buildNoteDetailEmbed(note, interaction.user);
    const actionRow = buildNoteActionRow(noteId);

    return interaction.update({ embeds: [embed], components: [actionRow] });
}

// ── Modal handler ────────────────────────────────────────────
async function handleModal(interaction) {
    const id = interaction.customId;

    // ── Add Note modal ──
    if (id === 'notes_add_modal') {
        const title = interaction.fields.getTextInputValue('title');
        const content = interaction.fields.getTextInputValue('content');

        const noteId = createNoteId(interaction.user.id, title);
        notes[noteId] = {
            title,
            content,
            userId: interaction.user.id,
            createdAt: new Date().toISOString(),
            author: interaction.user.username
        };
        saveNotes();

        // Show refreshed main view
        const userNotes = getUserNotes(interaction.user.id);
        const embed = buildMainEmbed(userNotes, interaction.user);

        return interaction.reply({ content: `✅ Note **"${title}"** saved!`, embeds: [embed], components: [buildMainButtons()], ephemeral: true });
    }

    // ── Edit Note modal ──
    if (id.startsWith('notes_edit_modal_')) {
        const noteId = id.replace('notes_edit_modal_', '');
        const note = notes[noteId];
        if (!note) return interaction.reply({ content: 'Note not found!', ephemeral: true });

        const newTitle = interaction.fields.getTextInputValue('title');
        const newContent = interaction.fields.getTextInputValue('content');

        if (newTitle !== note.title) {
            const newNoteId = createNoteId(interaction.user.id, newTitle);
            notes[newNoteId] = { ...note, title: newTitle, content: newContent, updatedAt: new Date().toISOString() };
            delete notes[noteId];
        } else {
            note.content = newContent;
            note.updatedAt = new Date().toISOString();
        }
        saveNotes();

        return interaction.reply({ content: `✏️ Note **"${newTitle}"** updated!`, ephemeral: true });
    }
}

// ── Export ────────────────────────────────────────────────────
module.exports = {
    name: 'mynotes',
    description: 'View and manage your personal notes',
    execute,
    handleButton,
    handleSelectMenu,
    handleModal
};