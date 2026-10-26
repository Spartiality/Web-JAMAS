/* ============================================================
 * E-Voter — Halaman Voting (Pemilih)
 * ============================================================ */

const $ = (sel) => document.querySelector(sel);
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

let selectedCandidateId = null;

function fmtTime(ts) {
  return new Date(ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}
function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
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

  if (voter.hasVoted) {
    show($('#alreadyVoted'));
    $('#votedAtText').textContent = 'Dipilih pada: ' + fmtTime(voter.votedAt);
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
    const img = c.photo
      ? `<img src="${escapeHtml(c.photo)}" alt="${escapeHtml(c.name)}"
             onerror="this.outerHTML='<div class=\\'avatar\\'>${(c.name || '?')[0]}</div>'">`
      : `<div class="avatar">${(c.name || '?')[0]}</div>`;
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
      <div class="avatar big">${(c.name || '?')[0]}</div>
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
  show($('#successModal'));
});

$('#btnCloseSuccess').addEventListener('click', () => {
  hide($('#successModal'));
  location.reload();
});

init();
