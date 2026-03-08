import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD2rR0OH2OzSlt4fs2w72TKOUNDngp0zXQ",
    authDomain: "singmode-7c657.firebaseapp.com",
    projectId: "singmode-7c657",
    storageBucket: "singmode-7c657.firebasestorage.app",
    messagingSenderId: "292866266443",
    appId: "1:292866266443:web:190d34e55980509c1b04ce"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth and Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
