require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const authRoutes = require('./routes/auth');
const simplifyRoutes = require('./routes/simplify');
const askRoutes = require('./routes/ask');
const summarizeRoutes = require('./routes/summarize');
const extractRoutes = require('./routes/extract');
const historyRoutes = require('./routes/history');
const userRoutes = require('./routes/user');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes — each feature has its own endpoint
app.use('/api/auth', authRoutes);
app.use('/api/simplify', simplifyRoutes);    // POST /api/simplify
app.use('/api/ask', askRoutes);              // POST /api/ask
app.use('/api/summarize', summarizeRoutes);  // POST /api/summarize
app.use('/api/extract', extractRoutes);      // POST /api/extract
app.use('/api/history', historyRoutes);      // GET/DELETE /api/history
app.use('/api/user', userRoutes);

// Health check — lists all available API endpoints
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        endpoints: {
            simplify: 'POST /api/simplify',
            ask: 'POST /api/ask',
            summarize: 'POST /api/summarize',
            extract: 'POST /api/extract',
            history: 'GET /api/history',
            auth: 'POST /api/auth/verify'
        }
    });
});

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/briefing_simplifier')
    .then(() => {
        console.log('Connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`Backend server running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err.message);
        console.log('Starting server without MongoDB...');
        app.listen(PORT, () => {
            console.log(`Backend server running on http://localhost:${PORT} (no DB)`);
        });
    });
