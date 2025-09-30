// 🔧 Rename this file to firebase.js and fill in your own config values from Firebase Console
// Project Settings ➜ General ➜ Your apps ➜ SDK setup and configuration (CDN)

const firebaseConfig = {
  apiKey: "AIzaSyBn6f6vIq3pKTsMlLYVlC-bqhxxsecP3IM",
  authDomain: "shwelibrary.firebaseapp.com",
  projectId: "shwelibrary",
  storageBucket: "shwelibrary.firebasestorage.app",
  messagingSenderId: "919168492707",
  appId: "1:919168492707:web:92bfbeba8387c078d38b16",
  measurementId: "G-5052Y9PC0P"
};

// Initialize (Compat SDK to keep code simpler in one file)
firebase.initializeApp(firebaseConfig);

// Expose handles
window._auth = firebase.auth();
window._db = firebase.firestore();
