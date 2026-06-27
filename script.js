
const GENRE_COLORS = {
  'Fiction':     '#2d6a4f',
  'Non-Fiction': '#1a4971',
  'Science':     '#6a2d8f',
  'History':     '#7a4f1d',
  'Biography':   '#1d6a6a',
  'Mystery':     '#4a1a3d',
  'Fantasy':     '#3d1a6a',
  'Self-Help':   '#6a6a1a',
  'Technology':  '#1a3d6a',
  'Other':       '#5a5a5a',
};

function getGenreColor(genre) {
  const clean = (genre || '').trim();
  if (!clean) return GENRE_COLORS['Other'];
  
  // Match predefined genres case-insensitively
  const match = Object.keys(GENRE_COLORS).find(k => k.toLowerCase() === clean.toLowerCase());
  if (match) return GENRE_COLORS[match];
  
  // Otherwise generate nice HSL
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 35%)`;
}


// ── STATE ────────────────────────────────────────────────────
let books       = loadFromStorage();
let activeFilter = 'all';
let searchQuery  = '';


// ── LOCAL STORAGE ────────────────────────────────────────────
function saveToStorage() {
  localStorage.setItem('borrowed_books', JSON.stringify(books));
}

function loadFromStorage() {
  const raw = localStorage.getItem('borrowed_books');
  return raw ? JSON.parse(raw) : [];
}


// ── UTILITIES ────────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2400);
}

function updateCount() {
  const n = books.length;
  document.getElementById('book-count').textContent =
    `${n} book${n !== 1 ? 's' : ''}`;
}


// ── COUNTDOWN LOGIC ──────────────────────────────────────────
// Returns days remaining (negative = overdue)
function daysRemaining(dueDateStr) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  return Math.round((due - now) / (1000 * 60 * 60 * 24));
}

// Returns urgency class and display text
function countdownInfo(dueDateStr, borrowedDateStr) {
  const days  = daysRemaining(dueDateStr);
  const total = daysRemaining(dueDateStr) - daysRemaining(borrowedDateStr) +
                Math.round(
                  (new Date(dueDateStr) - new Date(borrowedDateStr)) /
                  (1000 * 60 * 60 * 24)
                );

  // How far through the loan period are we? (for the progress bar)
  const loanDays = Math.round(
    (new Date(dueDateStr) - new Date(borrowedDateStr)) / (1000 * 60 * 60 * 24)
  );
  const elapsed  = loanDays - days;
  const progress = loanDays > 0
    ? Math.min(100, Math.max(0, Math.round((elapsed / loanDays) * 100)))
    : 100;

  let state, label, value;

  if (days < 0) {
    state = 'overdue';
    label = 'Overdue by';
    value = `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`;
  } else if (days === 0) {
    state = 'overdue';
    label = 'Due';
    value = 'Today!';
  } else if (days <= 3) {
    state = 'soon';
    label = 'Due in';
    value = `${days} day${days !== 1 ? 's' : ''}`;
  } else {
    state = 'safe';
    label = 'Due in';
    value = `${days} day${days !== 1 ? 's' : ''}`;
  }

  return { state, label, value, progress };
}

// Friendly date format: "15 Jan 2025"
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}


// ── FILTER LOGIC ─────────────────────────────────────────────
function urgencyOf(book) {
  const days = daysRemaining(book.due);
  if (days < 0 || days === 0) return 'overdue';
  if (days <= 3)               return 'due-soon';
  return 'safe';
}


// ── RENDER ───────────────────────────────────────────────────
function render() {
  updateCount();
  const grid = document.getElementById('grid');

  // Filter by tab
  let visible = books;
  if (activeFilter !== 'all') {
    visible = books.filter(b => urgencyOf(b) === activeFilter);
  }

  // Filter by search
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    visible = visible.filter(b =>
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q)
    );
  }

  // Empty state
  if (visible.length === 0) {
    grid.innerHTML = `
      <div class="empty">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.2" stroke-linecap="round" aria-hidden="true">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <p>${q || activeFilter !== 'all'
          ? 'No books match this filter.'
          : 'No borrowed books yet.'}</p>
        <small>${q || activeFilter !== 'all'
          ? 'Try a different filter or search term.'
          : 'Tap "Log a book" to add one you\'ve borrowed.'}</small>
      </div>`;
    return;
  }

  // Build cards
  grid.innerHTML = visible.map(book => {
    const color  = getGenreColor(book.genre);
    const cd     = countdownInfo(book.due, book.borrowed);

    return `
      <article class="card" data-id="${book.id}">

        <div class="card-spine" style="background: ${color};"></div>

        <div class="card-body">
          <div class="card-genre" style="color: ${color};">${escHtml(book.genre || 'Other')}</div>
          <div class="card-title">${escHtml(book.title)}</div>
          ${book.author ? `<div class="card-author">by ${escHtml(book.author)}</div>` : ''}
          ${book.borrowedFrom ? `
            <div class="card-borrowed">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="opacity: 0.7;">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Borrowed from: ${escHtml(book.borrowedFrom)}
            </div>` : ''}
        </div>

        <!-- Countdown badge -->
        <div class="countdown-block ${cd.state}">
          <span class="cd-label">${cd.label}</span>
          <span class="cd-value">${cd.value}</span>
        </div>

        <!-- Progress bar: how far through the loan period -->
        <div class="cd-bar-wrap ${cd.state}">
          <div class="cd-bar" style="width: ${cd.progress}%;"></div>
        </div>

        <!-- Due date -->
        <div class="card-due-row">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
          Return by ${formatDate(book.due)}
        </div>

        <div class="card-footer">
          <button class="btn-return" data-action="return" data-id="${book.id}">
            Mark returned
          </button>
          <button class="btn-icon" data-action="remove" data-id="${book.id}"
                  aria-label="Delete entry">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
            </svg>
          </button>
        </div>

      </article>`;
  }).join('');
}


// ── CRUD: CREATE ─────────────────────────────────────────────
function addBook() {
  const title        = document.getElementById('f-title').value.trim();
  const author       = document.getElementById('f-author').value.trim();
  const borrowedFrom = document.getElementById('f-borrowed-from').value.trim();
  const genre        = document.getElementById('f-genre').value.trim();
  const due          = document.getElementById('f-due').value;

  if (!title) {
    showToast('Please enter a book title');
    return;
  }
  if (!due) {
    showToast('Please set a return date');
    return;
  }
  if (daysRemaining(due) < 0) {
    showToast('Return date must be in the future');
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  const newBook = {
    id:           generateId(),
    title:        title,
    author:       author,        // optional
    borrowedFrom: borrowedFrom,  // new column
    genre:        genre || 'Other',
    due:          due,        // "YYYY-MM-DD" string
    borrowed:     today,      // date logged
  };

  books.push(newBook);   // Array.push — add to end
  saveToStorage();
  render();
  closeModal();
  showToast(`"${title}" logged — due ${formatDate(due)}`);
}


// ── CRUD: DELETE ─────────────────────────────────────────────
function removeBook(id) {
  books = books.filter(b => b.id !== id);   // Array.filter — removes by id
  saveToStorage();
  render();
  showToast('Entry removed');
}

// "Mark returned" also just removes the entry (book is back at library)
function markReturned(id) {
  const book = books.find(b => b.id === id);
  const name = book ? book.title : 'Book';
  books = books.filter(b => b.id !== id);
  saveToStorage();
  render();
  showToast(`"${name}" marked as returned`);
}


// ── MODAL ────────────────────────────────────────────────────
function openModal() {
  document.getElementById('f-title').value  = '';
  document.getElementById('f-author').value = '';
  document.getElementById('f-borrowed-from').value = '';
  document.getElementById('f-genre').value  = '';

  // Default due date = today + 14 days (typical library loan)
  const def = new Date();
  def.setDate(def.getDate() + 14);
  document.getElementById('f-due').value = def.toISOString().split('T')[0];

  // Min date = tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('f-due').min = tomorrow.toISOString().split('T')[0];

  document.getElementById('overlay').classList.add('open');
  document.getElementById('f-title').focus();
}

function closeModal() {
  document.getElementById('overlay').classList.remove('open');
}
document.getElementById('add-btn').addEventListener('click', openModal);
document.getElementById('cancel-btn').addEventListener('click', closeModal);
document.getElementById('save-btn').addEventListener('click', addBook);

document.getElementById('overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeModal();
});
document.getElementById('search-input').addEventListener('input', function(e) {
  searchQuery = e.target.value;
  render();
});
document.getElementById('filters').addEventListener('click', function(e) {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.filter;
  render();
});
document.getElementById('grid').addEventListener('click', function(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'remove')  removeBook(id);
  if (action === 'return')  markReturned(id);
});
setInterval(render, 60 * 1000);
render();
