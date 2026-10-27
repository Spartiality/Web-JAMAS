/* ============================================================
 * E-Voter — Lapisan Penyimpanan
 * Mode A: Firebase Realtime Database → hasil suara TERPUSAT,
 *         terkumpul dari semua perangkat secara real-time.
 * Mode B: localStorage → demo lokal (satu browser saja).
 *
 * Pilihan mode ada di js/evoter-config.js (EV_FIREBASE.enabled).
 * ============================================================ */

const EV = (() => {
  const KEY = 'evoter_db_v2';
  const SESSION_KEY = 'evoter_session_v2';
  const MODE = (typeof EV_FIREBASE !== 'undefined' && EV_FIREBASE.enabled && EV_FIREBASE.databaseURL)
    ? 'firebase' : 'local';
  const isFirebase = () => MODE === 'firebase';

  const fbdb = MODE === 'firebase' ? (() => {
    firebase.initializeApp(EV_FIREBASE);
    return firebase.database();
  })() : null;
  const r = (p) => fbdb.ref('evoter/' + p);

  /* ---------- util ---------- */
  function hash(str) { // hash sederhana utk PIN/password (bukan kriptografi kuat)
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return 'h' + h.toString(36);
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const generatePin = () => String(Math.floor(1000 + Math.random() * 9000));

  /* ============================================================
   * MODE LOKAL (localStorage)
   * ============================================================ */
  const defaultDB = () => ({
    election: { title: 'Pemilihan Ketua JAMAS 2026', desc: '', status: 'closed', openedAt: null, closedAt: null },
    admin: { username: 'admin', passHash: hash('admin123') },
    candidates: [], voters: [], votes: [], session: null,
  });
  let db = MODE === 'local' ? loadLocal() : null;

  function loadLocal() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...defaultDB(), ...JSON.parse(raw) };
    } catch (e) { /* corrupt -> reset */ }
    return defaultDB();
  }
  function saveLocal() { localStorage.setItem(KEY, JSON.stringify(db)); }

  /* ============================================================
   * PEMILIHAN
   * ============================================================ */
  async function getElection() {
    if (MODE === 'firebase') {
      const s = await r('election/meta').get();
      return s.exists() ? { status: 'closed', ...s.val() } : defaultLocalElection();
    }
    return { ...db.election };
  }
  function defaultLocalElection() {
    return { title: 'Pemilihan Ketua JAMAS 2026', desc: '', status: 'closed', openedAt: null, closedAt: null };
  }
  async function setElection(patch) {
    if (MODE === 'firebase') {
      await r('election/meta').update(patch);
      return;
    }
    db.election = { ...db.election, ...patch };
    saveLocal();
  }
  async function openElection() {
    await setElection({ status: 'open', openedAt: Date.now(), closedAt: null });
  }
  async function closeElection() {
    await setElection({ status: 'closed', closedAt: Date.now() });
  }

  /* ============================================================
   * AKUN ADMIN
   * ============================================================ */
  async function adminLogin(username, password) {
    if (MODE === 'firebase') {
      await ensureAdminSeed();
      const s = await r('election/admin').get();
      const a = s.val();
      const ok = a && username === a.username && hash(password) === a.passHash;
      if (ok) sessionStorage.setItem('evoter_admin', '1');
      return ok;
    }
    const ok = username === db.admin.username && hash(password) === db.admin.passHash;
    if (ok) sessionStorage.setItem('evoter_admin', '1');
    return ok;
  }
  async function ensureAdminSeed() {
    const s = await r('election/admin').get();
    if (!s.exists()) await r('election/admin').set({ username: 'admin', passHash: hash('admin123') });
  }
  const isAdmin = () => sessionStorage.getItem('evoter_admin') === '1';
  function adminLogout() { sessionStorage.removeItem('evoter_admin'); }
  async function updateAdmin(username, password) {
    const patch = { username: username || 'admin' };
    if (password) patch.passHash = hash(password);
    if (MODE === 'firebase') await r('election/admin').update(patch);
    else { Object.assign(db.admin, patch); saveLocal(); }
  }

  /* ============================================================
   * KANDIDAT
   * ============================================================ */
  async function getCandidates() {
    if (MODE === 'firebase') {
      const s = await r('candidates').get();
      if (!s.exists()) return [];
      return Object.entries(s.val())
        .map(([id, c]) => ({ id, ...c }))
        .sort((a, b) => (a.no || 0) - (b.no || 0));
    }
    return [...db.candidates].sort((a, b) => a.no - b.no);
  }
  async function addCandidate(c) {
    const cand = {
      no: c.no != null && c.no !== '' ? Number(c.no) : null, // null = autos nanti
      name: (c.name || '').trim(),
      kelas: (c.kelas || '').trim(),
      photo: (c.photo || '').trim(),
      visi: (c.visi || '').trim(),
      misi: (c.misi || '').trim(),
    };
    if (MODE === 'firebase') {
      if (cand.no == null) {
        const s = await r('candidates').get();
        const max = s.exists() ? Math.max(0, ...Object.values(s.val()).map(x => Number(x.no) || 0)) : 0;
        cand.no = max + 1;
        const ref = r('candidates').push();
        await ref.set(cand);
        return { id: ref.key, ...cand };
      }
      const ref = r('candidates').push();
      await ref.set(cand);
      return { id: ref.key, ...cand };
    }
    if (cand.no == null) cand.no = db.candidates.reduce((m, x) => Math.max(m, x.no), 0) + 1;
    cand.no = Number(cand.no);
    const saved = { id: uid(), ...cand };
    db.candidates.push(saved);
    saveLocal();
    return saved;
  }
  async function deleteCandidate(id) {
    if (MODE === 'firebase') return r('candidates/' + id).remove();
    db.candidates = db.candidates.filter(x => x.id !== id);
    saveLocal();
  }
  async function deleteAllCandidates() {
    if (MODE === 'firebase') return r('candidates').remove();
    db.candidates = [];
    saveLocal();
  }
  async function importCandidates(rows) {
    let ok = 0; const errors = [];
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].name) { errors.push(`Baris ${i + 1}: nama kosong`); continue; }
      await addCandidate(rows[i]); ok++;
    }
    return { ok, errors };
  }

  /* ============================================================
   * PEMILIH (voters ber-key NIS — menghindari duplikat di DB)
   * ============================================================ */
  async function getVoters() {
    if (MODE === 'firebase') {
      const s = await r('voters').get();
      if (!s.exists()) return [];
      return Object.entries(s.val())
        .map(([nis, v]) => ({ id: nis, ...v, nis }))
        .sort((a, b) => a.nis.localeCompare(b.nis, undefined, { numeric: true }));
    }
    return [...db.voters].sort((a, b) => a.nis.localeCompare(b.nis, undefined, { numeric: true }));
  }
  async function voterExists(nis) {
    if (MODE === 'firebase') {
      const s = await r('voters/' + nis).get();
      return s.exists();
    }
    return db.voters.some(v => v.nis === nis);
  }
  async function addVoter({ nis, name, pin }) {
    nis = String(nis || '').trim();
    if (!nis) return { error: 'NIS kosong' };
    if (await voterExists(nis)) return { error: `NIS ${nis} sudah terdaftar (duplikat di-skip)` };
    const voter = {
      nis, name: String(name || '').trim(),
      pin: (pin == null || pin === '') ? generatePin() : String(pin).trim(),
      hasVoted: false, votedAt: null,
    };
    if (MODE === 'firebase') await r('voters/' + nis).set(voter);
    else { db.voters.push({ id: nis, ...voter }); saveLocal(); }
    return { voter: { id: nis, ...voter } };
  }
  async function deleteVoter(id) {
    if (MODE === 'firebase') return r('voters/' + id).remove();
    db.voters = db.voters.filter(v => v.id !== id);
    saveLocal();
  }
  async function deleteAllVoters() {
    if (MODE === 'firebase') return r('voters').remove();
    db.voters = [];
    saveLocal();
  }
  async function importVoters(rows) {
    let ok = 0; const errors = [];
    if (MODE === 'firebase') {
      // ambil yang sudah ada dulu agar duplikat terdeteksi
      const existing = await getVoters();
      const have = new Set(existing.map(v => v.nis));
      const batch = {};
      rows.forEach((row, i) => {
        const nis = String(row.nis || '').trim();
        if (!nis) { errors.push(`Baris ${i + 1}: NIS kosong`); return; }
        if (have.has(nis)) { errors.push(`Baris ${i + 1}: NIS ${nis} duplikat (di-skip)`); return; }
        batch[nis] = {
          nis, name: String(row.name || '').trim(),
          pin: (row.pin == null || row.pin === '') ? generatePin() : String(row.pin).trim(),
          hasVoted: false, votedAt: null,
        };
        have.add(nis); ok++;
      });
      if (Object.keys(batch).length) await r('voters').update(batch);
      return { ok, errors };
    }
    for (let i = 0; i < rows.length; i++) {
      const res = await addVoter(rows[i]);
      if (res.error) errors.push(`Baris ${i + 1}: ${res.error}`); else ok++;
    }
    return { ok, errors };
  }
  async function resetAllVotes() {
    if (MODE === 'firebase') {
      const s = await r('voters').get();
      const updates = {};
      if (s.exists()) Object.entries(s.val()).forEach(([nis, v]) => {
        updates[nis + '/hasVoted'] = false;
        updates[nis + '/votedAt'] = null;
      });
      updates && Object.keys(updates).length && await r('voters').update(updates);
      await r('votes').remove();
      return;
    }
    db.votes = [];
    db.voters.forEach(v => { v.hasVoted = false; v.votedAt = null; });
    saveLocal();
  }
  async function factoryReset() {
    if (MODE === 'firebase') {
      await r('/').remove();
      await ensureAdminSeed();
      await setElection(defaultLocalElection());
      return;
    }
    localStorage.removeItem(KEY);
    db = loadLocal();
    saveLocal();
  }

  /* ============================================================
   * LOGIN VOTER + VOTING
   * ============================================================ */
  async function voterLogin(nis, pin) {
    nis = String(nis || '').trim();
    if (MODE === 'firebase') {
      const s = await r('voters/' + nis).get();
      if (!s.exists()) return { error: 'NIS tidak terdaftar' };
      const v = s.val();
      if (v.pin !== String(pin).trim()) return { error: 'PIN salah' };
      localStorage.setItem(SESSION_KEY, JSON.stringify({ nis, name: v.name }));
      return { voter: { id: nis, nis, ...v } };
    }
    const v = db.voters.find(x => x.nis === nis);
    if (!v) return { error: 'NIS tidak terdaftar' };
    if (v.pin !== String(pin).trim()) return { error: 'PIN salah' };
    db.session = v.id; saveLocal();
    return { voter: { ...v } };
  }
  function getVoterSession() {
    if (MODE === 'firebase') {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    }
    if (!db.session) return null;
    const v = db.voters.find(x => x.id === db.session);
    return v ? { ...v } : null;
  }
  function voterLogout() {
    localStorage.removeItem(SESSION_KEY);
    if (MODE === 'local') { db.session = null; saveLocal(); }
  }

  /**
   * Simpan suara (identitas terekam utk audit).
   * Firebase: transaksi atomik pada voters/{nis}/hasVoted →
   * mustahil double-vote meski dari dua perangkat bersamaan.
   */
  async function castVote(candidateId) {
    const s = getVoterSession();
    if (!s) return { error: 'Belum login' };
    const el = await getElection();
    if (el.status !== 'open') return { error: 'Pemilihan sedang ditutup' };

    if (MODE === 'firebase') {
      const vref = r('voters/' + s.nis);
      let committed = false;
      await vref.transaction((v) => {
        if (v === null) return v;            // voter hilang -> biarkan null (abort)
        if (v.hasVoted) return;              // return undefined = ABORT transaksi
        committed = true;
        return { ...v, hasVoted: true, votedAt: Date.now() };
      });
      if (!committed) return { error: 'Kamu sudah memberikan suara sebelumnya' };

      const csnap = await r('candidates/' + candidateId).get();
      if (!csnap.exists()) {
        await vref.update({ hasVoted: false, votedAt: null }); // lepas kunci
        return { error: 'Kandidat tidak valid' };
      }
      const ref = r('votes').push();
      await ref.set({
        nis: s.nis, name: s.name || '',
        candidateId,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
      });
      return { ok: true };
    }

    // mode lokal
    const v = db.voters.find(x => x.id === s.id);
    if (v.hasVoted) return { error: 'Kamu sudah memberikan suara sebelumnya' };
    if (!db.candidates.some(c => c.id === candidateId)) return { error: 'Kandidat tidak valid' };
    db.votes.push({ id: uid(), voterId: v.id, nis: v.nis, name: v.name, candidateId, timestamp: Date.now() });
    v.hasVoted = true; v.votedAt = Date.now();
    saveLocal();
    return { ok: true };
  }

  /* ============================================================
   * HASIL
   * ============================================================ */
  async function getResults() {
    const [cands, voters, votesSnap] = await Promise.all([
      getCandidates(), getVoters(),
      MODE === 'firebase' ? r('votes').get() : Promise.resolve({ val: () => db.votes, exists: () => db.votes.length }),
    ]);
    const votesRaw = MODE === 'firebase' ? (votesSnap.exists() ? Object.values(votesSnap.val()) : []) : db.votes;
    const votes = [...votesRaw].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const perCandidate = cands.map(c => ({ ...c, count: votes.filter(v => v.candidateId === c.id).length }));
    return {
      votes, perCandidate,
      total: votes.length,
      totalVoters: voters.length,
      belumVoted: voters.filter(v => !v.hasVoted).length,
    };
  }

  /** Live update utk admin: callback dipanggil tiap ada perubahan di DB terpusat. */
  function onResultsChanged(cb) {
    if (MODE !== 'firebase') return () => {};
    const handler = () => { try { cb(); } catch (e) { /* abaikan */ } };
    const refs = ['votes', 'voters', 'candidates'].map(p => r(p));
    refs.forEach(ref => ref.on('value', handler));
    return () => refs.forEach(ref => ref.off('value', handler));
  }
  const getMode = () => MODE;

  return {
    getElection, setElection, openElection, closeElection,
    adminLogin, isAdmin, adminLogout, updateAdmin,
    getCandidates, addCandidate, deleteCandidate, deleteAllCandidates, importCandidates,
    getVoters, addVoter, deleteVoter, deleteAllVoters, importVoters, resetAllVotes, factoryReset,
    voterLogin, getVoterSession, voterLogout, castVote,
    getResults, onResultsChanged, getMode,
  };
})();
