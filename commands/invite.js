const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const QRCode = require('qrcode');
const path = require('path');
require('dotenv').config();

// Discord-themed colors
const DISCORD_COLORS = {
    blurple: '#5865F2',
    green: '#57F287',
    yellow: '#FEE75C',
    fuchsia: '#EB459E',
    red: '#ED4245',
    white: '#FFFFFF',
    black: '#23272A',
    darkBg: '#2C2F33'
};

// Image paths
const CENTER_LOGO = path.join(__dirname, '..', 'public', 'images', 'logo.png');
const DISCORD_IMAGES = [
    path.join(__dirname, '..', 'public', 'images', 'discord.png'),
    path.join(__dirname, '..', 'public', 'images', 'discord1.png'),
    path.join(__dirname, '..', 'public', 'images', 'discord2.png')
];

async function generateDecoratedQR(inviteLink) {
    // Higher resolution for sharper output
    const qrSize = 400;
    const padding = 160;
    const canvasSize = qrSize + padding * 2;
    const centerLogoSize = 90;
    const sideImageSize = 80;

    const canvas = createCanvas(canvasSize, canvasSize);
    const ctx = canvas.getContext('2d');

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, canvasSize, canvasSize);
    gradient.addColorStop(0, DISCORD_COLORS.darkBg);
    gradient.addColorStop(0.5, '#1a1c1e');
    gradient.addColorStop(1, DISCORD_COLORS.black);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Decorative border with Discord blurple
    ctx.strokeStyle = DISCORD_COLORS.blurple;
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, canvasSize - 40, canvasSize - 40);

    // Inner glow effect
    ctx.strokeStyle = DISCORD_COLORS.fuchsia;
    ctx.lineWidth = 4;
    ctx.strokeRect(32, 32, canvasSize - 64, canvasSize - 64);

    // Generate QR code with high error correction for center logo
    const qrDataUrl = await QRCode.toDataURL(inviteLink, {
        width: qrSize,
        margin: 1,
        color: {
            dark: DISCORD_COLORS.blurple,
            light: DISCORD_COLORS.white
        },
        errorCorrectionLevel: 'H' // High for center logo overlay
    });

    // Load QR code
    const qrImage = await loadImage(qrDataUrl);

    // Add shadow for QR code
    ctx.shadowColor = DISCORD_COLORS.blurple;
    ctx.shadowBlur = 30;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw QR with rounded corners background
    ctx.fillStyle = DISCORD_COLORS.white;
    roundRect(ctx, padding - 20, padding - 20, qrSize + 40, qrSize + 40, 30);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.drawImage(qrImage, padding, padding, qrSize, qrSize);

    // Load and draw center logo
    try {
        const logo = await loadImage(CENTER_LOGO);
        const centerX = canvasSize / 2 - centerLogoSize / 2;
        const centerY = canvasSize / 2 - centerLogoSize / 2;

        // White circle background for center logo
        ctx.fillStyle = DISCORD_COLORS.white;
        ctx.beginPath();
        ctx.arc(canvasSize / 2, canvasSize / 2, centerLogoSize / 2 + 10, 0, Math.PI * 2);
        ctx.fill();

        // Draw logo in center
        ctx.drawImage(logo, centerX, centerY, centerLogoSize, centerLogoSize);
    } catch (err) {
        console.error('Failed to load center logo:', err);
    }

    // Load and draw Discord decoration images on the sides
    try {
        // Load all Discord images
        const discordImages = await Promise.all(
            DISCORD_IMAGES.map(imgPath => loadImage(imgPath).catch(() => null))
        );

        // Top decoration (discord.png)
        if (discordImages[0]) {
            ctx.drawImage(
                discordImages[0],
                canvasSize / 2 - sideImageSize / 2,
                50,
                sideImageSize,
                sideImageSize
            );
        }

        // Left decoration (discord1.png)
        if (discordImages[1]) {
            ctx.drawImage(
                discordImages[1],
                50,
                canvasSize / 2 - sideImageSize / 2,
                sideImageSize,
                sideImageSize
            );
        }

        // Right decoration (discord2.png)
        if (discordImages[2]) {
            ctx.drawImage(
                discordImages[2],
                canvasSize - sideImageSize - 50,
                canvasSize / 2 - sideImageSize / 2,
                sideImageSize,
                sideImageSize
            );
        }

        // Bottom - use discord.png again or mix
        if (discordImages[0]) {
            ctx.drawImage(
                discordImages[0],
                canvasSize / 2 - sideImageSize / 2,
                canvasSize - sideImageSize - 50,
                sideImageSize,
                sideImageSize
            );
        }

        // Corner decorations with smaller versions
        const cornerSize = 50;

        // Top-left corner
        if (discordImages[1]) {
            ctx.drawImage(discordImages[1], 56, 56, cornerSize, cornerSize);
        }

        // Top-right corner
        if (discordImages[2]) {
            ctx.drawImage(discordImages[2], canvasSize - cornerSize - 56, 56, cornerSize, cornerSize);
        }

        // Bottom-left corner
        if (discordImages[2]) {
            ctx.drawImage(discordImages[2], 56, canvasSize - cornerSize - 56, cornerSize, cornerSize);
        }

        // Bottom-right corner
        if (discordImages[1]) {
            ctx.drawImage(discordImages[1], canvasSize - cornerSize - 56, canvasSize - cornerSize - 56, cornerSize, cornerSize);
        }

    } catch (err) {
        console.error('Failed to load Discord images:', err);
    }

    // Small decorative sparkles
    ctx.font = '28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✨', 110, canvasSize / 2 - 80);
    ctx.fillText('✨', canvasSize - 110, canvasSize / 2 + 80);
    ctx.fillText('💜', 110, canvasSize / 2 + 80);
    ctx.fillText('💜', canvasSize - 110, canvasSize / 2 - 80);

    return canvas.toBuffer('image/png');
}

