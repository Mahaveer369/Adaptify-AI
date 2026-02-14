const express = require('express');
const router = express.Router();
const History = require('../models/History');
const { verifyToken } = require('../middleware/auth');

// GET /api/history — Get user's simplification history
router.get('/', verifyToken, async (req, res) => {
    try {
        const history = await History.find({ userId: req.user.uid })
            .sort({ createdAt: -1 })
            .limit(50)
            .select('_id originalText simplifiedOutput audienceLevel createdAt');

        res.json({ success: true, history });
    } catch (error) {
        console.error('History fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// DELETE /api/history/:id — Delete a specific history entry
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const result = await History.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.uid
        });

        if (!result) {
            return res.status(404).json({ error: 'History entry not found' });
        }

        res.json({ success: true, message: 'History entry deleted' });
    } catch (error) {
        console.error('History delete error:', error);
        res.status(500).json({ error: 'Failed to delete history entry' });
    }
});

// DELETE /api/history — Delete all history for user
router.delete('/', verifyToken, async (req, res) => {
    try {
        await History.deleteMany({ userId: req.user.uid });
        res.json({ success: true, message: 'All history deleted' });
    } catch (error) {
        console.error('History delete all error:', error);
        res.status(500).json({ error: 'Failed to delete history' });
    }
});

module.exports = router;
