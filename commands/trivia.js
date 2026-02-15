const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Path to store trivia scores
const TRIVIA_SCORES_PATH = path.join(__dirname, '../data/trivia_scores.json');

// Ensure the data directory exists
if (!fs.existsSync(path.dirname(TRIVIA_SCORES_PATH))) {
    fs.mkdirSync(path.dirname(TRIVIA_SCORES_PATH), { recursive: true });
}

// Load existing scores or create empty scores object
let triviaScores = {};
try {
    if (fs.existsSync(TRIVIA_SCORES_PATH)) {
        triviaScores = JSON.parse(fs.readFileSync(TRIVIA_SCORES_PATH, 'utf8'));
    } else {
        // Initialize empty scores file
        fs.writeFileSync(TRIVIA_SCORES_PATH, JSON.stringify({}), 'utf8');
    }
} catch (error) {
    console.error('Error loading trivia scores:', error);
}

// Save scores to file
function saveScores() {
    try {
        fs.writeFileSync(TRIVIA_SCORES_PATH, JSON.stringify(triviaScores, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving trivia scores:', error);
    }
}



// Fetch trivia questions from Open Trivia DB
async function fetchTriviaQuestions(amount = 5, category = '', difficulty = '') {
    try {
        let url = `https://opentdb.com/api.php?amount=${amount}&type=multiple`;

        if (category) {
            url += `&category=${category}`;
        }

        if (difficulty) {
            url += `&difficulty=${difficulty}`;
        }

        // Add timeout to prevent hanging on slow responses
        const response = await axios.get(url, { timeout: 8000 });

        if (response.data.response_code === 0) {
            // Pre-decode all questions and answers to avoid issues
            return response.data.results.map(question => {
                return {
                    ...question,
                    question: decodeHTML(question.question),
                    correct_answer: decodeHTML(question.correct_answer),
                    incorrect_answers: question.incorrect_answers.map(a => decodeHTML(a))
                };
            });
        } else {
            console.error('Error fetching trivia questions:', response.data);
            return null;
        }
    } catch (error) {
        console.error('Error fetching trivia questions:', error);
        return null;
    }
}

// Decode HTML entities in the trivia questions and answers
function decodeHTML(html) {
    // Fix for Node.js environment (no document object)
    return html
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#039;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"');
}

// Move the showLeaderboard function to the top level of the file so it can be accessed globally
async function showLeaderboard(interaction) {
    try {
        // Sort all players by score
        const allPlayers = Object.values(triviaScores)
            .sort((a, b) => b.totalScore - a.totalScore);

        // Create the leaderboard embed
        const leaderboardEmbed = new EmbedBuilder()
            .setTitle('🏆 Trivia Leaderboard')
            .setDescription('All-time trivia rankings:')
            .setColor('#4B0082')
            .setTimestamp();

        // Add player entries (show all players)
        let leaderboardText = '';

        if (allPlayers.length === 0) {
            leaderboardText = 'No players have participated yet!';
        } else {
            allPlayers.forEach((player, index) => {
                const accuracy = player.totalQuestions > 0
                    ? Math.round((player.correctAnswers / player.totalQuestions) * 100)
                    : 0;

                leaderboardText += `${index + 1}. **${player.username}**\n` +
                    `   • Total Score: ${player.totalScore} points\n` +
                    `   • Games Played: ${player.gamesPlayed}\n` +
                    `   • Accuracy: ${accuracy}%\n` +
                    `   • Correct Answers: ${player.correctAnswers}/${player.totalQuestions}\n\n`;
            });
        }

        // Split the leaderboard into fields if it's too long
        const chunks = leaderboardText.match(/.{1,1024}/gs) || [];
        chunks.forEach((chunk, index) => {
            leaderboardEmbed.addFields({
                name: index === 0 ? '📊 Rankings' : '📊 Rankings (continued)',
                value: chunk,
                inline: false
            });
        });

        // Add a footer with total player count
        leaderboardEmbed.setFooter({
            text: `Total Players: ${allPlayers.length} | Updated: ${new Date().toLocaleString()}`
        });

        // If the interaction hasn't been deferred, defer it
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => { });
        }

        // Send the leaderboard embed
        await interaction.editReply({ embeds: [leaderboardEmbed], components: [] });
    } catch (error) {
        console.error('Error showing leaderboard:', error);
        // Only send error message if we haven't sent a response yet
        if (!interaction.replied) {
            await interaction.reply({
                content: '',
                ephemeral: true
            });
        }
    }
}

