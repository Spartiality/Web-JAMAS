/* ============================================================
 * E-Voter — Halaman Voting (Pemilih)
 * ============================================================ */

const $ = (sel) => document.querySelector(sel);
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

let selectedCandidateId = null;

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

/* Foto kandidat dengan fallback inisial nama (dipakai di kartu & modal konfirmasi). */
function candidateAvatar(c, big = false) {
  const cls = big ? 'avatar big' : 'avatar';
  const initial = (c.name || '?')[0];
  if (!c.photo) return `<div class="${cls}">${escapeHtml(initial)}</div>`;
  return `<img class="${cls}" src="${escapeHtml(c.photo)}" alt="${escapeHtml(c.name)}"
    onerror="this.outerHTML='<div class=\\'${cls}\\'>${escapeHtml(initial)}</div>'">`;
}

/* ---------- Inisialisasi ---------- */
async function init() {
  const el = await EV.getElection();
  $('#electionTitle').textContent = el.title;
  $('#electionDesc').textContent = el.desc;

  const b = $('#electionStatus');
  b.textContent = el.status === 'open' ? '● PEMILIHAN DIBUKA' : '● PEMILIHAN DITUTUP';
  b.className = 'badge ' + (el.status === 'open' ? 'open' : 'closed');

  const voter = EV.getVoterSession();
  if (voter) showVoteBoard(voter, el);
  else show($('#loginCard'));
}

async function showVoteBoard(voter, elArg) {
  hide($('#loginCard'));
  show($('#voteCard'));
  $('#voterName').textContent = voter.name || voter.nis;
  $('#voterNis').textContent = voter.nis;

  const el = elArg || await EV.getElection();

  // Sudah memilih -> jangan tampilkan papan voting lagi, langsung ke halaman terima kasih.
  let hasVoted = !!voter.hasVoted;
  if (!hasVoted) {
    try {
      const list = await EV.getVoters();
      const fresh = list.find(v => v.nis === voter.nis);
      hasVoted = !!(fresh && fresh.hasVoted);
    } catch (e) { /* biarkan alur normal */ }
  }
  if (hasVoted) {
    location.replace('vote-success.html');
    return;
  }
  if (el.status !== 'open') {
    show($('#closedNotice'));
    return;
  }
  show($('#votingArea'));
  await renderCandidates();
}

/* ---------- Login ---------- */
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await EV.voterLogin($('#loginNis').value.trim(), $('#loginPin').value);
  if (res.error) {
    const err = $('#loginError');
    err.textContent = res.error;
    show(err);
    return;
  }
  $('#loginForm').reset();
  hide($('#loginError'));
  await showVoteBoard(res.voter);
});

$('#btnLogout').addEventListener('click', () => {
  EV.voterLogout();
  location.reload();
});

/* ---------- Kartu Kandidat ---------- */
async function renderCandidates() {
  const list = await EV.getCandidates();
  const grid = $('#candidateGrid');
  grid.innerHTML = '';

  if (list.length === 0) {
    grid.innerHTML = '<p class="muted">Belum ada kandidat. Panitia belum mengisi daftar kandidat.</p>';
    return;
  }

  list.forEach(c => {
    const card = document.createElement('div');
    card.className = 'candidate-card';
    const img = candidateAvatar(c);
    card.innerHTML = `
      ${img}
      <div class="cand-no">No. Urut ${c.no}</div>
      <h3>${escapeHtml(c.name)}</h3>
      ${c.kelas ? `<div class="tag">${escapeHtml(c.kelas)}</div>` : ''}
      ${c.visi ? `<p class="cand-visi"><b>Visi:</b> ${escapeHtml(c.visi)}</p>` : ''}
      <details ${c.misi ? '' : 'hidden'}>
        <summary>Lihat Misi</summary>
        <p class="cand-misi">${escapeHtml(c.misi || '')}</p>
      </details>
      <button class="btn primary">Pilih Kandidat ${c.no}</button>
    `;
    card.querySelector('.btn').addEventListener('click', () => openConfirm(c.id));
    grid.appendChild(card);
  });
}

/* ---------- Modal Konfirmasi ---------- */
async function openConfirm(id) {
  const c = (await EV.getCandidates()).find(x => x.id === id);
  if (!c) return;
  selectedCandidateId = id;
  $('#confirmCandidate').innerHTML = `
    <div class="confirm-inner">
      ${candidateAvatar(c, true)}
      <div>
        <div class="tag">No. Urut ${c.no}</div>
        <h3>${escapeHtml(c.name)}</h3>
        ${c.kelas ? `<div class="tag">${escapeHtml(c.kelas)}</div>` : ''}
      </div>
    </div>
  `;
  show($('#confirmModal'));
}

$('#btnCancelVote').addEventListener('click', () => {
  selectedCandidateId = null;
  hide($('#confirmModal'));
});

$('#btnConfirmVote').addEventListener('click', async () => {
  if (!selectedCandidateId) return;
  const btn = $('#btnConfirmVote');
  btn.disabled = true;
  btn.textContent = 'Merekam suara...';
  const res = await EV.castVote(selectedCandidateId);
  btn.disabled = false;
  btn.textContent = 'Ya, Pilih Ini';
  hide($('#confirmModal'));
  if (res.error) {
    alert(res.error);
    init();
    return;
  }
  location.replace('vote-success.html');
});

init();
