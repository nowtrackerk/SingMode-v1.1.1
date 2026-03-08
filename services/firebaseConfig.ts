import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD2rR0OH2OzSlt4fs2w72TKOUNDngp0zXQ",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "singmode-7c657.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "singmode-7c657",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "singmode-7c657.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "292866266443",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:292866266443:web:190d34e55980509c1b04ce"
};

if (!import.meta.env.VITE_FIREBASE_API_KEY) {
    console.info("[Firebase] Using hardcoded fallback configuration.");
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth and Firestore with Persistent Cache (A.1.1 robustness)
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});
