// backend/models/message.model.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    // We remove userId and add conversationId
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);