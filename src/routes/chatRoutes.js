const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Helper middleware to ensure authentication
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: 'Unauthorized' });
};

// Create a new empty chat row
router.post('/new', ensureAuthenticated, chatController.createChat);

// Get list of all chat sessions (for the sidebar: only _id and title)
router.get('/list', ensureAuthenticated, chatController.getChatList);

// Get the full history of a SPECIFIC chat session
router.get('/history/:chatId', ensureAuthenticated, chatController.getChatHistory);

router.delete('/delete/:chatId', ensureAuthenticated, chatController.deleteChat);
router.delete('/clear-all', ensureAuthenticated, chatController.clearChatHistory);

module.exports = router;
