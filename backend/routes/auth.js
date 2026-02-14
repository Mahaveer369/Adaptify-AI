const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

// POST /api/auth/verify — Verify Firebase token & upsert user
router.post('/verify', verifyToken, async (req, res) => {
    try {
        const { uid, name, email, picture } = req.user;

        let user = await User.findOneAndUpdate(
            { firebaseUid: uid },
            {
                firebaseUid: uid,
                name: name || '',
                email: email || '',
                profilePic: picture || ''
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.json({ success: true, user });
    } catch (error) {
        console.error('Auth verify error:', error);
        res.status(500).json({ error: 'Failed to verify user' });
    }
});

module.exports = router;
