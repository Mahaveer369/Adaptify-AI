const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
let firebaseInitialized = false;

try {
    if (serviceAccountPath) {
        const serviceAccount = require(path.resolve(serviceAccountPath));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        firebaseInitialized = true;
        console.log('✅ Firebase Admin initialized');
    } else {
        console.log('⚠️  No Firebase service account configured — auth middleware in demo mode');
    }
} catch (err) {
    console.log('⚠️  Firebase init failed — auth middleware in demo mode:', err.message);
}

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Demo mode: allow requests without auth for development
        if (!firebaseInitialized) {
            req.user = {
                uid: 'demo-user-001',
                name: 'Demo User',
                email: 'demo@example.com',
                picture: ''
            };
            return next();
        }
        return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.split('Bearer ')[1];

    if (!firebaseInitialized) {
        // Demo mode fallback
        req.user = {
            uid: 'demo-user-001',
            name: 'Demo User',
            email: 'demo@example.com',
            picture: ''
        };
        return next();
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = {
            uid: decodedToken.uid,
            name: decodedToken.name || '',
            email: decodedToken.email || '',
            picture: decodedToken.picture || ''
        };
        next();
    } catch (error) {
        console.error('Token verification failed:', error.message);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

module.exports = { verifyToken, admin };