// Helper function for rounded rectangles
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// Validate Discord invite link
function isValidDiscordInvite(link) {
    const patterns = [
        /^https?:\/\/(www\.)?discord\.gg\/[a-zA-Z0-9]+$/,
        /^https?:\/\/(www\.)?discord\.com\/invite\/[a-zA-Z0-9]+$/,
        /^https?:\/\/(www\.)?discordapp\.com\/invite\/[a-zA-Z0-9]+$/
    ];
    return patterns.some(pattern => pattern.test(link));
}

// Extract invite code from link
function getInviteCode(link) {
    const match = link.match(/(?:discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

module.exports = {
    name: 'invite',
    description: 'Generate a decorated QR code for a Discord invite link',

    async execute(interaction) {
        const inviteLink = process.env.INVITE_LINK;
        // Validate the invite link
        if (!isValidDiscordInvite(inviteLink)) {
            return interaction.reply({
                content: '❌ Please provide a valid Discord invite link!\n' +
                    '**Examples:**\n' +
                    '• `https://discord.gg/abc123`\n' +
                    '• `https://discord.com/invite/abc123`',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            const inviteCode = getInviteCode(inviteLink);

            // Generate the decorated QR code
            const qrBuffer = await generateDecoratedQR(inviteLink);

            // Create attachment
            const attachment = new AttachmentBuilder(qrBuffer, {
                name: `invite_${inviteCode}.png`
            });

            // Create embed
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🐱 Discord Invite QR Code 🐱')
                .setDescription(`Scan this cute QR code to join!`)
                .addFields({ name: '🔗 Invite Link', value: inviteLink })
                .setImage(`attachment://invite_${inviteCode}.png`)
                .setFooter({
                    text: '✨ Made with 💜 and cats • Scan with your phone camera!'
                })
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                files: [attachment]
            });

        } catch (error) {
            console.error('Error generating QR code:', error);
            await interaction.editReply({
                content: '❌ Failed to generate QR code. Please try again!',
                ephemeral: true
            });
        }
    }
};