// Handle the trivia command
async function handleTriviaCommand(interaction) {
    try {
        // Defer the reply immediately at the start
        await interaction.deferReply();

        const amount = interaction.options.getInteger('questions') || 5;
        const categoryName = interaction.options.getString('category');
        const difficulty = interaction.options.getString('difficulty');

        // Map category names to IDs
        const categoryMap = {
            'general': 9,
            'books': 10,
            'film': 11,
            'music': 12,
            'television': 14,
            'videogames': 15,
            'science': 17,
            'computers': 18,
            'mathematics': 19,
            'sports': 21,
            'geography': 22,
            'history': 23,
            'politics': 24,
            'art': 25,
            'animals': 27,
            'vehicles': 28,
            'comics': 29,
            'gadgets': 30,
            'anime': 31,
            'cartoons': 32,
            'mythology': 20,
            'boardgames': 16,
            'celebrities': 26
        };

        let categoryId = '';
        if (categoryName && categoryMap[categoryName.toLowerCase()]) {
            categoryId = categoryMap[categoryName.toLowerCase()];
        }

        const questions = await fetchTriviaQuestions(amount, categoryId, difficulty);

        if (!questions || questions.length === 0) {
            return interaction.editReply('Sorry, I couldn\'t fetch any trivia questions at the moment. Please try again later.');
        }

        // Start the trivia game
        let currentQuestionIndex = 0;
        let score = 0;
        const userAnswers = [];
        const participantScores = {};
        const creatorId = interaction.user.id;
        let lastAnswerTime = Date.now();
        let answeredUsers = new Set(); // Track users who answered the current question

        // Function to show the current question
        async function showQuestion() {
            const question = questions[currentQuestionIndex];
            answeredUsers.clear(); // Reset the list of users who answered

            // Combine correct and incorrect answers and shuffle them
            const answers = [
                decodeHTML(question.correct_answer),
                ...question.incorrect_answers.map(a => decodeHTML(a))
            ].sort(() => Math.random() - 0.5);

            // Create the question embed
            const embed = new EmbedBuilder()
                .setTitle(`Trivia Question ${currentQuestionIndex + 1}/${questions.length}`)
                .setDescription(`**Category:** ${question.category}\n**Difficulty:** ${question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}\n\n**${decodeHTML(question.question)}**`)
                .setColor('#FFD700')
                .setFooter({ text: `Started by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            // Create buttons for answers
            const row = new ActionRowBuilder();

            answers.forEach((answer, index) => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`trivia_answer_${index}`)
                        .setLabel(String.fromCharCode(65 + index)) // A, B, C, D
                        .setStyle(ButtonStyle.Primary)
                );
            });

            // Add answer text to embed
            answers.forEach((answer, index) => {
                embed.addFields({ name: `${String.fromCharCode(65 + index)}.`, value: answer, inline: false });
            });

            // Add participant scores to the embed
            if (Object.keys(participantScores).length > 0) {
                let scoreText = '';
                Object.values(participantScores)
                    .sort((a, b) => b.score - a.score)
                    .forEach((participant) => {
                        scoreText += `**${participant.username}**: ${participant.score} points\n`;
                    });

                embed.addFields({ name: '🏆 Current Scores', value: scoreText, inline: false });
            }

            // Send or update the message
            let message;
            if (currentQuestionIndex === 0) {
                message = await interaction.editReply({ embeds: [embed], components: [row], fetchReply: true });
            } else {
                message = await interaction.editReply({ embeds: [embed], components: [row] });
            }

            // Set up collector for multiple answers
            const filter = i => i.customId.startsWith('trivia_answer_') && !answeredUsers.has(i.user.id);
            const collector = message.createMessageComponentCollector({
                filter,
                time: 20000 // 20 seconds per question
            });

            // Handle answer submissions
            collector.on('collect', async (response) => {
                try {
                    // Get the selected answer index
                    const selectedIndex = parseInt(response.customId.replace('trivia_answer_', ''));
                    const selectedAnswer = answers[selectedIndex];
                    const isCorrect = selectedAnswer === decodeHTML(question.correct_answer);
                    const respondingUser = response.user;

                    // Mark this user as having answered
                    answeredUsers.add(respondingUser.id);

                    // Track participant scores
                    if (!participantScores[respondingUser.id]) {
                        participantScores[respondingUser.id] = {
                            id: respondingUser.id,
                            username: respondingUser.username,
                            score: 0,
                            answers: 0
                        };
                    }

                    if (isCorrect) {
                        participantScores[respondingUser.id].score++;
                    }
                    participantScores[respondingUser.id].answers++;

                    // Update creator's score if they answered
                    if (respondingUser.id === creatorId && isCorrect) {
                        score++;
                    }

                    // Store the user's answer
                    userAnswers.push({
                        question: question.question,
                        userAnswer: selectedAnswer,
                        correctAnswer: question.correct_answer,
                        isCorrect,
                        answeredBy: respondingUser.username
                    });

                    // Show feedback to the user who answered
                    const feedbackEmbed = new EmbedBuilder()
                        .setTitle(isCorrect ? '✅ Correct!' : '❌ Incorrect!')
                        .setDescription(`You answered: **${selectedAnswer}**\n\n${isCorrect ? 'Great job!' : `The correct answer was: **${decodeHTML(question.correct_answer)}**`}`)
                        .setColor(isCorrect ? '#00FF00' : '#FF0000');

                    // Use deferUpdate() first to acknowledge the interaction, then follow up with an ephemeral message
                    await response.deferUpdate().catch(e => console.error('Error deferring update:', e));

                    // Send ephemeral feedback as a follow-up message
                    await response.followUp({ embeds: [feedbackEmbed], ephemeral: true })
                        .catch(error => {
                            console.error('Error sending follow-up message:', error);
                            // If we can't send a follow-up, we'll just continue with the game
                        });

                    // Update the main embed with current scores
                    let scoreText = '';
                    Object.values(participantScores)
                        .sort((a, b) => b.score - a.score)
                        .forEach((participant) => {
                            const hasAnswered = answeredUsers.has(participant.id) ? '✓ ' : '';
                            scoreText += `${hasAnswered}**${participant.username}**: ${participant.score} points\n`;
                        });

                    const updatedEmbed = EmbedBuilder.from(embed);

                    // Update or add the scores field
                    const scoreFieldIndex = updatedEmbed.data.fields.findIndex(field => field.name === '🏆 Current Scores');
                    if (scoreFieldIndex !== -1) {
                        updatedEmbed.data.fields[scoreFieldIndex].value = scoreText;
                    } else {
                        updatedEmbed.addFields({ name: '🏆 Current Scores', value: scoreText, inline: false });
                    }

                    // Update the main message with new scores
                    await interaction.editReply({ embeds: [updatedEmbed], components: [row] })
                        .catch(error => {
                            console.error('Error updating main message:', error);
                        });
                } catch (error) {
                    console.error('Error handling button interaction:', error);
                    // Continue with the game even if there's an error with one user's interaction
                }
            });

            // When the time is up
            collector.on('end', async (collected) => {
                // Show the correct answer to everyone
                const correctAnswer = decodeHTML(question.correct_answer);
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏱️ Time\'s Up!')
                    .setDescription(`The correct answer was: **${correctAnswer}**\n\n${collected.size} users answered this question.`)
                    .setColor('#FF9900');

                // Add participant scores to the embed
                if (Object.keys(participantScores).length > 0) {
                    let scoreText = '';
                    Object.values(participantScores)
                        .sort((a, b) => b.score - a.score)
                        .forEach((participant) => {
                            scoreText += `**${participant.username}**: ${participant.score} points\n`;
                        });

                    timeoutEmbed.addFields({ name: '🏆 Current Scores', value: scoreText, inline: false });
                }

                await interaction.editReply({ embeds: [timeoutEmbed], components: [] });

                // If no one answered, record it
                if (collected.size === 0) {
                    userAnswers.push({
                        question: question.question,
                        userAnswer: 'Timeout',
                        correctAnswer: question.correct_answer,
                        isCorrect: false,
                        answeredBy: 'No one'
                    });
                }

                // Move to the next question after a delay
                setTimeout(async () => {
                    currentQuestionIndex++;

                    if (currentQuestionIndex < questions.length) {
                        await showQuestion();
                    } else {
                        await showResults();
                    }
                }, 3000);
            });
        }

        // Function to show final results
        async function showResults() {
            // Update scores for all participants
            Object.entries(participantScores).forEach(([userId, userData]) => {
                // Update the user's total score
                if (!triviaScores[userId]) {
                    triviaScores[userId] = {
                        username: userData.username,
                        totalScore: 0,
                        gamesPlayed: 0,
                        correctAnswers: 0,
                        totalQuestions: 0
                    };
                }

                triviaScores[userId].username = userData.username;
                triviaScores[userId].totalScore += userData.score;
                triviaScores[userId].gamesPlayed += 1;
                triviaScores[userId].correctAnswers += userData.score;
                triviaScores[userId].totalQuestions += userData.answers;

                saveScores();
            });

            // Get top 5 players
            const topPlayers = Object.values(triviaScores)
                .sort((a, b) => b.totalScore - a.totalScore)
                .slice(0, 5);

            // Create the results embed
            const resultsEmbed = new EmbedBuilder()
                .setTitle('🎮 Trivia Results')
                .setDescription(`Game started by **${interaction.user.username}**\n${Object.keys(participantScores).length} players participated!`)
                .setColor('#4B0082')
                .setThumbnail(interaction.user.displayAvatarURL())
                .setFooter({ text: `Thanks for playing!` })
                .setTimestamp();

            // Add participant results for this game
            let participantText = '';
            Object.values(participantScores)
                .sort((a, b) => b.score - a.score)
                .forEach((participant, index) => {
                    participantText += `${index + 1}. **${participant.username}**: ${participant.score}/${participant.answers} correct\n`;
                });

            if (participantText) {
                resultsEmbed.addFields(
                    { name: '🏅 This Game\'s Participants', value: participantText, inline: false }
                );
            }

            // Add leaderboard
            let leaderboardText = '';
            topPlayers.forEach((player, index) => {
                leaderboardText += `${index + 1}. **${player.username}**: ${player.totalScore} points (${Math.round((player.correctAnswers / player.totalQuestions) * 100)}% accuracy)\n`;
            });

            resultsEmbed.addFields(
                { name: '🏆 All-Time Leaderboard', value: leaderboardText || 'No players yet', inline: false }
            );

            // Add a summary of the questions and answers
            let summaryText = '';
            userAnswers.forEach((answer, index) => {
                summaryText += `**Q${index + 1}**: ${answer.isCorrect ? '✅' : '❌'} ${decodeHTML(answer.question).substring(0, 30)}${answer.question.length > 30 ? '...' : ''} (${answer.answeredBy})\n`;
            });

            resultsEmbed.addFields(
                { name: 'Summary', value: summaryText, inline: false }
            );

            // Create button for playing again
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('trivia_play_again')
                        .setLabel('Play Again')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('trivia_leaderboard')
                        .setLabel('View Full Leaderboard')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.editReply({ embeds: [resultsEmbed], components: [row] });

            // Collect button interactions
            try {
                // Allow anyone to start a new game or view leaderboard
                const filter = i => i.customId === 'trivia_play_again' || i.customId === 'trivia_leaderboard';
                const response = await interaction.channel.awaitMessageComponent({ filter, time: 60000 });

                // Acknowledge the button interaction immediately
                await response.deferUpdate();

                if (response.customId === 'trivia_play_again') {
                    // Create a new interaction for the new game
                    const newInteraction = {
                        user: response.user,
                        options: {
                            getInteger: (name) => name === 'questions' ? amount : null,
                            getString: (name) => {
                                if (name === 'category') return categoryName;
                                if (name === 'difficulty') return difficulty;
                                return null;
                            }
                        },
                        channel: interaction.channel,
                        deferReply: async () => response.editReply({ content: 'Starting new game...' }),
                        editReply: async (content) => response.editReply(content)
                    };

                    // Start a new game
                    await handleTriviaCommand(newInteraction);
                } else if (response.customId === 'trivia_leaderboard') {
                    await showLeaderboard(response);
                }
            } catch (error) {
                console.error('Error handling button interaction:', error);
                // Don't try to respond to the interaction here, as it might have timed out
            }
        }

        // Start showing questions
        await showQuestion();
    } catch (error) {
        console.error('Error in handleTriviaCommand:', error);
        // Only try to reply if the interaction hasn't been acknowledged
        if (!interaction.deferred && !interaction.replied) {
            await interaction.reply({
                content: 'There was an error starting the trivia game. Please try again.',
                ephemeral: true
            });
        }
    }
}


// Export the command with the handleButton function
module.exports = {
    name: 'trivia',
    description: 'Play a trivia game with multiple-choice questions',
    execute: async function (interaction) {
        return handleTriviaCommand(interaction);
    },
    handleButton: async function (interaction) {
        const customId = interaction.customId;

        if (customId === 'trivia_play_again') {
            // Create a completely new interaction for the new game
            const newOptions = {
                questions: 5, // Default amount
                category: null,
                difficulty: null
            };

            // Create a new interaction object with default options
            const newInteraction = {
                user: interaction.user,
                options: {
                    getInteger: (name) => name === 'questions' ? newOptions.questions : null,
                    getString: (name) => {
                        if (name === 'category') return newOptions.category;
                        if (name === 'difficulty') return newOptions.difficulty;
                        return null;
                    }
                },
                deferReply: async () => interaction.deferUpdate(),
                editReply: async (content) => interaction.editReply(content),
                channel: interaction.channel
            };

            // Start a completely new game
            await handleTriviaCommand(newInteraction);
        } else if (customId === 'trivia_leaderboard') {
            // Show full leaderboard
            await showLeaderboard(interaction);
        }
    }
};