// ===== Utilities =====
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const byId = (id) => document.getElementById(id);
const fmt = (d) => new Intl.DateTimeFormat([], {dateStyle:'medium', timeStyle:'short'}).format(d);

// ===== State =====
let currentUser = null; // { uid, displayName, email, role }
let allBooks = [];      // books collection cache
let subjects = new Set();
let years = new Set();

// ===== UI Refs =====
const q = byId('q');
const subjectFilter = byId('subjectFilter');
const yearFilter = byId('yearFilter');
const availabilityFilter = byId('availabilityFilter');
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
const bkCover = byId('bkCover');
const bkPdf = byId('bkPdf');

const exportJson = byId('exportJson');
const importJson = byId('importJson');

const pdfModal = byId('pdfModal');
const pdfFrame = byId('pdfFrame');
const pdfTitle = byId('pdfTitle');
const closePdf = byId('closePdf');
const openExternal = byId('openExternal');

const toggleTheme = byId('toggleTheme');

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
    await _auth.signInWithEmailAndPassword(inEmail.value.trim(), inPass.value.trim());
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
    await _db.collection('users').doc(user.uid).set({
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
    // 👉 admin ဖြစ်သွားရင် card တွေကို admin state နဲ့ပြန်ပုံနှိပ်
    await loadBooks();
    await loadActivity();
    await loadRecommendations();
  }else{
    currentUser = null;
    userArea.classList.add('hidden');
    openAuth.classList.remove('hidden');
    renderAdminUI();
    // 👉 sign out လုပ်လို့ admin မဟုတ်တော့ရင် card တွေမှ Edit ကိုဖျောက်
    await loadBooks();
    activityEl.innerHTML = '';
    recoList.innerHTML = '';
  }

  applyRoleVisibility();
});

function isAdmin(){ return currentUser && currentUser.role === 'admin'; }
function renderAdminUI(){
  $$('.admin-only').forEach(el=> el.classList.toggle('hidden', !isAdmin()));
}

// ===== Firestore: Books =====
async function loadBooks(){
  const snap = await _db.collection('books').orderBy('createdAt','desc').limit(200).get();
  allBooks = snap.docs.map(d=>({id:d.id, ...d.data()}));
  subjects = new Set(allBooks.map(b=>b.subject).filter(Boolean));
  years = new Set(allBooks.map(b=>b.year).filter(Boolean));
  subjectFilter.innerHTML = '<option value="">All Subjects</option>' +
    Array.from(subjects).sort().map(s=>`<option>${s}</option>`).join('');
  yearFilter.innerHTML = '<option value="">All Years</option>' +
    Array.from(years).sort((a,b)=>b-a).map(y=>`<option>${y}</option>`).join('');
  renderBooks();
}

