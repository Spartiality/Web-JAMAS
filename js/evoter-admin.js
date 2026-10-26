/* ============================================================
 * E-Voter — Panel Admin
 * Fitur: hasil, atur pemilihan, CRUD kandidat,
 *        import akun pemilih via spreadsheet (xlsx/csv), export.
 * ============================================================ */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}
function fmtTime(ts) {
  return ts ? new Date(ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
}

/* ================= LOGIN ADMIN ================= */
$('#adminLoginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!EV.adminLogin($('#adminUser').value.trim(), $('#adminPass').value)) {
    const err = $('#adminLoginError');
    err.textContent = 'Username atau password salah';
    show(err);
    return;
  }
  initPanel();
});

$('#btnAdminLogout').addEventListener('click', () => {
  EV.adminLogout();
  location.reload();
});

/* ================= TABS ================= */
$$('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    $$('.tab-pane').forEach(p => hide(p));
    show($('#tab-' + btn.dataset.tab));
  });
});

/* ================= INIT ================= */
function initPanel() {
  if (!EV.isAdmin()) return;
  $('#adminLogin').classList.add('hidden');
  show($('#adminPanel'));
  renderAll();
}

function renderAll() {
  renderElection();
  renderCandidateTable();
  renderVoterTable();
  renderResults();
}

/* ================= TAB PEMILIHAN ================= */
function renderElection() {
  const el = EV.getElection();
  $('#elTitle').value = el.title;
  $('#elDesc').value = el.desc;
  const btn = $('#btnToggleOpen');
  if (el.status === 'open') {
    btn.textContent = '🔒 Tutup Pemilihan';
    btn.className = 'btn danger';
  } else {
    btn.textContent = '🔓 Buka Pemilihan';
    btn.className = 'btn success';
  }
}

$('#electionForm').addEventListener('submit', (e) => {
  e.preventDefault();
  EV.setElection({ title: $('#elTitle').value.trim() || 'Pemilihan', desc: $('#elDesc').value.trim() });
  alert('Tersimpan ✔');
});

$('#btnToggleOpen').addEventListener('click', () => {
  const el = EV.getElection();
  if (el.status === 'open') {
    if (confirm('Tutup pemilihan? Pemilih tidak bisa vote lagi.')) EV.closeElection();
  } else {
    if (confirm('Buka pemilihan sekarang?')) EV.openElection();
  }
  renderElection();
});

/* ================= TAB KANDIDAT ================= */
function renderCandidateTable() {
  const list = EV.getCandidates();
  const t = $('#candidatesTable');
  t.innerHTML = `
    <thead><tr><th>No</th><th>Nama</th><th>Kelas</th><th>Visi</th><th>Suara</th><th></th></tr></thead>
    <tbody>
      ${list.length === 0 ? '<tr><td colspan="6" class="muted center">Belum ada kandidat.</td></tr>' : ''}
      ${list.map(c => `
        <tr>
          <td><b>${c.no}</b></td>
          <td><div class="cand-cell">
            ${c.photo ? `<img class="mini-avatar" src="${escapeHtml(c.photo)}" onerror="this.style.display='none'">`
                      : `<div class="mini-avatar avatar">${(c.name || '?')[0]}</div>`}
            ${escapeHtml(c.name)}
          </div></td>
          <td>${escapeHtml(c.kelas)}</td>
          <td class="muted small">${escapeHtml(c.visi)}</td>
          <td>${EV.getResults().votes.filter(v => v.candidateId === c.id).length}</td>
          <td><button class="btn danger subtle" data-del="${c.id}">Hapus</button></td>
        </tr>
      `).join('')}
    </tbody>
  `;
  t.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    if (confirm('Hapus kandidat ini?')) { EV.deleteCandidate(b.dataset.del); renderAll(); }
  }));
}

$('#candidateForm').addEventListener('submit', (e) => {
  e.preventDefault();
  EV.addCandidate({
    no: $('#candNo').value,
    name: $('#candName').value,
    kelas: $('#candKelas').value,
    photo: $('#candPhoto').value,
    visi: $('#candVisi').value,
    misi: $('#candMisi').value,
  });
  $('#candidateForm').reset();
  renderAll();
});

$('#btnDeleteAllCandidates').addEventListener('click', () => {
  if (confirm('Hapus SEMUA kandidat?')) { EV.deleteAllCandidates(); renderAll(); }
});

