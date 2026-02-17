const Message = require('../models/Message');
const redisService = require('../services/redisService');

// Create a brand new empty chat row
exports.createChat = async (req, res) => {
    try {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Check if the user has reached the limit of 5 chats
        const chatCount = await Message.countDocuments({ userId: req.user._id });
        if (chatCount >= 5) {
            return res.status(403).json({
                message: 'Chat limit reached. You can only have up to 5 chats. Please delete an existing chat to create a new one.'
            });
        }

        const newChat = await Message.create({
            userId: req.user._id,
            title: 'New Chat',
            history: []
        });

        res.status(201).json({ chatId: newChat._id, title: newChat.title });
    } catch (error) {
        console.error('Error creating new chat:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// 1. Get ONLY IDs and Titles for the Sidebar
exports.getChatList = async (req, res) => {
    try {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const chats = await Message.find({ userId: req.user._id })
            .select('_id title updatedAt') // Only select what we need for the sidebar
            .sort({ updatedAt: -1 });

        res.json(chats);
    } catch (error) {
        console.error('Error fetching chat list:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// 2. Get FULL History for a specific Chat
exports.getChatHistory = async (req, res) => {
    try {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { chatId } = req.params;
        const chat = await Message.findOne({ _id: chatId, userId: req.user._id });

        if (!chat) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        res.json(chat.history);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.deleteChat = async (req, res) => {
    try {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { chatId } = req.params;
        await Message.findOneAndDelete({ _id: chatId, userId: req.user._id });
        res.json({ message: 'Chat deleted' });
    } catch (error) {
        console.error('Error deleting chat:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.clearChatHistory = async (req, res) => {
    try {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Clear every chat row for this user
        await Message.deleteMany({ userId: req.user._id });
        res.json({ message: 'All chat history cleared' });
    } catch (error) {
        console.error('Error clearing chat history:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Stream Chat Response via Redis Pub/Sub
exports.streamChat = async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const { question, chatId, mode } = req.body;

    if (!question || !chatId) {
        return res.status(400).json({ message: 'Missing question or chatId' });
    }

    // Check Redis connection
    if (!redisService.checkConnection()) {
        return res.status(503).json({ message: 'Redis service unavailable' });
    }

    // Set headers for streaming response to frontend
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    let fullAnswer = '';
    const responseChannel = `aiml:responses:${chatId}`;
    let isSubscribed = false;

    try {
        // Subscribe to response channel BEFORE publishing request
        await redisService.subscribe(responseChannel, async (message) => {
            try {
                const { token, done, error } = message;

                if (error) {
                    console.error('Error from AIML service:', error);
                    if (!res.headersSent) {
                        res.status(500).json({ message: error });
                    } else {
                        res.end();
                    }
                    await redisService.unsubscribe(responseChannel);
                    return;
                }

                if (done) {
                    console.log('✅ Streaming complete. Full answer length:', fullAnswer.length);

                    // End the response stream
                    res.end();

                    // Save to Database
                    try {
                        const chat = await Message.findOne({ _id: chatId, userId: req.user._id });
                        if (chat) {
                            const updateData = {
                                $push: { history: { question: question, answer: fullAnswer } }
                            };

                            // If it's the first message, update the title too
                            if (chat.history.length === 0) {
                                updateData.title = question.substring(0, 30);
                            }

                            await Message.findByIdAndUpdate(chatId, updateData);
                            console.log('💾 Chat history saved to database');
                        }
                    } catch (dbError) {
                        console.error('Error saving chat history:', dbError);
                    }

                    // Unsubscribe from channel
                    await redisService.unsubscribe(responseChannel);
                    return;
                }

                // Stream token to frontend
                if (token) {
                    fullAnswer += token;
                    res.write(token);
                    if (res.flush) res.flush(); // Force send immediately
                }
            } catch (err) {
                console.error('Error processing message:', err);
            }
        });

        isSubscribed = true;
        console.log('✅ Subscription established, waiting for confirmation...');

        // CRITICAL: Add small delay to ensure subscription is fully established
        // Redis subscribe() is async but may not be immediately ready to receive messages
        await new Promise(resolve => setTimeout(resolve, 100));

        // Publish request to AIML service
        const requestPayload = {
            chatId: chatId,
            question: question,
            mode: mode || 'lite',
            current_year: 2026,
            timestamp: new Date().toISOString()
        };

        await redisService.publish('aiml:requests', requestPayload);
        console.log('📤 Published request to AIML service');

    } catch (error) {
        console.error('Error in streamChat:', error);

        if (isSubscribed) {
            await redisService.unsubscribe(responseChannel);
        }

        if (!res.headersSent) {
            res.status(500).json({ message: 'Internal Server Error' });
        } else {
            res.end();
        }
    }

    // Handle client disconnect
    req.on('close', async () => {
        console.log('Client disconnected, cleaning up subscription');
        if (isSubscribed) {
            await redisService.unsubscribe(responseChannel);
        }
    });
};