function bookCard(b){
  const cover = b.cover || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1200&q=60&auto=format&fit=crop';
  const canRead = !!b.pdfUrl;
  return `
  <article class="card" data-id="${b.id}">
    <div class="cover"><img alt="cover" src="${cover}" loading="lazy"></div>
    <div class="body">
      <div class="title">${b.title}</div>
      <div class="meta">${b.author} • ${b.year||'—'}</div>
      <div class="tags">
        ${b.subject?`<span class="tag">${b.subject}</span>`:''}
        ${b.code?`<span class="tag">#${b.code}</span>`:''}
      </div>
    </div>
    <div class="footer">
      <button class="primary act-download" ${canRead?'':'disabled'}>Download</button>
      <button class="ghost act-read" ${canRead?'':'disabled'}>Read</button>
      <button class="ghost act-edit ${isAdmin()?'':'hidden'}">Edit</button>
    </div>
  </article>`;
}

function applyRoleVisibility(){
  document.querySelectorAll('.act-edit')
    .forEach(el => el.classList.toggle('hidden', !(currentUser && currentUser.role==='admin')));
}

function renderBooks(){
  const qv = q.value.trim().toLowerCase();
  const subj = subjectFilter.value.trim().toLowerCase();
  const yr = yearFilter.value.trim();
  const avail = availabilityFilter.value;

  const list = allBooks.filter(b=>{
    const text = `${b.title} ${b.author} ${b.subject||''} ${b.code||''}`.toLowerCase();
    const okQ = !qv || text.includes(qv);
    const okS = !subj || (b.subject||'').toLowerCase() === subj;
    const okY = !yr || String(b.year||'') === yr;
    const okA = !avail || avail==='available';
    return okQ && okS && okY && okA;
  });

  countBooks.textContent = list.length;
  bookCards.innerHTML = list.map(bookCard).join('');

  $$('.card').forEach(card=>{
    const id = card.dataset.id;
    $('.act-read',card).addEventListener('click',()=>openBook(id));
    $('.act-edit',card)?.addEventListener('click',()=>editBook(id));
    $('.act-download',card).addEventListener('click',()=>downloadBook(id));
  });

  applyRoleVisibility();
}

[q, subjectFilter, yearFilter, availabilityFilter].forEach(el=>el.addEventListener('input', ()=>{
  clearTimeout(window.__ft);
  window.__ft = setTimeout(renderBooks, 150);
}));

// ===== Add / Edit Book =====
openNewBook?.addEventListener('click',()=>{
  bookModalTitle.textContent = 'New Book';
  bkId.value=''; bkTitle.value=''; bkAuthor.value=''; bkSubject.value=''; bkYear.value=''; bkCode.value=''; bkCover.value=''; bkPdf.value='';
  delBookBtn.style.display='none';
  bookModal.showModal();
});

closeBook?.addEventListener('click',()=> bookModal.close());

async function openBook(id){
  const b = allBooks.find(x=>x.id===id);
  if(!b) return;
  if(b.pdfUrl){
    pdfTitle.textContent = b.title;
    pdfFrame.src = b.pdfUrl;
    openExternal.href = b.pdfUrl;
    pdfModal.showModal();
  }else{
    alert(`${b.title}\n\nAuthor: ${b.author}\nYear: ${b.year||'—'}\nSubject: ${b.subject||'-'}\nCode: ${b.code||'-'}`);
  }
}

closePdf?.addEventListener('click',()=>{
  pdfFrame.src = 'about:blank';
  pdfModal.close();
});

async function editBook(id){
  if(!isAdmin()) return;
  const b = allBooks.find(x=>x.id===id);
  if(!b) return;
  bookModalTitle.textContent = 'Edit Book';
  bkId.value=b.id; bkTitle.value=b.title; bkAuthor.value=b.author; bkSubject.value=b.subject||''; bkYear.value=b.year||''; bkCode.value=b.code||''; bkCover.value=b.cover||''; bkPdf.value=b.pdfUrl||'';
  delBookBtn.style.display='inline-flex';
  bookModal.showModal();
}

// REPLACE your current bookForm submit handler with this:
bookForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if (!isAdmin()) return alert('Admins only');

  // --- normalize + validate "code" (unique) ---
  let codeVal = bkCode.value.trim();
  if (codeVal) {
    // UPPERCASE, spaces -> '-', remove invalid chars
    codeVal = codeVal.toUpperCase().replace(/\s+/g,'-').replace(/[^A-Z0-9\-]/g,'');
    // optional length rule (3~20 chars)
    const ok = /^[A-Z0-9\-]{3,20}$/.test(codeVal);
    if (!ok) {
      alert('Code သတ်မှတ်ပုံ: A-Z, 0-9, "-" သာ / အရှည် 3~20');
      return;
    }
  } else {
    codeVal = null; // empty -> null
  }

  // --- base payload (NO createdAt here) ---
  const base = {
    title: bkTitle.value.trim(),
    author: bkAuthor.value.trim(),
    subject: bkSubject.value.trim() || null,
    year: bkYear.value ? Number(bkYear.value) : null,
    code: codeVal,
    cover: bkCover.value.trim() || null,
    pdfUrl: bkPdf.value.trim() || null,
  };

  try {
    // --- unique check for code (when provided) ---
    if (base.code) {
      const dup = await _db.collection('books').where('code','==', base.code).get();
      const conflict = dup.docs.some(d => d.id !== bkId.value);
      if (conflict) {
        alert(`Code "${base.code}" ကို တခြားစာအုပ် အသုံးပြုပြီးသားပါ ❌`);
        return;
      }
    }

    if (bkId.value) {
      // UPDATE: never send createdAt; only updatedAt
      await _db.collection('books').doc(bkId.value).update({
        ...base,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // CREATE: set both createdAt & updatedAt
      await _db.collection('books').add({
        ...base,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

    // reflect normalized code back into the input (optional UX)
    if (codeVal) bkCode.value = codeVal;

    bookModal.close();
    await loadBooks();
  } catch (err) {
    alert(err.message);
  }
});

// Delete
delBookBtn.addEventListener('click', async ()=>{
  if(!isAdmin()) return;
  if(!bkId.value) return;
  if(!confirm('Delete this book?')) return;
  try{
    await _db.collection('books').doc(bkId.value).delete();
    bookModal.close();
    await loadBooks();
  }catch(err){ alert(err.message); }
});

// ===== Download (logs activity) =====
async function downloadBook(bookId){
  if(!currentUser) return alert('Please sign in first.');
  const b = allBooks.find(x=>x.id===bookId);
  if(!b || !b.pdfUrl) return alert('No PDF URL for this book.');
  const a = document.createElement('a');
  a.href = b.pdfUrl;
  a.download = '';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
  try {
    await _db.collection('borrows').add({
      bookId: bookId,
      bookTitle: b.title,
      userId: currentUser.uid,
      userName: currentUser.displayName,
      action: 'download',
      ts: firebase.firestore.FieldValue.serverTimestamp()
    });
    await Promise.all([loadActivity(), loadRecommendations()]);
  } catch(e){
    console.warn('activity log failed:', e.message);
  }
}

// ===== Activity Feed =====
async function loadActivity(){
  try{
    const snap = await _db.collection('borrows').orderBy('ts','desc').limit(20).get();
    const rows = snap.docs.map(d=>d.data());
    activityEl.innerHTML = rows.map(r=>`
      <li>
        <span class="who">${r.userName}</span>
        <span class="what">${r.action}</span>
        <strong>${r.bookTitle}</strong>
        <span class="when">${r.ts?.toDate ? fmt(r.ts.toDate()) : ''}</span>
      </li>`).join('');
  }catch(e){
    activityEl.innerHTML = '';
  }
}

// ===== Recommendations (Top downloads) =====
async function loadRecommendations(){
  try{
    const snap = await _db.collection('borrows').orderBy('ts','desc').limit(500).get();
    const count = new Map();
    snap.docs.forEach(d=>{
      const x = d.data();
      if(x.action === 'download'){
        const key = x.bookTitle;
        count.set(key, (count.get(key)||0)+1);
      }
    });
    const top = Array.from(count.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5);
    recoList.innerHTML = top.map(([title,n])=>`<li>${title} <span class="badge">${n}</span></li>`).join('');
  }catch(e){
    recoList.innerHTML = '';
  }
}

// ===== Import / Export =====
exportJson?.addEventListener('click',()=>{
  const data = JSON.stringify(allBooks, null, 2);
  const blob = new Blob([data],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download='books-export.json'; a.click();
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
    batch.set(ref, {
      title:b.title, author:b.author, subject:b.subject||null, year:b.year||null, code:b.code||null, cover:b.cover||null,
      pdfUrl:b.pdfUrl||null,
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
     pdfUrl:"https://www.gutenberg.org/files/11/11-pdf.pdf"},
    {title:"Dummy PDF (W3C)", author:"W3C", subject:"Sample", year:2020, code:"W3C-DUMMY",
     cover:"https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?q=80&w=1200&auto=format&fit=crop",
     pdfUrl:"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"},
    {title:"Attention Is All You Need", author:"Vaswani et al.", subject:"AI/ML", year:2017, code:"AIAYN-2017",
     cover:"https://images.unsplash.com/photo-1518779578993-ec3579fee39f?q=80&w=1200&auto=format&fit=crop",
     pdfUrl:"https://arxiv.org/pdf/1706.03762.pdf"}
  ];
  const batch = _db.batch();
  demo.forEach(d => {
    const ref = _db.collection('books').doc();
    batch.set(ref, {
      ...d,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
  await loadBooks();
  alert('Demo books added.');
});

// ===== Init =====
(async function init(){
  await loadBooks(); // public
  // activity/reco load when signed in
})();