/* ================= TAB PEMILIH ================= */
const VOTER_PAGE = 15;
let voterOffset = 0;

function renderVoterTable() {
  const q = $('#voterSearch').value.trim().toLowerCase();
  let list = EV.getVoters();
  $('#voterCount').textContent = list.length + ' orang';
  if (q) list = list.filter(v => v.nis.toLowerCase().includes(q) || (v.name || '').toLowerCase().includes(q));

  const page = list.slice(voterOffset, voterOffset + VOTER_PAGE);
  const t = $('#votersTable');

  t.innerHTML = `
    <thead><tr><th>NIS</th><th>Nama</th><th>PIN</th><th>Status</th><th></th></tr></thead>
    <tbody>
      ${page.length === 0 ? '<tr><td colspan="5" class="muted center">Tidak ada data.</td></tr>' : ''}
      ${page.map(v => `
        <tr>
          <td><b>${escapeHtml(v.nis)}</b></td>
          <td>${escapeHtml(v.name)}</td>
          <td><code>${escapeHtml(v.pin)}</code></td>
          <td>${v.hasVoted ? '<span class="tag done">✔ Sudah vote</span>' : '<span class="tag open">Belum</span>'}</td>
          <td><button class="btn danger subtle" data-del="${v.id}">Hapus</button></td>
        </tr>
      `).join('')}
    </tbody>
  `;

  // navigasi halaman (dibangun ulang setiap render, tidak menggandakan)
  let nav = $('#voterNav');
  if (!nav) {
    nav = document.createElement('div');
    nav.className = 'row between';
    nav.id = 'voterNav';
    t.parentElement.appendChild(nav);
  }
  nav.innerHTML = `
    <button class="btn subtle" id="vPrev" ${voterOffset === 0 ? 'disabled' : ''}>← Sebelumnya</button>
    <span class="muted small">${list.length} data</span>
    <button class="btn subtle" id="vNext" ${voterOffset + VOTER_PAGE >= list.length ? 'disabled' : ''}>Berikutnya →</button>
  `;
  $('#vPrev').addEventListener('click', () => { voterOffset = Math.max(0, voterOffset - VOTER_PAGE); renderVoterTable(); });
  $('#vNext').addEventListener('click', () => { voterOffset += VOTER_PAGE; renderVoterTable(); });
}

$('#voterSearch').addEventListener('input', () => { voterOffset = 0; renderVoterTable(); });

$('#voterForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const res = EV.addVoter({ nis: $('#voteNis').value, name: $('#voteName').value, pin: $('#votePin').value });
  if (res.error) { alert(res.error); return; }
  $('#voterForm').reset();
  renderVoterTable();
});

$('#btnDeleteAllVoters').addEventListener('click', () => {
  if (confirm('Hapus SEMUA akun pemilih? Hasil vote juga ikut reset.')) {
    EV.deleteAllVoters(); EV.resetAllVotes(); renderAll();
  }
});

/* ============================================================
 * ⭐ IMPORT SPREADSHEET (Excel/CSV) — fitur utama
 * ============================================================ */
let importRows = [];

/** Normalisasi nama kolom -> field standar. Kenali variasi huruf besar-kecil
 *  dan judul berbeda ("No Induk", "Nama Siswa", "Kata Sandi", dst). */
function normalizeHeader(h) {
  const s = String(h).toLowerCase().replace(/[\s_.-]/g, '');
  if (/^(nis|nim|nourut|noinduk|induk|id|nisn)$/.test(s)) return 'nis';
  if (/(nis|nim|induk|idsiswa|nourut)$/.test(s) || s === 'id') return 'nis';
  if (s.includes('nama')) return 'name';
  if (/(pin|password|sand|keysandi|pass)$/.test(s) || s === 'pin') return 'pin';
  return null;
}

function parseFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (raw.length === 0) { alert('File kosong / tidak ada data baris.'); return; }

      // Deteksi nama kolom dari baris pertama
      const firstRow = raw[0];
      const colMap = {};
      Object.keys(firstRow).forEach(k => {
        const f = normalizeHeader(k);
        if (f && !colMap[f]) colMap[f] = k; // pakai yang pertama saja
      });

      if (!colMap.nis) {
        alert('Kolom NIS tidak ditemukan. Pastikan ada header yang mengandung "NIS".\nHeader terbaca: ' + Object.keys(firstRow).join(', '));
        return;
      }

      // Kalau baris pertama justru data (tidak ada header) & kolom bernama generik
      const generic = Object.keys(firstRow).every(k => /^__EMPTY/.test(k) || k === '\ufeff');
      let rowsOut, headerNote;
      if (generic) {
        rowsOut = raw.map((r, i) => {
          const vals = Object.values(r).map(String);
          return { nis: vals[0], name: vals[1] || '', pin: vals[2] || '', __line: i + 1 };
        });
        headerNote = 'Dibaca tanpa header (kolom: NIS, Nama, PIN)';
      } else {
        rowsOut = raw.map((r, i) => ({
          nis: String(r[colMap.nis] ?? '').trim(),
          name: colMap.name ? String(r[colMap.name] ?? '').trim() : '',
          pin: colMap.pin ? String(r[colMap.pin] ?? '').trim() : '',
          __line: i + 1,
        }));
        headerNote = `Kolom terdeteksi: NIS=${colMap.nis}` +
          (colMap.name ? `, Nama=${colMap.name}` : ', nama=(kosong)') +
          (colMap.pin ? `, PIN=${colMap.pin} (otomatis jika tidak ada)` : ', PIN=(auto)');
      }

      importRows = rowsOut.filter(r => r.nis); // skip baris tanpa NIS
      const skipped = rowsOut.length - importRows.length;

      renderImportPreview(headerNote, skipped);
    } catch (err) {
      alert('Gagal membaca file: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function renderImportPreview(headerNote, skipped) {
  const auto = importRows.filter(r => !r.pin).length;
  $('#importStat').innerHTML =
    `${importRows.length} baris valid` +
    (auto ? ` • ${auto} PIN akan digenerate otomatis` : '') +
    (skipped ? ` • ${skipped} baris kosong di-skip` : '');
  $('#importErrors').textContent = headerNote;

  $('#importTable').innerHTML = `
    <thead><tr><th>#</th><th>NIS</th><th>Nama</th><th>PIN</th></tr></thead>
    <tbody>
      ${importRows.map((r, i) => `
        <tr>
          <td>${r.__line}</td>
          <td><b>${escapeHtml(r.nis)}</b></td>
          <td>${escapeHtml(r.name)}</td>
          <td>${r.pin ? escapeHtml(r.pin) : '<span class="muted">(auto)</span>'}</td>
        </tr>
      `).join('')}
    </tbody>
  `;
  show($('#importPreview'));
}

$('#fileImport').addEventListener('change', (e) => {
  if (e.target.files[0]) parseFile(e.target.files[0]);
  e.target.value = ''; // allow re-upload same file
});

$('#btnImportCancel').addEventListener('click', () => {
  importRows = [];
  hide($('#importPreview'));
});

$('#btnImportCommit').addEventListener('click', () => {
  if (importRows.length === 0) return;
  const res = EV.importVoters(importRows);
  importRows = [];
  hide($('#importPreview'));
  const out = $('#importResult');
  out.textContent = `✅ ${res.ok} akun berhasil diimport.` + (res.errors.length ? ` ${res.errors.length} baris di-skip (NIS duplikat/kosong).` : '');
  out.className = 'success';
  show(out);
  setTimeout(() => hide(out), 6000);
  renderAll();
});

$('#btnDownloadTemplate').addEventListener('click', downloadTemplate);

function downloadTemplate() {
  const csv = 'NIS,Nama,PIN\n12345,Budi Santoso,\n12346,Siti Aminah,\n12347,Andi Pratama,\n';
  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'template_pemilih.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ================= EXPORT CSV ================= */
function toCSV(rows) {
  return rows.map(r => r.map(v => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(';')).join('\n');
}
function downloadCSV(rows, filename) {
  const blob = new Blob(["\ufeff" + toCSV(rows)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

$('#btnExportAccounts').addEventListener('click', () => {
  const rows = [['NIS', 'Nama', 'PIN', 'SudahVote']].concat(
    EV.getVoters().map(v => [v.nis, v.name, v.pin, v.hasVoted ? 'ya' : 'belum'])
  );
  downloadCSV(rows, 'akun_pemilih.csv');
});

$('#btnExportVotes').addEventListener('click', () => {
  const r = EV.getResults();
  const candName = id => r.perCandidate.find(c => c.id === id)?.name || '(invalid)';
  const rows = [['Waktu', 'NIS', 'Nama', 'Memilih']].concat(
    r.votes.map(v => [fmtTime(v.timestamp), v.nis, v.name, candName(v.candidateId)])
  );
  downloadCSV(rows, 'riwayat_suara.csv');
});

$('#btnExportCandidates').addEventListener('click', () => {
  const rows = [['No', 'Nama', 'Kelas', 'Suara']].concat(
    EV.getResults().perCandidate.map(c => [c.no, c.name, c.kelas, c.count])
  );
  downloadCSV(rows, 'hasil_per_kandidat.csv');
});

/* ================= DASHBOARD / HASIL ================= */
function renderResults() {
  const r = EV.getResults();

  // stat cards
  $('#statRow').innerHTML = `
    <div class="stat"><b>${r.total}</b><span>Total Suara</span></div>
    <div class="stat"><b>${r.totalVoters}</b><span>Total Pemilih</span></div>
    <div class="stat"><b>${r.belumVoted}</b><span>Belum Memilih</span></div>
    <div class="stat"><b>${r.totalVoters ? Math.round(r.total / r.totalVoters * 100) : 0}%</b><span>Partisipasi</span></div>
  `;

  // bar chart sederhana (max di-highlight)
  const max = Math.max(1, ...r.perCandidate.map(c => c.count));
  $('#chart').innerHTML = r.perCandidate.length === 0
    ? '<p class="muted center">Belum ada kandidat.</p>'
    : r.perCandidate.map(c => `
      <div class="bar-row">
        <div class="bar-label"><b>${c.no}.</b> ${escapeHtml(c.name)} ${c.kelas ? `<span class="muted">(${escapeHtml(c.kelas)})</span>` : ''}</div>
        <div class="bar-track">
          <div class="bar-fill ${c.count === max ? 'lead' : ''}" style="width:${(c.count / max * 100).toFixed(1)}%"></div>
        </div>
        <div class="bar-val"><b>${c.count}</b> <span class="muted">(${r.total ? (c.count / r.total * 100).toFixed(1) : 0}%)</span></div>
      </div>
    `).join('');

  // riwayat (10 terakhir)
  const recent = r.votes.slice(-10).reverse();
  $('#votesTable').innerHTML = `
    <thead><tr><th>Waktu</th><th>NIS</th><th>Nama</th><th>Memilih Kandidat</th></tr></thead>
    <tbody>
      ${recent.length === 0 ? '<tr><td colspan="4" class="muted center">Belum ada suara masuk.</td></tr>' : ''}
      ${recent.map(v => {
        const c = r.perCandidate.find(x => x.id === v.candidateId);
        return `<tr><td>${fmtTime(v.timestamp)}</td><td><b>${escapeHtml(v.nis)}</b></td><td>${escapeHtml(v.name)}</td><td>${c ? `<b>${c.no}</b>. ${escapeHtml(c.name)}` : '-'}</td></tr>`;
      }).join('')}
    </tbody>
  `;
}

$('#btnResetVotes').addEventListener('click', () => {
  if (confirm('Reset SEMUA suara (semua pemilih jadi belum vote)?')) {
    EV.resetAllVotes();
    renderAll();
  }
});

/* ================= PENGATURAN ================= */
$('#adminAccountForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const user = $('#setAdminUser').value.trim() || 'admin';
  const pass = $('#setAdminPass').value;
  EV.updateAdmin(user, pass || currentPass());
  alert('Akun admin diperbarui ✔');
  $('#setAdminPass').value = '';
});

function currentPass() {
  try {
    const raw = localStorage.getItem('evoter_db_v1');
    return raw ? JSON.parse(raw).admin.password : 'admin123';
  } catch { return 'admin123'; }
}

$('#btnFactoryReset').addEventListener('click', () => {
  if (confirm('RESET TOTAL: semua data (kandidat, pemilih, suara) akan dihapus permanen. Lanjut?')) {
    localStorage.removeItem('evoter_db_v1');
    sessionStorage.clear();
    location.reload();
  }
});

initPanel();
