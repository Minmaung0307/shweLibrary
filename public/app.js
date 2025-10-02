// app.js
import { db, auth } from "./firebase.js";

// ===== Utilities =====
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const byId = (id) => document.getElementById(id);
const fmt = (d) => new Intl.DateTimeFormat([], {dateStyle:'medium', timeStyle:'short'}).format(d);

// ===== State =====
let currentUser = null; // { uid, displayName, email, role }
let allBooks = [];      // items cache
let subjects = new Set();
let years = new Set();

// ===== UI Refs =====
const q = byId('q');
const typeFilter = byId('typeFilter');
const subjectFilter = byId('subjectFilter');
const yearFilter = byId('yearFilter');
const bookCards = byId('bookCards');
const countBooks = byId('countBooks');
const activityEl = byId('activity');
const recoList = byId('recoList');

const openAuth = byId('openAuth');
const authModal = byId('authModal');
const closeAuth = byId('closeAuth');
const signinBtn = byId('signinBtn');
const signupBtn = byId('signupBtn');
const inEmail = byId('inEmail');
const inPass = byId('inPass');
const upName = byId('upName');
const upEmail = byId('upEmail');
const upPass = byId('upPass');
const userArea = byId('userArea');
const userName = byId('userName');
const userRole = byId('userRole');
const logoutBtn = byId('logoutBtn');

const openNewBook = byId('openNewBook');
const addDemo = byId('addDemo');
const bookModal = byId('bookModal');
const bookForm = byId('bookForm');
const closeBook = byId('closeBook');
const bookModalTitle = byId('bookModalTitle');
const delBookBtn = byId('delBookBtn');
const saveBookBtn = byId('saveBookBtn');
const bkId = byId('bkId');
const bkTitle = byId('bkTitle');
const bkAuthor = byId('bkAuthor');
const bkSubject = byId('bkSubject');
const bkYear = byId('bkYear');
const bkCode = byId('bkCode');
const bkType = byId('bkType');
const bkCover = byId('bkCover');
const bkMedia = byId('bkMedia');

const exportJson = byId('exportJson');
const importJson = byId('importJson');

const pdfModal = byId('pdfModal');
const playerArea = byId('playerArea');
const pdfTitle = byId('pdfTitle');
const closePdf = byId('closePdf');
const openExternal = byId('openExternal');

const toggleTheme = byId('toggleTheme');

// SAFE helper
function safeSetHTML(el, html){ if (el) el.innerHTML = html; }

// ===== Theme Toggle =====
let dark=true;
toggleTheme.addEventListener('click',()=>{
  dark = !dark;
  document.documentElement.style.filter = dark ? 'none' : 'invert(1) hue-rotate(180deg)';
  toggleTheme.textContent = dark ? '🌙' : '☀️';
});

// ===== Tabs (Auth) =====
$$('.tab').forEach(t=>t.addEventListener('click',()=>{
  $$('.tab').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  const which = t.dataset.tab;
  $$('#authForm .tab-panel').forEach(p=>p.classList.add('hidden'));
  byId('panel-'+which).classList.remove('hidden');
}));

// ===== Auth Modal =====
openAuth.addEventListener('click',()=>authModal.showModal());
closeAuth.addEventListener('click',()=>authModal.close());

signinBtn.addEventListener('click', async (e)=>{
  e.preventDefault();
  try{
    await auth.signInWithEmailAndPassword(inEmail.value.trim(), inPass.value.trim());
    authModal.close();
  }catch(err){ alert(err.message); }
});

