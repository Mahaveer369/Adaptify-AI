import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyCI_4DKg5HWlnuTpAHrTfQiCV6hAI7E3CY",
    authDomain: "badassprojects.firebaseapp.com",
    projectId: "badassprojects",
    storageBucket: "badassprojects.firebasestorage.app",
    messagingSenderId: "302717105884",
    appId: "1:302717105884:web:3b0c552ad1e1b242916619",
    measurementId: "G-HVH59MQFQR"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
