// backend/routes/chat.routes.js
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const Message = require('../models/message.model');
const Conversation = require('../models/conversation.model'); // Import new model
const router = express.Router();

// Middleware to verify token and get userId
const auth = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).send({ error: 'Authentication failed' });
    }
};

// --- NEW CONVERSATION-BASED ROUTES ---

// GET all conversations for the logged-in user
router.get('/conversations', auth, async (req, res) => {
    try {
        const conversations = await Conversation.find({ userId: req.userId }).sort({ updatedAt: -1 });
        res.send(conversations);
    } catch (error) {
        res.status(500).send({ error: 'Failed to fetch conversations' });
    }
});

// GET all messages for a specific conversation
router.get('/messages/:conversationId', auth, async (req, res) => {
    try {
        // Ensure the user owns this conversation
        const conversation = await Conversation.findOne({ _id: req.params.conversationId, userId: req.userId });
        if (!conversation) {
            return res.status(404).send({ error: "Conversation not found or access denied." });
        }
        const messages = await Message.find({ conversationId: req.params.conversationId }).sort({ createdAt: 1 });
        res.send(messages);
    } catch (error) {
        res.status(500).send({ error: 'Failed to fetch messages' });
    }
});

// POST a new message to a conversation (or create a new one)
router.post('/new', auth, async (req, res) => {
    try {
        const { message, conversationId } = req.body; // Can be a new or existing conversation
        let conversation;

        if (conversationId) {
            conversation = await Conversation.findOne({ _id: conversationId, userId: req.userId });
        } else {
            // Create a new conversation
            const title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
            conversation = new Conversation({ userId: req.userId, title: title });
            await conversation.save();
        }

        if (!conversation) {
            return res.status(404).send({ error: 'Conversation not found or access denied.' });
        }

        // Save user message
        const userMessage = new Message({ conversationId: conversation._id, role: 'user', content: message });
        await userMessage.save();
        
        // Call RAG API
        const ragResponse = await axios.post(process.env.RAG_API_URL, { question: message });
        const assistantMessageContent = ragResponse.data.answer;

        // Save assistant message
        const assistantMessage = new Message({ conversationId: conversation._id, role: 'assistant', content: assistantMessageContent });
        await assistantMessage.save();

        res.send({ 
            assistantMessage: { role: 'assistant', content: assistantMessageContent },
            newConversation: conversationId ? undefined : conversation // Send back new conversation if one was created
        });

    } catch (error) {
        res.status(500).send({ error: 'Failed to get response from RAG agent' });
    }
});

module.exports = router;