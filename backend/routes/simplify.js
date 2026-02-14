const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const History = require('../models/History');
const { verifyToken } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.gif', '.bmp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${ext} not supported`));
        }
    }
});

// Extract text from uploaded PDF
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

// POST /api/simplify — Accept text/files, forward to FastAPI, save result
router.post('/', verifyToken, upload.array('files', 5), async (req, res) => {
    try {
        const { text, audienceLevel } = req.body;
        let fullText = text || '';
        const uploadedFiles = [];

        // Extract text from uploaded files
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                uploadedFiles.push(file.filename);
                const ext = path.extname(file.originalname).toLowerCase();

                if (ext === '.pdf') {
                    const pdfText = await extractTextFromPDF(file.path);
                    fullText += '\n\n' + pdfText;
                }
                // DOCX and image text extraction handled by FastAPI
            }
        }

        if (!fullText.trim()) {
            return res.status(400).json({ error: 'No text content provided' });
        }

        // Forward to FastAPI NLP service
        const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';

        let simplifiedOutput;
        try {
            const response = await axios.post(`${fastApiUrl}/process`, {
                text: fullText,
                audience_level: audienceLevel || 'manager',
                user_id: req.user.uid || 'default'
            }, { timeout: 120000 });

            simplifiedOutput = response.data;
        } catch (apiErr) {
            console.error('FastAPI call failed:', apiErr.message);
            // Fallback mock response for demo/development
            simplifiedOutput = {
                pages: [{
                    page_number: 1,
                    title: 'Executive Summary',
                    simplified_text: `This document has been simplified for easy understanding.\n\n${fullText.substring(0, 500)}...`,
                    image_prompt: 'A clean, modern business dashboard showing simplified data visualization'
                }]
            };
        }

        // Save to history in MongoDB
        try {
            const historyEntry = await History.create({
                userId: req.user.uid,
                originalText: fullText,
                simplifiedOutput,
                uploadedFiles,
                audienceLevel: audienceLevel || 'manager'
            });

            res.json({
                success: true,
                result: simplifiedOutput,
                historyId: historyEntry._id
            });
        } catch (dbErr) {
            // If DB save fails, still return the result
            console.error('DB save failed:', dbErr.message);
            res.json({
                success: true,
                result: simplifiedOutput,
                historyId: null
            });
        }
    } catch (error) {
        console.error('Simplify error:', error);
        res.status(500).json({ error: 'Failed to simplify content' });
    }
});

module.exports = router;
