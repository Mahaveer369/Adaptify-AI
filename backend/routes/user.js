const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

// GET /api/user/profile — Get current user profile
router.get('/profile', verifyToken, async (req, res) => {
    try {
        let user = await User.findOne({ firebaseUid: req.user.uid });

        if (!user) {
            // Create user on-the-fly if not found
            user = await User.create({
                firebaseUid: req.user.uid,
                name: req.user.name || '',
                email: req.user.email || '',
                profilePic: req.user.picture || ''
            });
        }

        res.json({ success: true, user });
    } catch (error) {
        console.error('Profile fetch error:', error);
        // Return basic info from token if DB fails
        res.json({
            success: true,
            user: {
                name: req.user.name || 'User',
                email: req.user.email || '',
                profilePic: req.user.picture || ''
            }
        });
    }
});

module.exports = router;