signupBtn.addEventListener('click', async ()=>{
  try{
    const email = upEmail.value.trim();
    const pass = upPass.value.trim();
    const name = upName.value.trim();
    const {user} = await _auth.createUserWithEmailAndPassword(email, pass);
    await user.updateProfile({displayName:name});
    await db.collection('users').doc(user.uid).set({
      uid:user.uid, displayName:name, email, role:'member', createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert('Account created! You can sign in now.');
    $$('.tab')[0].click();
  }catch(err){ alert(err.message); }
});

logoutBtn.addEventListener('click', ()=> _auth.signOut());

// ===== Auth State =====
_auth.onAuthStateChanged(async (u)=>{
  if(u){
    const doc = await _db.collection('users').doc(u.uid).get();
    const role = doc.exists ? (doc.data().role||'member') : 'member';
    currentUser = {uid:u.uid, displayName:u.displayName||u.email, email:u.email, role};
    userArea.classList.remove('hidden');
    userName.textContent = currentUser.displayName;
    userRole.textContent = currentUser.role;
    openAuth.classList.add('hidden');
    renderAdminUI();
    await loadBooks();
    await loadActivity();
    await loadRecommendations();
  }else{
    currentUser = null;
  userArea.classList.add('hidden');
  openAuth.classList.remove('hidden');
  renderAdminUI();
  await loadBooks();
  safeSetHTML(activityEl, '');
  safeSetHTML(recoList, '');
  }
});

function isAdmin(){ return currentUser && currentUser.role === 'admin'; }
function renderAdminUI(){
  $$('.admin-only').forEach(el=> el.classList.toggle('hidden', !isAdmin()));
}

// ===== Firestore: Items =====
async function loadBooks(){
  const snap = await _db.collection('books').orderBy('createdAt','desc').limit(300).get();
  allBooks = snap.docs.map(d=>({id:d.id, ...massageLegacy(d.data())}));
  subjects = new Set(allBooks.map(b=>b.subject).filter(Boolean));
  years = new Set(allBooks.map(b=>b.year).filter(Boolean));

  subjectFilter.innerHTML = '<option value="">All Subjects</option>' +
    Array.from(subjects).sort().map(s=>`<option>${s}</option>`).join('');
  yearFilter.innerHTML = '<option value="">All Years</option>' +
    Array.from(years).sort((a,b)=>b-a).map(y=>`<option>${y}</option>`).join('');

  renderBooks();
}

// Backward-compat for older docs
function massageLegacy(d){
  const mediaType = d.mediaType || (d.pdfUrl ? 'book' : 'book');
  const mediaUrl = d.mediaUrl || d.pdfUrl || null;
  return {...d, mediaType, mediaUrl};
}

function actionLabels(t){
  if(t==='audio') return {primary:'Listen', secondary:'Download'};
  if(t==='video') return {primary:'Watch', secondary:'Download'};
  return {primary:'Read', secondary:'Download'};
}

function bookCard(b){
  const cover = b.cover || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1200&q=60&auto=format&fit=crop';
  const labels = actionLabels(b.mediaType);
  const canOpen = !!b.mediaUrl;
  return `
  <article class="card" data-id="${b.id}">
    <div class="cover"><img alt="cover" src="${cover}" loading="lazy"></div>
    <div class="body">
      <div class="title">${b.title}</div>
      <div class="meta">${b.author} • ${b.year||'—'}</div>
      <div class="tags">
        ${b.subject?`<span class="tag">${b.subject}</span>`:''}
        ${b.code?`<span class="tag">#${b.code}</span>`:''}
        ${b.mediaType?`<span class="tag">${b.mediaType.toUpperCase()}</span>`:''}
      </div>
    </div>
    <div class="footer">
      <button class="primary act-open" ${canOpen?'':'disabled'}>${labels.primary}</button>
      <button class="ghost act-download" ${canOpen?'':'disabled'}>${labels.secondary}</button>
      <button class="ghost act-edit ${isAdmin()?'':'hidden'}">Edit</button>
    </div>
  </article>`;
}

function renderBooks(){
  const qv = q.value.trim().toLowerCase();
  const subj = subjectFilter.value.trim().toLowerCase();
  const yr = yearFilter.value.trim();
  const type = typeFilter.value.trim();

  const list = allBooks.filter(b=>{
    const text = `${b.title} ${b.author} ${b.subject||''} ${b.code||''}`.toLowerCase();
    const okQ = !qv || text.includes(qv);
    const okS = !subj || (b.subject||'').toLowerCase() === subj;
    const okY = !yr || String(b.year||'') === yr;
    const okT = !type || (b.mediaType||'book') === type;
    return okQ && okS && okY && okT;
  });

  countBooks.textContent = list.length;
  bookCards.innerHTML = list.map(bookCard).join('');

  $$('#bookCards .card').forEach(card => {
  const id = card.dataset.id;
  const openBtn = $('.act-open', card);
  const dlBtn   = $('.act-download', card);
  const editBtn = $('.act-edit', card);

  openBtn && openBtn.addEventListener('click', () => openItem(id));
  dlBtn   && dlBtn.addEventListener('click', () => downloadItem(id));
  editBtn && editBtn.addEventListener('click', () => editBook(id));
});
  // $$('.card').forEach(card=>{
  //   const id = card.dataset.id;
  //   $('.act-open',card).addEventListener('click',()=>openItem(id));
  //   $('.act-download',card).addEventListener('click',()=>downloadItem(id));
  //   $('.act-edit',card)?.addEventListener('click',()=>editBook(id));
  // });
}

[q, subjectFilter, yearFilter, typeFilter].forEach(el=>el.addEventListener('input', ()=>{
  clearTimeout(window.__ft);
  window.__ft = setTimeout(renderBooks, 150);
}));

// ===== Add / Edit Item =====
openNewBook?.addEventListener('click',()=>{
  bookModalTitle.textContent = 'New Item';
  bkId.value=''; bkTitle.value=''; bkAuthor.value=''; bkSubject.value=''; bkYear.value=''; bkCode.value=''; bkType.value='book'; bkCover.value=''; bkMedia.value='';
  delBookBtn.style.display='none';
  bookModal.showModal();
});

closeBook?.addEventListener('click',()=> bookModal.close());

async function editBook(id){
  if(!isAdmin()) return;
  const b = allBooks.find(x=>x.id===id);
  if(!b) return;
  bookModalTitle.textContent = 'Edit Item';
  bkId.value=b.id; bkTitle.value=b.title; bkAuthor.value=b.author; bkSubject.value=b.subject||''; bkYear.value=b.year||''; bkCode.value=b.code||''; bkType.value=b.mediaType||'book'; bkCover.value=b.cover||''; bkMedia.value=b.mediaUrl||b.pdfUrl||'';
  delBookBtn.style.display='inline-flex';
  bookModal.showModal();
}

// submit handler with code normalization & uniqueness
bookForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if (!isAdmin()) return alert('Admins only');

  let codeVal = bkCode.value.trim();
  if (codeVal) {
    codeVal = codeVal.toUpperCase().replace(/\s+/g,'-').replace(/[^A-Z0-9\-]/g,'');
    const ok = /^[A-Z0-9\-]{3,20}$/.test(codeVal);
    if (!ok) { alert('Code သတ်မှတ်ပုံ: A-Z, 0-9, "-" သာ / အရှည် 3~20'); return; }
  } else codeVal = null;

  const base = {
    title: bkTitle.value.trim(),
    author: bkAuthor.value.trim(),
    subject: bkSubject.value.trim() || null,
    year: bkYear.value ? Number(bkYear.value) : null,
    code: codeVal,
    mediaType: bkType.value || 'book',
    cover: bkCover.value.trim() || null,
    mediaUrl: bkMedia.value.trim() || null,
  };
  base.pdfUrl = (base.mediaType==='book') ? (base.mediaUrl || null) : null;

  try {
    if (base.code) {
      const dup = await _db.collection('books').where('code','==', base.code).get();
      const conflict = dup.docs.some(d => d.id !== bkId.value);
      if (conflict) { alert(`Code "${base.code}" ကို တခြား item အသုံးပြုပြီးသားပါ ❌`); return; }
    }

    if (bkId.value) {
      await _db.collection('books').doc(bkId.value).update({
        ...base,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await _db.collection('books').add({
        ...base,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    if (codeVal) bkCode.value = codeVal;
    bookModal.close();
    await loadBooks();
  } catch (err) { alert(err.message); }
});

// Delete
delBookBtn.addEventListener('click', async ()=>{
  if(!isAdmin()) return;
  if(!bkId.value) return;
  if(!confirm('Delete this item?')) return;
  try{
    await _db.collection('books').doc(bkId.value).delete();
    bookModal.close();
    await loadBooks();
  }catch(err){ alert(err.message); }
});

// ===== Open / Download =====
async function openItem(id){
  const b = allBooks.find(x=>x.id===id);
  if(!b || !b.mediaUrl) return;
  pdfTitle.textContent = b.title;
  openExternal.href = b.mediaUrl;

  playerArea.innerHTML = '';
  const t = b.mediaType || 'book';
  if (t==='book') {
    const iframe = document.createElement('iframe');
    iframe.title = 'PDF Reader';
    iframe.allow = 'fullscreen'; iframe.setAttribute('allowfullscreen','');
    iframe.src = b.mediaUrl;
    playerArea.appendChild(iframe);
  } else if (t==='audio') {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = b.mediaUrl;
    playerArea.appendChild(audio);
  } else if (t==='video') {
    const video = document.createElement('video');
    video.controls = true; video.playsInline = true;
    video.src = b.mediaUrl;
    playerArea.appendChild(video);
  }
  pdfModal.showModal();

  if(currentUser){
    const action = t==='book' ? 'read' : (t==='audio' ? 'listen' : 'watch');
    try {
      await _db.collection('borrows').add({
        bookId: b.id,
        bookTitle: b.title,
        userId: currentUser.uid,
        userName: currentUser.displayName,
        mediaType: t,
        action,
        ts: firebase.firestore.FieldValue.serverTimestamp()
      });
      await Promise.all([loadActivity(), loadRecommendations()]);
    } catch(e){}
  }
}

closePdf?.addEventListener('click',()=>{
  playerArea.innerHTML = '';
  pdfModal.close();
});

async function downloadItem(id){
  if(!currentUser) return alert('Please sign in first.');
  const b = allBooks.find(x=>x.id===id);
  if(!b || !b.mediaUrl) return alert('No media URL for this item.');
  const a = document.createElement('a');
  a.href = b.mediaUrl; a.target = '_blank'; a.download='';
  document.body.appendChild(a); a.click(); a.remove();
  try {
    await _db.collection('borrows').add({
      bookId: b.id,
      bookTitle: b.title,
      userId: currentUser.uid,
      userName: currentUser.displayName,
      mediaType: b.mediaType || 'book',
      action: 'download',
      ts: firebase.firestore.FieldValue.serverTimestamp()
    });
    await Promise.all([loadActivity(), loadRecommendations()]);
  } catch(e){}
}

// ===== Activity Feed =====
async function loadActivity(){
  if (!activityEl) return; // element မရှိတော့ -> လုံးဝမလုပ်
  try{
    const snap = await _db.collection('borrows').orderBy('ts','desc').limit(30).get();
    const rows = snap.docs.map(d=>d.data());
    activityEl.innerHTML = rows.map(r=>`
      <li>
        <span class="who">${r.userName||'Someone'}</span>
        <span class="what">${r.action}${r.mediaType? ' • '+r.mediaType : ''}</span>
        <strong>${r.bookTitle||''}</strong>
        <span class="when">${r.ts?.toDate ? fmt(r.ts.toDate()) : ''}</span>
      </li>`).join('');
  }catch(e){
    safeSetHTML(activityEl, ''); // guard
  }
}

// ===== Recommendations =====
async function loadRecommendations(){
  try{
    const snap = await _db.collection('borrows').orderBy('ts','desc').limit(1000).get();
    const count = new Map();
    snap.docs.forEach(d=>{
      const x = d.data();
      const key = `${x.bookTitle}||${x.mediaType||'book'}`;
      count.set(key, (count.get(key)||0)+1);
    });
    const top = Array.from(count.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5);
    safeSetHTML(recoList, top.map(([k,n])=>{
      const [title, t] = k.split('||');
      return `<li>${title} <span class="badge">${t}</span> <span class="badge">${n}</span></li>`;
    }).join(''));
  }catch(e){ safeSetHTML(recoList, ''); }
}

// ===== Import / Export =====
exportJson?.addEventListener('click',()=>{
  const data = JSON.stringify(allBooks, null, 2);
  const blob = new Blob([data],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download='library-export.json'; a.click();
  URL.revokeObjectURL(url);
});

importJson?.addEventListener('change', async (e)=>{
  if(!isAdmin()) return alert('Admins only');
  const file = e.target.files[0]; if(!file) return;
  const text = await file.text();
  const arr = JSON.parse(text);
  const batch = _db.batch();
  arr.forEach(b=>{
    const ref = _db.collection('books').doc(b.id||undefined);
    const mediaType = b.mediaType || (b.pdfUrl ? 'book' : 'book');
    const mediaUrl = b.mediaUrl || b.pdfUrl || null;
    batch.set(ref, {
      title:b.title, author:b.author, subject:b.subject||null, year:b.year||null, code:b.code||null, cover:b.cover||null,
      mediaType, mediaUrl, pdfUrl: mediaType==='book' ? mediaUrl : null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
  });
  await batch.commit();
  await loadBooks();
});

// ===== Demo data (admin) =====
addDemo?.addEventListener('click', async ()=>{
  if(!isAdmin()) return alert('Admins only');
  const demo = [
    {title:"Alice's Adventures in Wonderland", author:"Lewis Carroll", subject:"Fiction", year:1865, code:"ALICE-1865",
     cover:"https://images.unsplash.com/photo-1521587760476-6c12a4b040da?q=80&w=1200&auto=format&fit=crop",
     mediaType:"book", mediaUrl:"https://www.gutenberg.org/files/11/11-pdf.pdf"},
    {title:"SoundHelix Song 1", author:"SoundHelix", subject:"Music", year:2010, code:"AUDIO-SH1",
     cover:"https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=1200&auto=format&fit=crop",
     mediaType:"audio", mediaUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"},
    {title:"Big Buck Bunny (clip)", author:"Blender Foundation", subject:"Animation", year:2008, code:"VIDEO-BBB",
     cover:"https://images.unsplash.com/photo-1529101091764-c3526daf38fe?q=80&w=1200&auto=format&fit=crop",
     mediaType:"video", mediaUrl:"https://www.w3schools.com/html/mov_bbb.mp4"}
  ];
  const batch = _db.batch();
  demo.forEach(d => {
    const ref = _db.collection('books').doc();
    batch.set(ref, {
      ...d,
      pdfUrl: d.mediaType==='book' ? d.mediaUrl : null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
  await loadBooks();
  alert('Demo items (book/audio/video) added.');
});

// ===== Init =====
(async function init(){
  await loadBooks(); // public
})();

/* ================== PWA (installer) & Activity Log – Non-breaking Add-on ================== */
/* 1) Service Worker register */
(function registerSW(){
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
    });
  }
})();

/* 2) Install Prompt handling (button only shows when eligible) */
(function pwaInstall(){
  let deferredPrompt = null;
  const wrap = document.getElementById('pwaInstallWrap');
  const btn = document.getElementById('btnInstall');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (wrap) wrap.style.display = 'block';
  });

  if (btn) {
    btn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      // Log decision
      try { window.trackActivity('pwa_install_prompt', { outcome }); } catch(e){}
      deferredPrompt = null;
      if (wrap) wrap.style.display = 'none';
    });
  }

  window.addEventListener('appinstalled', () => {
    try { window.trackActivity('pwa_installed'); } catch(e){}
    if (wrap) wrap.style.display = 'none';
  });
})();

/* 3) Activity Log (Today & History) – localStorage based.
      Expose global: window.trackActivity(type, meta?)
      – Non-breaking: does not hook into existing handlers automatically.
         You can call window.trackActivity('opened_pdf', {title})
         anywhere in your current code. Also logs 'app_open' on load.
*/
// (function activityLog(){
//   const LS_KEY = 'activityLog';
//   const todayUL = document.getElementById('activityToday');
//   const historyBox = document.getElementById('activityHistory');

//   function toDateKey(ts){
//     const d = new Date(ts);
//     return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
//   }
//   function fmtTime(ts){
//     const d = new Date(ts);
//     return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
//   }
//   function loadLog(){
//     try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
//     catch(e){ return []; }
//   }
//   function saveLog(arr){
//     localStorage.setItem(LS_KEY, JSON.stringify(arr));
//   }
//   function add(type, meta){
//     const entry = {
//       ts: Date.now(),
//       type,
//       meta: meta || {},
//     };
//     const arr = loadLog();
//     arr.push(entry);
//     // Keep last 1000 entries to avoid bloat
//     while (arr.length > 1000) arr.shift();
//     saveLog(arr);
//     render(); // update view
//   }

//   // Group by date
//   function groupByDate(arr){
//     const map = {};
//     arr.forEach(e => {
//       const k = toDateKey(e.ts);
//       (map[k] = map[k] || []).push(e);
//     });
//     return map;
//   }

//   function labelOf(e){
//     const meta = e.meta || {};
//     // Basic labels in Burmese + English mixed
//     const M = (k, fallback='') => (meta && (meta[k]!==undefined)) ? String(meta[k]) : fallback;
//     switch (e.type) {
//       case 'app_open': return `App open (${fmtTime(e.ts)})`;
//       case 'pwa_install_prompt': return `PWA prompt: ${M('outcome','-')} (${fmtTime(e.ts)})`;
//       case 'pwa_installed': return `PWA installed (${fmtTime(e.ts)})`;
//       // Example types you may call manually:
//       case 'video_play': return `Video ▶ ${M('title','') || M('id','')}`;
//       case 'audio_play': return `Audio ▶ ${M('title','') || M('id','')}`;
//       case 'pdf_open': return `PDF 📄 ${M('title','') || M('id','')}`;
//       case 'item_open': return `Open ${M('id','')}`;
//       default: return `${e.type} (${fmtTime(e.ts)})`;
//     }
//   }

//   function render(){
//     if (!todayUL || !historyBox) return;
//     const arr = loadLog();
//     const byDate = groupByDate(arr);

//     const todayKey = toDateKey(Date.now());
//     const todayList = byDate[todayKey] || [];

//     // Today
//     todayUL.innerHTML = '';
//     todayList.slice().reverse().forEach(e => {
//       const li = document.createElement('li');
//       li.textContent = labelOf(e);
//       todayUL.appendChild(li);
//     });

//     // History (previous days only)
//     historyBox.innerHTML = '';
//     Object.keys(byDate)
//       .filter(k => k !== todayKey)
//       .sort() // ascending dates
//       .reverse() // latest day first
//       .forEach(k => {
//         const wrap = document.createElement('div');
//         wrap.className = 'day';
//         const h = document.createElement('h4');
//         h.textContent = k;
//         const ul = document.createElement('ul');
//         byDate[k].slice().reverse().forEach(e => {
//           const li = document.createElement('li');
//           li.textContent = labelOf(e);
//           ul.appendChild(li);
//         });
//         wrap.appendChild(h); wrap.appendChild(ul);
//         historyBox.appendChild(wrap);
//       });
//   }

//   // Public API
//   window.trackActivity = add;

//   // Auto-log app open
//   add('app_open', { ua: navigator.userAgent });

//   // Render once on load (in case there were old logs)
//   render();

//   // Optional: Auto-log any element with data-activity="type"
//   document.addEventListener('click', (ev) => {
//     const el = ev.target.closest('[data-activity]');
//     if (!el) return;
//     try {
//       const type = el.getAttribute('data-activity') || 'click';
//       const meta = {};
//       for (const a of el.attributes) {
//         if (a.name.startsWith('data-')) {
//           const key = a.name.replace(/^data-/, '');
//           if (key !== 'activity') meta[key] = a.value;
//         }
//       }
//       add(type, meta);
//     } catch(e){}
//   });
// })();