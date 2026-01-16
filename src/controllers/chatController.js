const Message = require('../models/Message');

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
