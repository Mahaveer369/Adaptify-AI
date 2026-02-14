const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyToken } = require('../middleware/auth');

// POST /api/summarize — Quick text summarization
router.post('/', verifyToken, async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'No text provided' });
        }

        const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';

        try {
            const response = await axios.post(`${fastApiUrl}/summarize`, {
                text: text
            }, { timeout: 60000 });

            res.json({ success: true, ...response.data });
        } catch (apiErr) {
            console.error('FastAPI /summarize call failed:', apiErr.message);
            // Fallback
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 15).slice(0, 3);
            res.json({
                success: true,
                summary: sentences.join('. ').trim() + '.' || text.substring(0, 300),
                word_count: text.split(/\s+/).length,
                key_topics: []
            });
        }
    } catch (error) {
        console.error('Summarize error:', error);
        res.status(500).json({ error: 'Failed to summarize text' });
    }
});

module.exports = router;
