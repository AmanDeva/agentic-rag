// backend/models/conversation.model.js
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, default: 'New Conversation' },
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);