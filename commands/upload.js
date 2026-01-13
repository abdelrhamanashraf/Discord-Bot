const { EmbedBuilder } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const { createSession } = require('../server');

module.exports = {
    name: 'upload',
    description: 'Upload a file to a third-party provider',
    options: [
        {
            name: 'provider',
            type: 3, // STRING
            description: 'Choose a file provider',
            required: true,
            choices: [
                { name: 'Gofile.io', value: 'gofile' },
                { name: 'Vikingfile.com', value: 'vikingfile' },
                { name: 'DDownload.com', value: 'ddownload' },
                { name: 'Fileq.net', value: 'fileq' },
                { name: 'Rootz.so', value: 'rootz' },
                { name: 'DataVaults.co', value: 'datavaults' },
                { name: 'Pixeldrain.com', value: 'pixeldrain' }
            ]
        }
    ],

    async execute(interaction) {
        const provider = interaction.options.getString('provider');
        const sessionId = uuidv4();

        // Create a session
        createSession(sessionId, interaction.user.id, interaction.channelId, provider);


        // You should set PUBLIC_URL in your .env file
        const baseUrl =// process.env.PUBLIC_URL || 
            'http://localhost:3000';
        const uploadUrl = `${baseUrl}/upload?id=${sessionId}&provider=${provider}`;

        const embed = new EmbedBuilder()
            .setTitle('File Upload Request')
            .setDescription(`Please upload your file using the link below.\n\n**Provider:** ${provider}\n**Link:** [Click Here to Upload](${uploadUrl})`)
            .setFooter({ text: 'Link expires in 10 minutes.' })
            .setThumbnail("https://meowboteow.sirv.com/meow%20images/output.webp")
            .setColor('#0099FF');

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
