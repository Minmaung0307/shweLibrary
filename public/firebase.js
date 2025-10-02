// firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// 🛡️ only-once guard (browser global)
if (!window.__FS_ONCE__) {
  window.__FS_ONCE__ = true;
  if (location.hostname === 'localhost') {
    connectFirestoreEmulator(db, 'localhost', 8080);
  }
  // NOTE: မရှိမဖြစ် settings ထပ်ခေါ်စရာ မလိုပါ—host/ssl override မပြုပါနဲ့
}

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
// 🛡️ only-once guard
if (!window.__FS_ONCE__) {
  window.__FS_ONCE__ = true;

  if (location.hostname === 'localhost') {
    db.useEmulator('localhost', 8080);
  }

  // ⚠️ db.settings({...}) ကို မလိုအပ်လျှင် မခေါ်ပါ။
  // ခေါ်ရင်တောင် app တစ်ခါတည်းမှာပဲ ခေါ်ပါ—နေရာပိုင်းခွဲပြီး ထပ်ခေါ်မနေနဲ့။
}

export { db };
db.settings({ experimentalForceLongPolling: true, useFetchStreams: false });
window._auth = firebase.auth();
window._db = db;
