const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    originalText: { type: String, required: true },
    simplifiedOutput: { type: mongoose.Schema.Types.Mixed, required: true },
    uploadedFiles: [{ type: String }],
    audienceLevel: { type: String, default: 'manager' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('History', historySchema);
