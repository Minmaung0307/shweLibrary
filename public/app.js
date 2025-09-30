// ===== Utilities =====
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const byId = (id) => document.getElementById(id);
const now = () => new Date();
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

const exportJson = byId('exportJson');
const importJson = byId('importJson');

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
    const {user} = await _auth.signInWithEmailAndPassword(inEmail.value.trim(), inPass.value.trim());
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
    // create user doc with default role
    await _db.collection('users').doc(user.uid).set({
      uid:user.uid, displayName:name, email, role:'member', createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert('Account created! You can sign in now.');
    // switch to signin tab
    $$('.tab')[0].click();
  }catch(err){ alert(err.message); }
});

logoutBtn.addEventListener('click', ()=> _auth.signOut());

// ===== Auth State =====
_auth.onAuthStateChanged(async (u)=>{
  currentUser = null;
  if(u){
    // fetch role
    const doc = await _db.collection('users').doc(u.uid).get();
    const role = doc.exists ? (doc.data().role||'member') : 'member';
    currentUser = {uid:u.uid, displayName:u.displayName||u.email, email:u.email, role};
    userArea.classList.remove('hidden');
    userName.textContent = currentUser.displayName;
    userRole.textContent = currentUser.role;
    openAuth.classList.add('hidden');
    renderAdminUI();
  }else{
    userArea.classList.add('hidden');
    openAuth.classList.remove('hidden');
    renderAdminUI();
  }
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
  // populate filters
  subjectFilter.innerHTML = '<option value="">All Subjects</option>' +
    Array.from(subjects).sort().map(s=>`<option>${s}</option>`).join('');
  yearFilter.innerHTML = '<option value="">All Years</option>' +
    Array.from(years).sort((a,b)=>b-a).map(y=>`<option>${y}</option>`).join('');
  renderBooks();
}

function bookCard(b){
  const statusClass = b.available !== false ? 'available' : 'borrowed';
  const statusText = b.available !== false ? 'Available' : `Borrowed by ${b.holderName||'someone'}`;
  const btnPrimary = b.available !== false ? 'Borrow' : 'Return';
  const cover = b.cover || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1200&q=60&auto=format&fit=crop';
  return `
  <article class="card" data-id="${b.id}">
    <div class="cover"><img alt="cover" src="${cover}" loading="lazy"></div>
    <div class="body">
      <div class="title">${b.title}</div>
      <div class="meta">${b.author} • ${b.year||'—'}</div>
      <div class="tags">
        ${b.subject?`<span class="tag">${b.subject}</span>`:''}
        ${b.code?`<span class="tag">#${b.code}</span>`:''}
        <span class="status ${statusClass}">${statusText}</span>
      </div>
    </div>
    <div class="footer">
      <button class="primary act-borrow">${btnPrimary}</button>
      <button class="ghost act-open">Open</button>
      <button class="ghost act-edit ${isAdmin()?'':'hidden'}">Edit</button>
    </div>
  </article>`;
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
    const okA = !avail || (avail==='available' ? (b.available!==false) : (b.available===false));
    return okQ && okS && okY && okA;
  });

  countBooks.textContent = list.length;
  bookCards.innerHTML = list.map(bookCard).join('');

  // hook actions
  $$('.card').forEach(card=>{
    const id = card.dataset.id;
    $('.act-open',card).addEventListener('click',()=>openBook(id));
    $('.act-edit',card)?.addEventListener('click',()=>editBook(id));
    $('.act-borrow',card).addEventListener('click',()=>toggleBorrow(id));
  });
}

[q, subjectFilter, yearFilter, availabilityFilter].forEach(el=>el.addEventListener('input', renderBooks));

// ===== Add / Edit Book =====
openNewBook?.addEventListener('click',()=>{
  bookModalTitle.textContent = 'New Book';
  bkId.value=''; bkTitle.value=''; bkAuthor.value=''; bkSubject.value=''; bkYear.value=''; bkCode.value=''; bkCover.value='';
  delBookBtn.style.display='none';
  bookModal.showModal();
});

closeBook?.addEventListener('click',()=> bookModal.close());

async function openBook(id){
  const b = allBooks.find(x=>x.id===id);
  if(!b) return;
  alert(`${b.title}\n\nAuthor: ${b.author}\nYear: ${b.year||'—'}\nSubject: ${b.subject||'-'}\nCode: ${b.code||'-'}`);
}

async function editBook(id){
  if(!isAdmin()) return;
  const b = allBooks.find(x=>x.id===id);
  if(!b) return;
  bookModalTitle.textContent = 'Edit Book';
  bkId.value=b.id; bkTitle.value=b.title; bkAuthor.value=b.author; bkSubject.value=b.subject||''; bkYear.value=b.year||''; bkCode.value=b.code||''; bkCover.value=b.cover||'';
  delBookBtn.style.display='inline-flex';
  bookModal.showModal();
}

bookForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!isAdmin()) return alert('Admins only');
  const payload = {
    title: bkTitle.value.trim(),
    author: bkAuthor.value.trim(),
    subject: bkSubject.value.trim()||null,
    year: bkYear.value? Number(bkYear.value): null,
    code: bkCode.value.trim()||null,
    cover: bkCover.value.trim()||null,
    available: true,
    holderId: null,
    holderName: null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  try{
    if(bkId.value){
      await _db.collection('books').doc(bkId.value).update({...payload});
    }else{
      await _db.collection('books').add(payload);
    }
    bookModal.close();
    await loadBooks();
  }catch(err){ alert(err.message); }
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

// ===== Borrow / Return =====
async function toggleBorrow(bookId){
  if(!currentUser) return alert('Please sign in first.');
  const ref = _db.collection('books').doc(bookId);
  await _db.runTransaction(async (tx)=>{
    const snap = await tx.get(ref);
    if(!snap.exists) throw new Error('Book not found');
    const b = snap.data();
    const borrowing = (b.available !== false);
    const newData = borrowing
      ? { available:false, holderId:currentUser.uid, holderName: currentUser.displayName, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }
      : { available:true, holderId:null, holderName:null, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    tx.update(ref, newData);

    // activity log
    const act = borrowing ? 'borrow' : 'return';
    tx.set(_db.collection('borrows').doc(), {
      bookId: ref.id,
      bookTitle: b.title,
      userId: currentUser.uid,
      userName: currentUser.displayName,
      action: act,
      ts: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
  await Promise.all([loadBooks(), loadActivity(), loadRecommendations()]);
}

// ===== Activity Feed =====
async function loadActivity(){
  const snap = await _db.collection('borrows').orderBy('ts','desc').limit(20).get();
  const rows = snap.docs.map(d=>d.data());
  activityEl.innerHTML = rows.map(r=>`
    <li>
      <span class="who">${r.userName}</span>
      <span class="what">${r.action==='borrow'?'borrowed':'returned'}</span>
      <strong>${r.bookTitle}</strong>
      <span class="when">${r.ts?.toDate ? fmt(r.ts.toDate()) : ''}</span>
    </li>`).join('');
}

// ===== Recommendations (Top borrowed) =====
async function loadRecommendations(){
  // naive approach: read last 500 borrow logs and rank
  const snap = await _db.collection('borrows').orderBy('ts','desc').limit(500).get();
  const count = new Map();
  snap.docs.forEach(d=>{
    const x = d.data();
    const key = x.bookTitle;
    count.set(key, (count.get(key)||0)+1);
  });
  const top = Array.from(count.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5);
  recoList.innerHTML = top.map(([title,n])=>`<li>${title} <span class="badge">${n}</span></li>`).join('');
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
      available: b.available!==false, holderId: b.holderId||null, holderName:b.holderName||null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
  });
  await batch.commit();
  await loadBooks();
});

// ===== Live hooks =====
_qhook();
function _qhook(){
  let t; [q, subjectFilter, yearFilter, availabilityFilter].forEach(el=>{
    el.addEventListener('input',()=>{ clearTimeout(t); t=setTimeout(renderBooks,150); });
  });
}

// ===== Init =====
(async function init(){
  await loadBooks();
  await loadActivity();
  await loadRecommendations();
})();
