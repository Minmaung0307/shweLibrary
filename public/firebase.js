// firebase.js (MODULAR CLEAN VERSION)
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

// Fill your own Firebase config here
const firebaseConfig = {
  apiKey: "AIzaSyBn6f6vIq3pKTsMlLYVlC-bqhxxsecP3IM",
  authDomain: "shwelibrary.firebaseapp.com",
  projectId: "shwelibrary",
  storageBucket: "shwelibrary.firebasestorage.app",
  messagingSenderId: "919168492707",
  appId: "1:919168492707:web:92bfbeba8387c078d38b16",
  measurementId: "G-5052Y9PC0P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 🛡️ Guard: only connect emulator once in dev
if (!window.__FS_ONCE__) {
  window.__FS_ONCE__ = true;
  if (location.hostname === "localhost") {
    connectFirestoreEmulator(db, "localhost", 8080);
  }
}

// Export to app.js
export { db, auth };