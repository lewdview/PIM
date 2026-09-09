import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: "days-of-light-and-dark.firebaseapp.com",
  projectId: "days-of-light-and-dark",
  storageBucket: "days-of-light-and-dark.firebasestorage.app",
  messagingSenderId: "698411437167",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
