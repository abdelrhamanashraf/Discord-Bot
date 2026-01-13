const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow all origins to prevent AWS/Localhost mismatches

app.use((req, res, next) => {
    if (req.path === '/api/proxy/upload' ||
        req.path === '/api/proxy/rootz/upload' ||
        req.path.startsWith('/api/proxy/pixeldrain/upload')) {
        next();
    } else {
        bodyParser.json()(req, res, next);
    }
});
app.use(express.static(path.join(__dirname, 'public')));

// Session Store
// Map<sessionId, { userId, channelId, provider, timestamp }>
const sessionStore = new Map();

// Session Cleanup (every 10 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, data] of sessionStore.entries()) {
        if (now - data.timestamp > 10 * 60 * 1000) { // 10 minutes
            sessionStore.delete(sessionId);
        }
    }
}, 10 * 60 * 1000);

let discordClient = null;

// Initialize function to get Discord client
function initServer(client) {
    discordClient = client;
    app.listen(PORT, () => {
        console.log(`Web server running on port ${PORT}`);
    });
}

// Add a new session
function createSession(sessionId, userId, channelId, provider) {
    sessionStore.set(sessionId, {
        userId,
        channelId,
        provider,
        timestamp: Date.now()
    });
    return sessionId;
}

// Routes

// Serve the upload page
app.get('/upload', (req, res) => {
    const { id } = req.query;

    if (!id || !sessionStore.has(id)) {
        return res.status(403).send('Invalid or expired session.');
    }

    res.sendFile(path.join(__dirname, 'public', 'upload.html'));
});

// Routes

// Generic Upload Proxy to bypass CORS/SSL issues
const https = require('https');
app.post('/api/proxy/upload', async (req, res) => {
    const targetUrl = req.query.target;
    if (!targetUrl) {
        return res.status(400).json({ error: 'Missing target URL' });
    }

    try {
        const isHttps = targetUrl.startsWith('https');
        const agent = new https.Agent({
            rejectUnauthorized: false // Bypasses SSL certificate errors
        });
        // Forward the request stream directly to the target
        const config = {
            method: 'post',
            url: targetUrl,
            data: req,
            headers: {
                'Content-Type': req.headers['content-type']
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        };
        if (isHttps) {
            config.httpsAgent = agent;
        }
        const response = await axios(config);
        res.json(response.data);
    } catch (error) {
        console.error('Upload Proxy Error:', error.message);
        if (error.response) {
            console.error('Target Response:', error.response.data);
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: 'Upload Validation Failed' });
        }
    }
});

// Proxy Routes to bypass CORS
app.get('/api/proxy/gofile/servers', async (req, res) => {
    try {
        const token = process.env.GOFILE_TOKEN;
        const response = await axios.get('https://api.gofile.io/servers', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Gofile Proxy Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch Gofile servers' });
    }
});

app.get('/api/proxy/vikingfile/server', async (req, res) => {
    try {
        const url = 'https://vikingfile.com/api/get-server';
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Vikingfile Proxy Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch Vikingfile server' });
    }
});

app.get('/api/proxy/ddownload/server', async (req, res) => {
    try {
        const key = process.env.DD_TOKEN;
        if (!key) {
            return res.status(500).json({ error: 'DDownload API Key (DD_TOKEN) not configured' });
        }

        const response = await axios.get(`https://api-v2.ddownload.com/api/upload/server?key=${key}`);

        if (response.data && response.data.msg === 'OK' && response.data.result) {
            res.json({
                uploadUrl: response.data.result,
                sess_id: key
            });
        } else {
            console.error('DDownload Error:', response.data);
            res.status(500).json({ error: 'Failed to get DDownload server' });
        }
    } catch (error) {
        console.error('DDownload Proxy Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch DDownload server' });
    }
});
app.get('/api/proxy/fileq/server', async (req, res) => {
    const qfilekey = process.env.QFILE_KEY;
    if (!qfilekey) {
        return res.status(500).json({ error: 'Qfile API Key (QFILE_KEY) not configured' });
    }
    const response = await axios.get(`https://fileq.net/api/upload/server?key=${qfilekey}`);

    if (response.data && response.data.msg === 'OK' && response.data.result) {
        const uploadUrl = response.data.result;
        res.json({
            uploadUrl: uploadUrl,
            sess_id: response.data.sess_id
        });
    } else {
        console.error('FileQ Error:', response.data);
        res.status(500).json({ error: 'Failed to get FileQ server' });
    }
});

app.get('/api/proxy/datavaults/server', async (req, res) => {
    const key = process.env.DATAVALUTS_KEY;
    if (!key) {
        return res.status(500).json({ error: 'DataVaults API Key (DATAVALUTS_KEY) not configured' });
    }
    // DataVaults uses XFileSharing, same pattern as DDownload/FileQ
    const response = await axios.get(`https://datavaults.co/api/upload/server?key=${key}`);

    if (response.data && response.data.msg === 'OK' && response.data.result) {

        res.json({
            uploadUrl: response.data.result,
            sess_id: response.data.sess_id
        });
    } else {
        console.error('DataVaults Error:', response.data);
        res.status(500).json({ error: 'Failed to get DataVaults server' });
    }
});

