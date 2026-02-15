const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Socket.io setup
const { Server } = require('socket.io');
const io = new Server(server, {
    cors: { origin: '*' },
    pingTimeout: 30000,
    pingInterval: 10000
});

// Middleware
app.use(cors()); // Allow all origins to prevent AWS/Localhost mismatches

app.use((req, res, next) => {
    if (req.path === '/api/proxy/upload' ||
        req.path.startsWith('/api/proxy/rootz/upload') ||
        req.path.startsWith('/api/proxy/pixeldrain/upload')) {
        next();
    } else {
        bodyParser.json({ limit: '50mb' })(req, res, next);
    }
});
app.use(express.static(path.join(__dirname, 'public')));

// ========== UPLOAD SESSION STORE ==========
// Map<sessionId, { userId, channelId, provider, timestamp }>
const sessionStore = new Map();

// ========== TRIVIA GAME STORE ==========
// Map<sessionId, { host, players, config, state, questions, currentQuestion, scores, timeouts, createdAt }>
const triviaGames = new Map();
const MAX_CONCURRENT_GAMES = 3;
const MAX_PLAYERS_PER_GAME = 10;
const LOBBY_TIMEOUT_MS = 10 * 60 * 1000;  // 10 min
const GAME_TIMEOUT_MS = 25 * 60 * 1000;   // 25 min
const QUESTION_TIME_MS = 30 * 1000;        // 30s per question

// ========== CODENAMES GAME STORE ==========
const codenamesGames = new Map();
const MAX_CODENAMES_GAMES = 3;
const MAX_OPERATIVES_PER_TEAM = 4;
const CODENAMES_LOBBY_TIMEOUT_MS = 15 * 60 * 1000;  // 15 min
const CODENAMES_GAME_TIMEOUT_MS = 45 * 60 * 1000;   // 45 min

// Trivia scores (shared with existing trivia.js)
const TRIVIA_SCORES_PATH = path.join(__dirname, 'data', 'trivia_scores.json');

