const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { verifyToken } = require('../middleware/auth');

// Multer config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.txt'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
    }
});

// Extract text from PDF
async function extractTextFromPDF(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
    } catch (err) {
        console.error('PDF extraction error:', err.message);
        return '';
    }
}

// POST /api/extract — Extract key points from a document
router.post('/', verifyToken, upload.array('files', 5), async (req, res) => {
    try {
        const { text } = req.body;
        let fullText = text || '';

        // Extract text from uploaded files
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const ext = path.extname(file.originalname).toLowerCase();
                if (ext === '.pdf') {
                    const pdfText = await extractTextFromPDF(file.path);
                    fullText += '\n\n' + pdfText;
                }
            }
        }

        if (!fullText.trim()) {
            return res.status(400).json({ error: 'No document content provided' });
        }

        const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';

        try {
            const response = await axios.post(`${fastApiUrl}/extract`, {
                text: fullText,
                user_id: req.user.uid || 'default'
            }, { timeout: 120000 });

            res.json({ success: true, ...response.data });
        } catch (apiErr) {
            console.error('FastAPI /extract call failed:', apiErr.message);
            res.json({
                success: true,
                key_points: [{ point: fullText.substring(0, 200), importance: 'medium' }],
                overall_theme: 'Document analysis',
                action_items: []
            });
        }
    } catch (error) {
        console.error('Extract error:', error);
        res.status(500).json({ error: 'Failed to extract key points' });
    }
});

module.exports = router;