app.put('/api/proxy/pixeldrain/upload/:filename', async (req, res) => {
    const key = process.env.PIXELDRAIN_KEY;
    if (!key) {
        return res.status(500).json({ error: 'Pixeldrain API Key (PIXELDRAIN_KEY) not configured' });
    }

    const filename = req.params.filename;

    try {
        const headers = {
            'Content-Type': req.headers['content-type'] || 'application/octet-stream',
        };

        if (req.headers['content-length']) {
            headers['Content-Length'] = req.headers['content-length'];
        }
        const httpsAgent = new https.Agent({
            keepAlive: false, // Disable keepAlive to prevent socket hang on AWS
            family: 4, // Force IPv4
            rejectUnauthorized: false // Bypass SSL strictness
        });

        const response = await axios.put(`https://pixeldrain.com/api/file/${encodeURIComponent(filename)}`, req, {
            auth: {
                username: '',
                password: key
            },
            headers: headers,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            responseType: 'json',
            httpsAgent: httpsAgent,
            timeout: 120000 // Increase timeout to 120s
        });


        res.json(response.data);
    } catch (error) {
        console.error('Pixeldrain Upload Error:', error.message);
        if (error.response) {
            console.error('Pixeldrain Response Data:', error.response.data);
            res.status(error.response.status).json(error.response.data);
        } else {
            console.error(error);
            res.status(500).json({ error: 'Pixeldrain Upload Failed' });
        }
    }
});

// Rootz.so Proxies
const ROOTZ_BASE = 'https://www.rootz.so';

// Helper for Rootz headers
const getRootzHeaders = () => {
    const key = process.env.ROOTZ_TOKEN;
    const headers = { 'Content-Type': 'application/json' };
    if (key) {
        headers['Authorization'] = `Bearer ${key}`;
    }
    return headers;
};

// 1. Small File Upload Proxy
app.post('/api/proxy/rootz/upload', async (req, res) => {
    try {
        const headers = {
            'Content-Type': req.headers['content-type'] // Preserve multipart boundary
        };
        const response = await axios({
            method: 'post',
            url: `${ROOTZ_BASE}/api/files/upload`,
            data: req, // Stream the request directly
            headers: headers,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        res.json(response.data);
    } catch (error) {
        console.error('Rootz Upload Error:', error.message);
        if (error.response) res.status(error.response.status).json(error.response.data);
        else res.status(500).json({ error: 'Rootz Upload Failed' });
    }
});

// 2. Multipart Init
app.post('/api/proxy/rootz/multipart/init', async (req, res) => {
    try {
        const response = await axios.post(`${ROOTZ_BASE}/api/files/multipart/init`, req.body, {
            headers: getRootzHeaders()
        });
        res.json(response.data);
    } catch (error) {
        console.error('Rootz Init Error:', error.message);
        res.status(500).json({ error: 'Rootz Init Failed' });
    }
});

// 3. Multipart Batch URLs
app.post('/api/proxy/rootz/multipart/batch-urls', async (req, res) => {
    try {
        const response = await axios.post(`${ROOTZ_BASE}/api/files/multipart/batch-urls`, req.body, {
            headers: getRootzHeaders()
        });
        res.json(response.data);
    } catch (error) {
        console.error('Rootz Batch URLs Error:', error.message);
        res.status(500).json({ error: 'Rootz Batch URLs Failed' });
    }
});

// 4. Multipart Complete
app.post('/api/proxy/rootz/multipart/complete', async (req, res) => {
    try {
        const response = await axios.post(`${ROOTZ_BASE}/api/files/multipart/complete`, req.body, {
            headers: getRootzHeaders()
        });
        res.json(response.data);
    } catch (error) {
        console.error('Rootz Complete Error:', error.message);
        res.status(500).json({ error: 'Rootz Complete Failed' });
    }
});

// Callback API
app.post('/api/callback', async (req, res) => {
    const { id, fileUrl, fileName } = req.body;

    if (!id || !sessionStore.has(id)) {
        return res.status(403).json({ error: 'Invalid or expired session.' });
    }

    const session = sessionStore.get(id);

    try {
        if (discordClient) {
            const channel = await discordClient.channels.fetch(session.channelId);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle('File Uploaded Successfully!')
                    .setThumbnail("https://meowboteow.sirv.com/meow%20images/2ef00b2351b8c7a538db11392053934d_88b9ee397b6fd0b392722287f7f2dc55.webp")
                    .setDescription(`**User:** <@${session.userId}>\n**File:** ${fileName}\n**Provider:** ${session.provider}`)
                    .addFields({ name: 'Download Link', value: fileUrl })
                    .setColor('#00FF00')
                    .setTimestamp();

                await channel.send({ embeds: [embed] });

                // Remove session after successful upload
                sessionStore.delete(id);

                return res.json({ success: true });
            }
        }
        res.status(500).json({ error: 'Failed to notify Discord bot.' });
    } catch (error) {
        console.error('Error sending message to Discord:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = { initServer, createSession };