function loadTriviaScores() {
    try {
        if (fs.existsSync(TRIVIA_SCORES_PATH)) {
            return JSON.parse(fs.readFileSync(TRIVIA_SCORES_PATH, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading trivia scores:', e);
    }
    return {};
}

function saveTriviaScores(scores) {
    try {
        fs.writeFileSync(TRIVIA_SCORES_PATH, JSON.stringify(scores, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving trivia scores:', e);
    }
}

// Session Cleanup (every 2 minutes — covers both upload sessions and trivia)
setInterval(() => {
    const now = Date.now();

    // Clean up upload sessions (10 min)
    for (const [sessionId, data] of sessionStore.entries()) {
        if (now - data.timestamp > 10 * 60 * 1000) {
            sessionStore.delete(sessionId);
        }
    }

    // Clean up stale trivia games
    for (const [sessionId, game] of triviaGames.entries()) {
        const age = now - game.createdAt;
        if (game.state === 'lobby' && age > LOBBY_TIMEOUT_MS) {
            console.log(`Trivia game ${sessionId} lobby timed out`);
            destroyTriviaGame(sessionId, 'Lobby timed out — no one started the game.');
        } else if (game.state === 'playing' && age > GAME_TIMEOUT_MS) {
            console.log(`Trivia game ${sessionId} hard timeout`);
            endTriviaGame(sessionId);
        } else if (game.state === 'finished' && age > 10 * 60 * 1000) {
            // Finished games get 10 min for players to click New Game
            console.log(`Trivia game ${sessionId} finished session expired`);
            destroyTriviaGame(sessionId, 'Session expired after game completion.');
        }
    }

    // Clean up stale codenames games
    for (const [sessionId, game] of codenamesGames.entries()) {
        const age = now - game.createdAt;
        if (game.state === 'lobby' && age > CODENAMES_LOBBY_TIMEOUT_MS) {
            console.log(`Codenames game ${sessionId} lobby timed out`);
            destroyCodenamesGame(sessionId, 'Lobby timed out — no one started the game.');
        } else if (game.state === 'playing' && age > CODENAMES_GAME_TIMEOUT_MS) {
            console.log(`Codenames game ${sessionId} hard timeout`);
            endCodenamesGame(sessionId, null, 'Game timed out.');
        } else if (game.state === 'finished' && age > 10 * 60 * 1000) {
            console.log(`Codenames game ${sessionId} finished session expired`);
            destroyCodenamesGame(sessionId, 'Session expired after game completion.');
        }
    }
}, 2 * 60 * 1000);

let discordClient = null;

// Initialize function to get Discord client
function initServer(client) {
    discordClient = client;
    server.listen(PORT, () => {
        console.log(`Web server running on port ${PORT}`);
    });
}

// ========== UPLOAD SESSION FUNCTIONS ==========

// Add a new upload session
function createSession(sessionId, userId, channelId, provider) {
    sessionStore.set(sessionId, {
        userId,
        channelId,
        provider,
        timestamp: Date.now()
    });
    return sessionId;
}

// ========== TRIVIA SESSION FUNCTIONS ==========

function createTriviaSession(sessionId, hostData) {
    // Enforce max concurrent games
    const activeGames = Array.from(triviaGames.values()).filter(g => g.state !== 'finished');
    if (activeGames.length >= MAX_CONCURRENT_GAMES) {
        console.warn(`Max concurrent trivia games (${MAX_CONCURRENT_GAMES}) reached`);
        return null;
    }

    triviaGames.set(sessionId, {
        host: {
            odiscordId: hostData.odiscordId,
            username: hostData.username,
            displayName: hostData.displayName,
            avatarUrl: hostData.avatarUrl
        },
        channelId: hostData.channelId,
        players: new Map(), // odiscordId -> { username, displayName, avatarUrl, score, answers, socketId }
        config: {
            category: '',
            difficulty: '',
            amount: 10
        },
        state: 'lobby', // lobby | playing | finished
        questions: [],
        currentQuestion: -1,
        answeredThisRound: new Set(),
        questionTimer: null,
        disconnectTimer: null,     // setTimeout ref for all-disconnect cleanup
        createdAt: Date.now()
    });

    console.log(`Trivia session created: ${sessionId} by ${hostData.username}`);
    return sessionId;
}

function destroyTriviaGame(sessionId, reason) {
    const game = triviaGames.get(sessionId);
    if (!game) return;

    // Clear any timers
    if (game.questionTimer) clearTimeout(game.questionTimer);
    if (game.disconnectTimer) clearTimeout(game.disconnectTimer);

    // Notify all connected players
    io.to(`trivia_${sessionId}`).emit('game-destroyed', { reason });

    // Disconnect all sockets from the room
    io.in(`trivia_${sessionId}`).socketsLeave(`trivia_${sessionId}`);

    triviaGames.delete(sessionId);
    console.log(`Trivia game ${sessionId} destroyed: ${reason}`);
}

async function endTriviaGame(sessionId) {
    const game = triviaGames.get(sessionId);
    if (!game || game.state === 'finished') return;

    game.state = 'finished';
    if (game.questionTimer) clearTimeout(game.questionTimer);

    // Build final results
    const results = [];
    for (const [odiscordId, player] of game.players.entries()) {
        results.push({
            odiscordId,
            username: player.username,
            displayName: player.displayName,
            avatarUrl: player.avatarUrl,
            score: player.score,
            correctAnswers: player.score,
            totalAnswers: player.answers
        });
    }
    results.sort((a, b) => b.score - a.score);

    // Save scores to trivia_scores.json (same format as existing trivia)
    const triviaScores = loadTriviaScores();
    for (const r of results) {
        if (!triviaScores[r.odiscordId]) {
            triviaScores[r.odiscordId] = {
                username: r.username,
                totalScore: 0,
                gamesPlayed: 0,
                correctAnswers: 0,
                totalQuestions: 0
            };
        }
        triviaScores[r.odiscordId].username = r.username;
        triviaScores[r.odiscordId].totalScore += r.score;
        triviaScores[r.odiscordId].gamesPlayed += 1;
        triviaScores[r.odiscordId].correctAnswers += r.correctAnswers;
        triviaScores[r.odiscordId].totalQuestions += r.totalAnswers;
    }
    saveTriviaScores(triviaScores);

    // Get all-time top 5
    const allTimeTop = Object.values(triviaScores)
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 5);

    // Broadcast results to all players
    io.to(`trivia_${sessionId}`).emit('game-over', {
        results,
        allTimeTop,
        totalQuestions: game.questions.length
    });

    // Send results embed to Discord channel
    try {
        if (discordClient && game.channelId) {
            const channel = await discordClient.channels.fetch(game.channelId);
            if (channel) {
                let participantText = '';
                results.forEach((r, i) => {
                    const accuracy = r.totalAnswers > 0
                        ? Math.round((r.correctAnswers / r.totalAnswers) * 100)
                        : 0;
                    participantText += `${i + 1}. **${r.displayName}**: ${r.score} pts (${accuracy}% accuracy)\n`;
                });

                let leaderboardText = '';
                allTimeTop.forEach((p, i) => {
                    const accuracy = p.totalQuestions > 0
                        ? Math.round((p.correctAnswers / p.totalQuestions) * 100)
                        : 0;
                    leaderboardText += `${i + 1}. **${p.username}**: ${p.totalScore} pts (${accuracy}%)\n`;
                });

                const embed = new EmbedBuilder()
                    .setTitle('🎮 Web Trivia Results')
                    .setDescription(`Game hosted by **${game.host.displayName}** has ended!\n${game.players.size} players participated.`)
                    .addFields(
                        { name: '🏅 Game Results', value: participantText || 'No participants', inline: false },
                        { name: '🏆 All-Time Leaderboard', value: leaderboardText || 'No data yet', inline: false }
                    )
                    .setColor('#7C3AED')
                    .setThumbnail(game.host.avatarUrl)
                    .setFooter({ text: 'MeowBot Web Trivia' })
                    .setTimestamp();

                await channel.send({ embeds: [embed] });
            }
        }
    } catch (e) {
        console.error('Error sending trivia results to Discord:', e);
    }

    // Don't auto-destroy — keep session alive for "New Game" option.
    // Periodic cleanup (every 2 min) handles truly abandoned sessions.
}

// Fetch trivia questions from Open Trivia DB
async function fetchTriviaQuestions(amount, category, difficulty, type) {
    try {
        const qType = type || 'multiple';
        let url = `https://opentdb.com/api.php?amount=${amount}&type=${qType}`;
        if (category) url += `&category=${category}`;
        if (difficulty) url += `&difficulty=${difficulty}`;

        const response = await axios.get(url, { timeout: 8000 });
        if (response.data.response_code === 0) {
            return response.data.results.map(q => ({
                question: decodeHTML(q.question),
                correct_answer: decodeHTML(q.correct_answer),
                incorrect_answers: q.incorrect_answers.map(a => decodeHTML(a)),
                category: q.category,
                difficulty: q.difficulty
            }));
        }
        return null;
    } catch (e) {
        console.error('Error fetching trivia questions:', e.message);
        return null;
    }
}

function decodeHTML(html) {
    return html
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#039;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"')
        .replace(/&laquo;/g, '«')
        .replace(/&raquo;/g, '»')
        .replace(/&hellip;/g, '…')
        .replace(/&eacute;/g, 'é')
        .replace(/&ntilde;/g, 'ñ');
}

// Category map (same as existing trivia.js)
const CATEGORY_MAP = {
    'general': 9, 'books': 10, 'film': 11, 'music': 12,
    'television': 14, 'videogames': 15, 'science': 17,
    'computers': 18, 'mathematics': 19, 'sports': 21,
    'geography': 22, 'history': 23, 'politics': 24,
    'art': 25, 'animals': 27, 'vehicles': 28,
    'comics': 29, 'gadgets': 30, 'anime': 31,
    'cartoons': 32, 'mythology': 20, 'boardgames': 16,
    'celebrities': 26
};

// ========== TRIVIA REST ROUTES ==========

// Serve the trivia page
app.get('/trivia', (req, res) => {
    const { id } = req.query;
    if (!id || !triviaGames.has(id)) {
        return res.status(403).send('Invalid or expired trivia session.');
    }
    res.sendFile(path.join(__dirname, 'public', 'trivia.html'));
});

// Get trivia session info
app.get('/api/trivia/session/:id', (req, res) => {
    const game = triviaGames.get(req.params.id);
    if (!game) {
        return res.status(404).json({ error: 'Session not found or expired' });
    }

    const players = [];
    for (const [odiscordId, p] of game.players.entries()) {
        players.push({
            odiscordId,
            username: p.username,
            displayName: p.displayName,
            avatarUrl: p.avatarUrl,
            score: p.score
        });
    }

    res.json({
        host: game.host,
        players,
        config: game.config,
        state: game.state,
        maxPlayers: MAX_PLAYERS_PER_GAME,
        currentQuestion: game.currentQuestion,
        totalQuestions: game.questions.length
    });
});

// ========== WEBSOCKET HANDLERS ==========

io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join a trivia game
    socket.on('join-game', (data) => {
        const { sessionId, odiscordId, username, displayName, avatarUrl } = data;
        const game = triviaGames.get(sessionId);

        if (!game) {
            socket.emit('error-msg', { message: 'Game not found or expired.' });
            return;
        }

        // Allow reconnection to finished games (for New Game)
        // Block new players from joining mid-game, but allow existing players to reconnect
        if (game.state === 'playing' && !game.players.has(odiscordId)) {
            socket.emit('error-msg', { message: 'Game already in progress. Cannot join mid-game.' });
            return;
        }

        if (game.state === 'finished' && !game.players.has(odiscordId)) {
            socket.emit('error-msg', { message: 'This game has already ended.' });
            return;
        }

        // Check max players
        if (!game.players.has(odiscordId) && game.players.size >= MAX_PLAYERS_PER_GAME) {
            socket.emit('error-msg', { message: `Game is full (max ${MAX_PLAYERS_PER_GAME} players).` });
            return;
        }

        // Join the socket room
        socket.join(`trivia_${sessionId}`);
        socket.triviaSessionId = sessionId;
        socket.odiscordId = odiscordId;

        // Cancel any pending all-disconnect timer
        if (game.disconnectTimer) {
            clearTimeout(game.disconnectTimer);
            game.disconnectTimer = null;
            console.log(`Trivia ${sessionId}: disconnect timer cancelled — player reconnected`);
        }

        // Add or update player
        const existing = game.players.get(odiscordId);
        game.players.set(odiscordId, {
            username,
            displayName,
            avatarUrl,
            score: existing ? existing.score : 0,
            answers: existing ? existing.answers : 0,
            socketId: socket.id
        });

        // Broadcast updated player list
        const playerList = getPlayerList(game);
        io.to(`trivia_${sessionId}`).emit('player-list', {
            players: playerList,
            hostId: game.host.odiscordId
        });

        // If game is in progress (reconnect), send current question
        if (game.state === 'playing' && game.currentQuestion >= 0) {
            const q = game.questions[game.currentQuestion];
            socket.emit('question', {
                index: game.currentQuestion,
                total: game.questions.length,
                question: q.question,
                answers: q.shuffledAnswers,
                category: q.category,
                difficulty: q.difficulty,
                alreadyAnswered: game.answeredThisRound.has(odiscordId)
            });
            // Send current scores
            socket.emit('scores-update', { players: playerList });
        }

        console.log(`Player ${displayName} joined trivia ${sessionId} (${game.players.size} players)`);
    });

    // Host starts the game
    socket.on('start-game', async (data) => {
        const { sessionId, config } = data;
        const game = triviaGames.get(sessionId);

        if (!game) {
            socket.emit('error-msg', { message: 'Game not found.' });
            return;
        }

        // Only host can start
        if (socket.odiscordId !== game.host.odiscordId) {
            socket.emit('error-msg', { message: 'Only the host can start the game.' });
            return;
        }

        if (game.state !== 'lobby') {
            socket.emit('error-msg', { message: 'Game already started.' });
            return;
        }

        // Update config
        game.config = {
            category: config.category || '',
            difficulty: config.difficulty || '',
            amount: Math.min(Math.max(parseInt(config.amount) || 10, 1), 50),
            type: config.type || 'multiple'
        };

        // Fetch questions
        const categoryId = CATEGORY_MAP[game.config.category] || '';
        io.to(`trivia_${sessionId}`).emit('game-starting', { message: 'Fetching questions...' });

        const questions = await fetchTriviaQuestions(game.config.amount, categoryId, game.config.difficulty, game.config.type);
        if (!questions || questions.length === 0) {
            io.to(`trivia_${sessionId}`).emit('error-msg', { message: 'Failed to fetch questions. Try a different category or try again.' });
            return;
        }

        // Shuffle answers for each question
        game.questions = questions.map(q => {
            const shuffled = [q.correct_answer, ...q.incorrect_answers].sort(() => Math.random() - 0.5);
            return { ...q, shuffledAnswers: shuffled };
        });

        game.state = 'playing';
        game.currentQuestion = -1;

        console.log(`Trivia game ${sessionId} started with ${questions.length} questions`);

        // Start first question
        sendNextQuestion(sessionId);
    });

    // Player submits an answer
    socket.on('submit-answer', (data) => {
        const { sessionId, answerIndex } = data;
        const game = triviaGames.get(sessionId);

        if (!game || game.state !== 'playing') return;

        const odiscordId = socket.odiscordId;
        if (!odiscordId || !game.players.has(odiscordId)) return;

        // Check if already answered this round
        if (game.answeredThisRound.has(odiscordId)) return;

        game.answeredThisRound.add(odiscordId);

        const q = game.questions[game.currentQuestion];
        const selectedAnswer = q.shuffledAnswers[answerIndex];
        const isCorrect = selectedAnswer === q.correct_answer;

        const player = game.players.get(odiscordId);
        if (isCorrect) player.score++;
        player.answers++;

        // Send personal feedback
        socket.emit('answer-result', {
            correct: isCorrect,
            correctAnswer: q.correct_answer,
            selectedAnswer
        });

        // Broadcast updated scores and who has answered
        const playerList = getPlayerList(game);
        io.to(`trivia_${sessionId}`).emit('scores-update', {
            players: playerList,
            answered: Array.from(game.answeredThisRound)
        });

        // If everyone answered, advance immediately
        if (game.answeredThisRound.size >= game.players.size) {
            if (game.questionTimer) clearTimeout(game.questionTimer);
            setTimeout(() => sendNextQuestion(sessionId), 2000);
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        const sessionId = socket.triviaSessionId;
        const odiscordId = socket.odiscordId;

        if (sessionId && odiscordId) {
            const game = triviaGames.get(sessionId);
            if (game) {
                const player = game.players.get(odiscordId);
                if (player) {
                    player.socketId = null; // Mark as disconnected but keep data
                }

                // Broadcast updated player list
                io.to(`trivia_${sessionId}`).emit('player-list', {
                    players: getPlayerList(game),
                    hostId: game.host.odiscordId
                });

                console.log(`Player ${odiscordId} disconnected from trivia ${sessionId}`);

                // If no connected players remain, start grace period (all states)
                const connectedPlayers = Array.from(game.players.values()).filter(p => p.socketId);
                if (connectedPlayers.length === 0 && !game.disconnectTimer) {
                    const gracePeriod = game.state === 'lobby' ? 60000 : 120000; // 1 min lobby, 2 min in-game
                    console.log(`Trivia ${sessionId}: all players disconnected, ${gracePeriod / 1000}s grace period started`);
                    game.disconnectTimer = setTimeout(() => {
                        const g = triviaGames.get(sessionId);
                        if (g) {
                            const stillConnected = Array.from(g.players.values()).filter(p => p.socketId);
                            if (stillConnected.length === 0) {
                                destroyTriviaGame(sessionId, 'All players disconnected.');
                            }
                        }
                    }, gracePeriod);
                }
            }
        }

        console.log(`Socket disconnected: ${socket.id}`);
    });

    // Host restarts game (returns to lobby)
    socket.on('restart-game', (data) => {
        const { sessionId } = data;
        const game = triviaGames.get(sessionId);
        if (!game) return;

        if (socket.odiscordId !== game.host.odiscordId) {
            socket.emit('error-msg', { message: 'Only the host can restart the game.' });
            return;
        }

        if (game.state !== 'finished') {
            socket.emit('error-msg', { message: 'Game is not finished yet.' });
            return;
        }

        // Reset game state back to lobby
        game.state = 'lobby';
        game.questions = [];
        game.currentQuestion = -1;
        game.answeredThisRound.clear();
        if (game.questionTimer) clearTimeout(game.questionTimer);
        game.questionTimer = null;
        game.createdAt = Date.now(); // refresh timeout

        // Reset all player scores
        for (const [, player] of game.players.entries()) {
            player.score = 0;
            player.answers = 0;
        }

        // Broadcast lobby restart
        io.to(`trivia_${sessionId}`).emit('game-restarted', {
            players: getPlayerList(game),
            hostId: game.host.odiscordId,
            config: game.config
        });

        console.log(`Trivia game ${sessionId} restarted to lobby by host`);
    });
});

// Send the next question to all players
function sendNextQuestion(sessionId) {
    const game = triviaGames.get(sessionId);
    if (!game || game.state !== 'playing') return;

    game.currentQuestion++;
    game.answeredThisRound.clear();

    if (game.currentQuestion >= game.questions.length) {
        endTriviaGame(sessionId);
        return;
    }

    const q = game.questions[game.currentQuestion];

    io.to(`trivia_${sessionId}`).emit('question', {
        index: game.currentQuestion,
        total: game.questions.length,
        question: q.question,
        answers: q.shuffledAnswers,
        category: q.category,
        difficulty: q.difficulty,
        timeMs: QUESTION_TIME_MS
    });

    // Auto-advance after time is up
    game.questionTimer = setTimeout(() => {
        // Reveal correct answer to everyone before moving on
        io.to(`trivia_${sessionId}`).emit('time-up', {
            correctAnswer: q.correct_answer,
            scores: getPlayerList(game)
        });

        setTimeout(() => sendNextQuestion(sessionId), 3000);
    }, QUESTION_TIME_MS);
}

// Helper: get player list with connection status
function getPlayerList(game) {
    const list = [];
    for (const [odiscordId, p] of game.players.entries()) {
        list.push({
            odiscordId,
            username: p.username,
            displayName: p.displayName,
            avatarUrl: p.avatarUrl,
            score: p.score,
            answers: p.answers,
            connected: !!p.socketId
        });
    }
    return list.sort((a, b) => b.score - a.score);
}

// ========== CODENAMES SESSION FUNCTIONS ==========

function loadWordList(language) {
    const filename = language === 'ar' ? 'words ar.txt' : 'words en.txt';
    const filePath = path.join(__dirname, 'data', filename);
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return content
            .split('\n')
            .map(line => line.replace(/,\s*$/, '').trim())
            .filter(word => word.length > 0);
    } catch (e) {
        console.error(`Error loading word list (${language}):`, e);
        return [];
    }
}

function generateBoard(language, startingTeam) {
    const allWords = loadWordList(language);
    if (allWords.length < 25) {
        console.error(`Not enough words for codenames (${allWords.length} found, need 25)`);
        return null;
    }

    // Shuffle and pick 25 random words
    const shuffled = [...allWords].sort(() => Math.random() - 0.5);
    const selectedWords = shuffled.slice(0, 25);

    // Assign types: 9 for starting team, 8 for other, 7 neutral, 1 assassin
    const teamA = startingTeam === 'a' ? 'team_a' : 'team_b';
    const teamB = startingTeam === 'a' ? 'team_b' : 'team_a';

    const types = [
        ...Array(9).fill(teamA),
        ...Array(8).fill(teamB),
        ...Array(7).fill('neutral'),
        'assassin'
    ];

    // Shuffle types
    types.sort(() => Math.random() - 0.5);

    return selectedWords.map((word, i) => ({
        word,
        type: types[i],
        revealed: false,
        revealedBy: null
    }));
}

function createCodenamesSession(sessionId, hostData) {
    const activeGames = Array.from(codenamesGames.values()).filter(g => g.state !== 'finished');
    if (activeGames.length >= MAX_CODENAMES_GAMES) {
        console.warn(`Max concurrent codenames games (${MAX_CODENAMES_GAMES}) reached`);
        return null;
    }

    codenamesGames.set(sessionId, {
        host: {
            odiscordId: hostData.odiscordId,
            username: hostData.username,
            displayName: hostData.displayName,
            avatarUrl: hostData.avatarUrl
        },
        channelId: hostData.channelId,
        language: 'en',
        state: 'lobby',
        teams: {
            a: { color: '#E63946', spy: null, operatives: [] },
            b: { color: '#457B9D', spy: null, operatives: [] }
        },
        players: new Map(),
        board: [],
        startingTeam: null,
        currentTurn: null,
        currentPhase: null,     // 'spy_clue' | 'operative_guess'
        currentClue: null,      // { word, number }
        guessesRemaining: 0,
        score: { a: 0, b: 0 },
        target: { a: 0, b: 0 },
        gameLog: [],
        turnTimer: 0,           // 0 = no timer; seconds per turn phase
        turnTimeout: null,      // setTimeout ref for auto-ending turns
        disconnectTimer: null,  // setTimeout ref for all-disconnect cleanup
        createdAt: Date.now()
    });

    console.log(`Codenames session created: ${sessionId} by ${hostData.username}`);
    return sessionId;
}

function destroyCodenamesGame(sessionId, reason) {
    const game = codenamesGames.get(sessionId);
    if (!game) return;

    // Clear all timers
    if (game.turnTimeout) clearTimeout(game.turnTimeout);
    if (game.turnInterval) clearInterval(game.turnInterval);
    if (game.disconnectTimer) clearTimeout(game.disconnectTimer);

    io.of('/codenames').to(`codenames_${sessionId}`).emit('cn-game-destroyed', { reason });
    io.of('/codenames').in(`codenames_${sessionId}`).socketsLeave(`codenames_${sessionId}`);
    codenamesGames.delete(sessionId);
    console.log(`Codenames game ${sessionId} destroyed: ${reason}`);
}

async function endCodenamesGame(sessionId, winnerTeam, reason) {
    const game = codenamesGames.get(sessionId);
    if (!game || game.state === 'finished') return;

    game.state = 'finished';

    // Reveal all cards
    game.board.forEach(card => { card.revealed = true; });

    io.of('/codenames').to(`codenames_${sessionId}`).emit('cn-game-over', {
        winner: winnerTeam,
        reason,
        board: game.board,
        score: game.score,
        target: game.target
    });

    // Send results to Discord
    try {
        if (discordClient && game.channelId) {
            const channel = await discordClient.channels.fetch(game.channelId);
            if (channel) {
                const winColor = winnerTeam === 'a' ? game.teams.a.color : (winnerTeam === 'b' ? game.teams.b.color : '#888888');
                const winName = winnerTeam ? `Team ${winnerTeam.toUpperCase()}` : 'No one';

                const teamAPlayers = Array.from(game.players.values()).filter(p => p.team === 'a');
                const teamBPlayers = Array.from(game.players.values()).filter(p => p.team === 'b');

                const formatTeam = (players) => players.map(p => `${p.role === 'spy' ? '🕵️' : '👤'} ${p.displayName}`).join('\n') || 'No players';

                const embed = new EmbedBuilder()
                    .setTitle('🕵️ Codenames — Game Over!')
                    .setDescription(`**${winName}** wins!\n${reason}`)
                    .addFields(
                        { name: `Team A (${game.score.a}/${game.target.a})`, value: formatTeam(teamAPlayers), inline: true },
                        { name: `Team B (${game.score.b}/${game.target.b})`, value: formatTeam(teamBPlayers), inline: true }
                    )
                    .setColor(winColor)
                    .setFooter({ text: 'MeowBot Codenames' })
                    .setTimestamp();

                await channel.send({ embeds: [embed] });
            }
        }
    } catch (e) {
        console.error('Error sending codenames results to Discord:', e);
    }

    // Clear turn timers
    if (game.turnTimeout) { clearTimeout(game.turnTimeout); game.turnTimeout = null; }
    if (game.turnInterval) { clearInterval(game.turnInterval); game.turnInterval = null; }

    // Don't auto-destroy — keep session alive for "New Game" option.
    // Periodic cleanup (every 2 min) handles truly abandoned sessions.
}

function getCodenamesLobbyState(game) {
    const players = [];
    for (const [odiscordId, p] of game.players.entries()) {
        players.push({
            odiscordId,
            username: p.username,
            displayName: p.displayName,
            avatarUrl: p.avatarUrl,
            team: p.team,
            role: p.role,
            connected: !!p.socketId
        });
    }
    return {
        host: game.host,
        language: game.language,
        teams: {
            a: { color: game.teams.a.color },
            b: { color: game.teams.b.color }
        },
        players,
        state: game.state,
        turnTimer: game.turnTimer
    };
}

function getCodenamesGameState(game, odiscordId) {
    const player = game.players.get(odiscordId);
    const isSpy = player && player.role === 'spy';

    // Spies see all card types; operatives only see revealed cards
    const board = game.board.map(card => ({
        word: card.word,
        type: (card.revealed || isSpy) ? card.type : 'hidden',
        revealed: card.revealed,
        revealedBy: card.revealedBy
    }));

    return {
        board,
        currentTurn: game.currentTurn,
        currentPhase: game.currentPhase,
        currentClue: game.currentClue,
        guessesRemaining: game.guessesRemaining,
        score: game.score,
        target: game.target,
        startingTeam: game.startingTeam,
        gameLog: game.gameLog.slice(-20),
        teams: {
            a: { color: game.teams.a.color },
            b: { color: game.teams.b.color }
        },
        turnTimer: game.turnTimer
    };
}

function checkWinCondition(game) {
    if (game.score.a >= game.target.a) return { winner: 'a', reason: 'Team A found all their agents!' };
    if (game.score.b >= game.target.b) return { winner: 'b', reason: 'Team B found all their agents!' };
    return null;
}

// ========== CODENAMES REST ROUTES ==========

app.get('/codenames', (req, res) => {
    const { id } = req.query;
    if (!id || !codenamesGames.has(id)) {
        return res.status(403).send('Invalid or expired codenames session.');
    }
    res.sendFile(path.join(__dirname, 'public', 'codenames.html'));
});

app.get('/api/codenames/session/:id', (req, res) => {
    const game = codenamesGames.get(req.params.id);
    if (!game) {
        return res.status(404).json({ error: 'Session not found or expired' });
    }
    res.json(getCodenamesLobbyState(game));
});

// ========== CODENAMES WEBSOCKET HANDLERS ==========

const cnIO = io.of('/codenames');
cnIO.on('connection', (socket) => {
    console.log(`Codenames socket connected: ${socket.id}`);

    // Join a codenames game lobby
    socket.on('cn-join-game', (data) => {
        const { sessionId, odiscordId, username, displayName, avatarUrl } = data;
        const game = codenamesGames.get(sessionId);

        if (!game) {
            socket.emit('cn-error', { message: 'Game not found or expired.' });
            return;
        }

        // Allow new players to join even if game is in progress (Spectator mode initially)
        /*
        if (game.state === 'playing' && !game.players.has(odiscordId)) {
            socket.emit('cn-error', { message: 'Game already in progress. Cannot join mid-game.' });
            return;
        }
        */

        if (game.state === 'finished' && !game.players.has(odiscordId)) {
            socket.emit('cn-error', { message: 'This game has already ended.' });
            return;
        }

        socket.join(`codenames_${sessionId}`);
        socket.cnSessionId = sessionId;
        socket.cnDiscordId = odiscordId;

        // Cancel any pending all-disconnect timer
        if (game.disconnectTimer) {
            clearTimeout(game.disconnectTimer);
            game.disconnectTimer = null;
            console.log(`Codenames ${sessionId}: disconnect timer cancelled — player reconnected`);
        }

        const existing = game.players.get(odiscordId);
        if (!existing) {
            game.players.set(odiscordId, {
                username,
                displayName,
                avatarUrl,
                team: null,
                role: null,
                socketId: socket.id
            });
        } else {
            existing.socketId = socket.id;
        }

        // Broadcast lobby state
        cnIO.to(`codenames_${sessionId}`).emit('cn-lobby-update', getCodenamesLobbyState(game));

        // If game is in progress (reconnect or mid-game join), send game state
        if (game.state === 'playing') {
            socket.emit('cn-game-started', getCodenamesGameState(game, odiscordId));
        }

        console.log(`Player ${displayName} joined codenames ${sessionId} (${game.players.size} players)`);
    });

    // Update team / role
    socket.on('cn-update-team', (data) => {
        const { sessionId, team, role } = data;
        const game = codenamesGames.get(sessionId);
        if (!game) return;

        const odiscordId = socket.cnDiscordId;
        const player = game.players.get(odiscordId);
        if (!player) return;

        // Allow updates in both lobby and playing states
        // But if playing, ensure they don't do something invalid (e.g. modify board)
        // Actually, cn-update-team only changes role/team assignment.

        // Remove from old team assignments
        if (player.team && player.role) {
            const oldTeam = game.teams[player.team];
            if (player.role === 'spy' && oldTeam.spy === odiscordId) {
                oldTeam.spy = null;
            } else if (player.role === 'operative') {
                oldTeam.operatives = oldTeam.operatives.filter(id => id !== odiscordId);
            }
        }

        // Validate and assign new team/role
        if (team && role && game.teams[team]) {
            const targetTeam = game.teams[team];

            if (role === 'spy') {
                if (targetTeam.spy && targetTeam.spy !== odiscordId) {
                    socket.emit('cn-error', { message: 'This team already has a Spy. Choose Operative or the other team.' });
                    // Revert
                    player.team = null;
                    player.role = null;
                    cnIO.to(`codenames_${sessionId}`).emit('cn-lobby-update', getCodenamesLobbyState(game));
                    return;
                }
                targetTeam.spy = odiscordId;
            } else if (role === 'operative') {
                if (targetTeam.operatives.length >= MAX_OPERATIVES_PER_TEAM) {
                    socket.emit('cn-error', { message: `This team already has ${MAX_OPERATIVES_PER_TEAM} operatives.` });
                    player.team = null;
                    player.role = null;
                    cnIO.to(`codenames_${sessionId}`).emit('cn-lobby-update', getCodenamesLobbyState(game));
                    return;
                }
                if (!targetTeam.operatives.includes(odiscordId)) {
                    targetTeam.operatives.push(odiscordId);
                }
            }

            player.team = team;
            player.role = role;
        } else {
            player.team = null;
            player.role = null;
        }

        cnIO.to(`codenames_${sessionId}`).emit('cn-lobby-update', getCodenamesLobbyState(game));

        // If game is in progress, send updated game state to the player so they see the board correctly
        // This handles mid-game role changes (Spectator -> Operative, etc.)
        if (game.state === 'playing') {
            socket.emit('cn-game-started', getCodenamesGameState(game, odiscordId));
        }
    });

    // Update team color (host only)
    socket.on('cn-update-color', (data) => {
        const { sessionId, team, color } = data;
        const game = codenamesGames.get(sessionId);
        if (!game || game.state !== 'lobby') return;
        if (socket.cnDiscordId !== game.host.odiscordId) return;

        if (game.teams[team]) {
            game.teams[team].color = color;
            cnIO.to(`codenames_${sessionId}`).emit('cn-lobby-update', getCodenamesLobbyState(game));
        }
    });

    // Update language (host only)
    socket.on('cn-update-language', (data) => {
        const { sessionId, language } = data;
        const game = codenamesGames.get(sessionId);
        if (!game || game.state !== 'lobby') return;
        if (socket.cnDiscordId !== game.host.odiscordId) return;

        if (language === 'en' || language === 'ar') {
            game.language = language;
            cnIO.to(`codenames_${sessionId}`).emit('cn-lobby-update', getCodenamesLobbyState(game));
        }
    });

    // Update turn timer (host only)
    socket.on('cn-update-timer', (data) => {
        const { sessionId, timer } = data;
        const game = codenamesGames.get(sessionId);
        if (!game || game.state !== 'lobby') return;
        if (socket.cnDiscordId !== game.host.odiscordId) return;

        const val = parseInt(timer) || 0;
        game.turnTimer = val;
        cnIO.to(`codenames_${sessionId}`).emit('cn-lobby-update', getCodenamesLobbyState(game));
    });

    // Host starts the game
    socket.on('cn-start-game', (data) => {
        const { sessionId } = data;
        const game = codenamesGames.get(sessionId);

        if (!game) {
            socket.emit('cn-error', { message: 'Game not found.' });
            return;
        }

        if (socket.cnDiscordId !== game.host.odiscordId) {
            socket.emit('cn-error', { message: 'Only the host can start the game.' });
            return;
        }

        if (game.state !== 'lobby') {
            socket.emit('cn-error', { message: 'Game already started.' });
            return;
        }

        // Validate: each team needs at least 1 spy + 1 operative
        const teamA = game.teams.a;
        const teamB = game.teams.b;

        if (!teamA.spy || teamA.operatives.length < 1) {
            socket.emit('cn-error', { message: 'Team A needs at least 1 Spy and 1 Operative.' });
            return;
        }
        if (!teamB.spy || teamB.operatives.length < 1) {
            socket.emit('cn-error', { message: 'Team B needs at least 1 Spy and 1 Operative.' });
            return;
        }

        // Randomly decide starting team
        game.startingTeam = Math.random() < 0.5 ? 'a' : 'b';
        game.currentTurn = game.startingTeam;
        game.currentPhase = 'spy_clue';

        // Set targets
        game.target.a = game.startingTeam === 'a' ? 9 : 8;
        game.target.b = game.startingTeam === 'b' ? 9 : 8;

        // Generate board
        game.board = generateBoard(game.language, game.startingTeam);
        if (!game.board) {
            socket.emit('cn-error', { message: 'Failed to generate board. Not enough words.' });
            return;
        }

        game.state = 'playing';
        game.gameLog.push({ type: 'start', message: `Game started! Team ${game.startingTeam.toUpperCase()} goes first.` });

        // Send personalized game state to each player (spies see all, operatives don't)
        for (const [odiscordId, player] of game.players.entries()) {
            if (player.socketId) {
                const playerSocket = cnIO.sockets.get(player.socketId);
                if (playerSocket) {
                    playerSocket.emit('cn-game-started', getCodenamesGameState(game, odiscordId));
                }
            }
        }

        console.log(`Codenames game ${sessionId} started (${game.language}, starting: ${game.startingTeam})`);
    });

    // Spy gives a clue
    socket.on('cn-spy-clue', (data) => {
        const { sessionId, word, number } = data;
        const game = codenamesGames.get(sessionId);
        if (!game || game.state !== 'playing') return;

        const odiscordId = socket.cnDiscordId;
        const player = game.players.get(odiscordId);
        if (!player || player.role !== 'spy' || player.team !== game.currentTurn) return;
        if (game.currentPhase !== 'spy_clue') return;

        const clueWord = (word || '').trim();
        const clueNumber = parseInt(number) || 0;

        if (!clueWord || clueWord.includes(' ')) {
            socket.emit('cn-error', { message: 'Clue must be a single word.' });
            return;
        }

        // Check if clue word is one of the board words
        const boardWords = game.board.filter(c => !c.revealed).map(c => c.word.toLowerCase());
        if (boardWords.includes(clueWord.toLowerCase())) {
            socket.emit('cn-error', { message: 'Clue cannot be a word that is currently on the board.' });
            return;
        }

        game.currentClue = { word: clueWord, number: clueNumber };
        // 0 means unlimited (they still get infinity + 1, effectively unlimited)
        game.guessesRemaining = clueNumber === 0 ? 99 : clueNumber + 1;
        game.currentPhase = 'operative_guess';

        game.gameLog.push({
            type: 'clue',
            team: game.currentTurn,
            message: `🕵️ Team ${game.currentTurn.toUpperCase()} Spy: "${clueWord}" — ${clueNumber === 0 ? '∞' : clueNumber}`
        });

        // Broadcast to all players
        for (const [pid, p] of game.players.entries()) {
            if (p.socketId) {
                const s = cnIO.sockets.get(p.socketId);
                if (s) s.emit('cn-clue-given', getCodenamesGameState(game, pid));
            }
        }

        // Start turn timer if configured
        if (game.turnTimer > 0) {
            startTurnTimer(sessionId, game);
        }
    });

    // Operative guesses a card
    socket.on('cn-operative-guess', (data) => {
        const { sessionId, cardIndex } = data;
        const game = codenamesGames.get(sessionId);
        if (!game || game.state !== 'playing') return;

        const odiscordId = socket.cnDiscordId;
        const player = game.players.get(odiscordId);
        if (!player || player.role !== 'operative' || player.team !== game.currentTurn) return;
        if (game.currentPhase !== 'operative_guess') return;
        if (game.guessesRemaining <= 0) return;

        const card = game.board[cardIndex];
        if (!card || card.revealed) return;

        // Reveal the card
        card.revealed = true;
        card.revealedBy = game.currentTurn;
        game.guessesRemaining--;

        let turnEnds = false;
        let gameEnds = false;
        let logMsg = '';

        if (card.type === 'assassin') {
            // Picked the assassin — instant loss
            const loser = game.currentTurn;
            const winner = loser === 'a' ? 'b' : 'a';
            logMsg = `💀 Team ${game.currentTurn.toUpperCase()} picked the ASSASSIN ("${card.word}")! Team ${winner.toUpperCase()} wins!`;
            game.gameLog.push({ type: 'assassin', team: game.currentTurn, message: logMsg });
            gameEnds = true;

            // Broadcast final state then end
            for (const [pid, p] of game.players.entries()) {
                if (p.socketId) {
                    const s = cnIO.sockets.get(p.socketId);
                    if (s) s.emit('cn-card-revealed', {
                        ...getCodenamesGameState(game, pid),
                        revealedCard: { index: cardIndex, ...card }
                    });
                }
            }
            endCodenamesGame(sessionId, winner, logMsg);
            return;

        } else if (card.type === `team_${game.currentTurn}`) {
            // Correct guess — team's own card
            game.score[game.currentTurn]++;
            logMsg = `✅ Team ${game.currentTurn.toUpperCase()} found their agent: "${card.word}" (${game.score[game.currentTurn]}/${game.target[game.currentTurn]})`;

            // Check win
            const winCheck = checkWinCondition(game);
            if (winCheck) {
                game.gameLog.push({ type: 'correct', team: game.currentTurn, message: logMsg });
                for (const [pid, p] of game.players.entries()) {
                    if (p.socketId) {
                        const s = cnIO.sockets.get(p.socketId);
                        if (s) s.emit('cn-card-revealed', {
                            ...getCodenamesGameState(game, pid),
                            revealedCard: { index: cardIndex, ...card }
                        });
                    }
                }
                endCodenamesGame(sessionId, winCheck.winner, winCheck.reason);
                return;
            }

            // Continue guessing if guesses remain
            if (game.guessesRemaining <= 0) {
                turnEnds = true;
            }

        } else if (card.type === 'neutral') {
            // Neutral card — turn ends
            logMsg = `😐 Team ${game.currentTurn.toUpperCase()} hit a bystander: "${card.word}". Turn over.`;
            turnEnds = true;

        } else {
            // Opponent's card — turn ends + point to opponent
            const otherTeam = game.currentTurn === 'a' ? 'b' : 'a';
            game.score[otherTeam]++;
            logMsg = `❌ Team ${game.currentTurn.toUpperCase()} picked Team ${otherTeam.toUpperCase()}'s agent: "${card.word}"! Turn over.`;
            turnEnds = true;

            // Check if the OTHER team wins because of this
            const winCheck = checkWinCondition(game);
            if (winCheck) {
                game.gameLog.push({ type: 'opponent', team: game.currentTurn, message: logMsg });
                for (const [pid, p] of game.players.entries()) {
                    if (p.socketId) {
                        const s = cnIO.sockets.get(p.socketId);
                        if (s) s.emit('cn-card-revealed', {
                            ...getCodenamesGameState(game, pid),
                            revealedCard: { index: cardIndex, ...card }
                        });
                    }
                }
                endCodenamesGame(sessionId, winCheck.winner, winCheck.reason);
                return;
            }
        }

        game.gameLog.push({ type: card.type === `team_${game.currentTurn}` ? 'correct' : (card.type === 'neutral' ? 'neutral' : 'opponent'), team: game.currentTurn, message: logMsg });

        if (turnEnds) {
            switchTurn(game);
        }

        // Broadcast updated state
        for (const [pid, p] of game.players.entries()) {
            if (p.socketId) {
                const s = cnIO.sockets.get(p.socketId);
                if (s) s.emit('cn-card-revealed', {
                    ...getCodenamesGameState(game, pid),
                    revealedCard: { index: cardIndex, ...card }
                });
            }
        }
    });

    // Operatives end turn voluntarily
    socket.on('cn-end-turn', (data) => {
        const { sessionId } = data;
        const game = codenamesGames.get(sessionId);
        if (!game || game.state !== 'playing') return;

        const odiscordId = socket.cnDiscordId;
        const player = game.players.get(odiscordId);
        if (!player || player.role !== 'operative' || player.team !== game.currentTurn) return;
        if (game.currentPhase !== 'operative_guess') return;

        game.gameLog.push({ type: 'end_turn', team: game.currentTurn, message: `Team ${game.currentTurn.toUpperCase()} ended their turn.` });
        switchTurn(game);

        for (const [pid, p] of game.players.entries()) {
            if (p.socketId) {
                const s = cnIO.sockets.get(p.socketId);
                if (s) s.emit('cn-turn-changed', getCodenamesGameState(game, pid));
            }
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        const sessionId = socket.cnSessionId;
        const odiscordId = socket.cnDiscordId;

        if (sessionId && odiscordId) {
            const game = codenamesGames.get(sessionId);
            if (game) {
                const player = game.players.get(odiscordId);
                if (player) {
                    player.socketId = null;
                }
                cnIO.to(`codenames_${sessionId}`).emit('cn-lobby-update', getCodenamesLobbyState(game));

                // If no connected players remain, start grace period (all states)
                const connectedPlayers = Array.from(game.players.values()).filter(p => p.socketId);
                if (connectedPlayers.length === 0 && !game.disconnectTimer) {
                    const gracePeriod = game.state === 'lobby' ? 60000 : 120000; // 1 min lobby, 2 min in-game
                    console.log(`Codenames ${sessionId}: all players disconnected, ${gracePeriod / 1000}s grace period started`);
                    game.disconnectTimer = setTimeout(() => {
                        const g = codenamesGames.get(sessionId);
                        if (g) {
                            const stillConnected = Array.from(g.players.values()).filter(p => p.socketId);
                            if (stillConnected.length === 0) {
                                destroyCodenamesGame(sessionId, 'All players disconnected.');
                            }
                        }
                    }, gracePeriod);

                    // Also clear turn timers when everyone disconnects during playing
                    if (game.state === 'playing') {
                        if (game.turnTimeout) { clearTimeout(game.turnTimeout); game.turnTimeout = null; }
                        if (game.turnInterval) { clearInterval(game.turnInterval); game.turnInterval = null; }
                    }
                }
            }
        }
        console.log(`Codenames socket disconnected: ${socket.id}`);
    });

    // Host restarts game (returns to lobby)
    socket.on('cn-restart-game', (data) => {
        const { sessionId } = data;
        const game = codenamesGames.get(sessionId);
        if (!game) return;

        if (socket.cnDiscordId !== game.host.odiscordId) {
            socket.emit('cn-error', { message: 'Only the host can restart the game.' });
            return;
        }

        if (game.state !== 'finished') {
            socket.emit('cn-error', { message: 'Game is not finished yet.' });
            return;
        }

        // Reset game state back to lobby
        game.state = 'lobby';
        game.board = [];
        game.startingTeam = null;
        game.currentTurn = null;
        game.currentPhase = null;
        game.currentClue = null;
        game.guessesRemaining = 0;
        game.score = { a: 0, b: 0 };
        game.target = { a: 0, b: 0 };
        game.gameLog = [];
        game.createdAt = Date.now(); // refresh timeout

        // Clear turn timers
        if (game.turnTimeout) { clearTimeout(game.turnTimeout); game.turnTimeout = null; }
        if (game.turnInterval) { clearInterval(game.turnInterval); game.turnInterval = null; }

        // Keep players on their teams/roles — just reset for a new round

        // Broadcast lobby restart
        cnIO.to(`codenames_${sessionId}`).emit('cn-game-restarted', getCodenamesLobbyState(game));

        console.log(`Codenames game ${sessionId} restarted to lobby by host`);
    });
});

function switchTurn(game) {
    // Clear any existing turn timer
    if (game.turnTimeout) {
        clearTimeout(game.turnTimeout);
        game.turnTimeout = null;
    }
    if (game.turnInterval) {
        clearInterval(game.turnInterval);
        game.turnInterval = null;
    }
    game.currentTurn = game.currentTurn === 'a' ? 'b' : 'a';
    game.currentPhase = 'spy_clue';
    game.currentClue = null;
    game.guessesRemaining = 0;
}

function startTurnTimer(sessionId, game) {
    // Clear any existing timer
    if (game.turnTimeout) {
        clearTimeout(game.turnTimeout);
        game.turnTimeout = null;
    }
    if (game.turnInterval) {
        clearInterval(game.turnInterval);
        game.turnInterval = null;
    }

    let remaining = game.turnTimer;

    // Broadcast initial countdown
    cnIO.to(`codenames_${sessionId}`).emit('cn-timer-tick', { remaining });

    // Tick every second
    game.turnInterval = setInterval(() => {
        remaining--;
        cnIO.to(`codenames_${sessionId}`).emit('cn-timer-tick', { remaining });

        if (remaining <= 0) {
            clearInterval(game.turnInterval);
            game.turnInterval = null;

            // Auto-end the turn
            if (game.state === 'playing' && game.currentPhase === 'operative_guess') {
                game.gameLog.push({ type: 'timeout', team: game.currentTurn, message: `⏰ Team ${game.currentTurn.toUpperCase()}'s time ran out!` });
                switchTurn(game);

                for (const [pid, p] of game.players.entries()) {
                    if (p.socketId) {
                        const s = cnIO.sockets.get(p.socketId);
                        if (s) s.emit('cn-turn-changed', getCodenamesGameState(game, pid));
                    }
                }
            }
        }
    }, 1000);

    game.turnTimeout = setTimeout(() => { }, game.turnTimer * 1000); // keep ref for cleanup
}

// ========== UPLOAD ROUTES (unchanged) ==========

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

module.exports = { initServer, createSession, createTriviaSession, createCodenamesSession };
