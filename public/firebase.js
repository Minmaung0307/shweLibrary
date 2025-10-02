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

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
db.settings({ experimentalForceLongPolling: true, useFetchStreams: false });
window._auth = firebase.auth();
window._db = db;