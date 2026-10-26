/* ============================================================
 * E-Voter — Lapisan Penyimpanan (localStorage)
 * Semua data aplikasi kelola di sini, supaya mudah
 * diganti ke backend lain (Firebase/Supabase/API) nantinya.
 * ============================================================ */

const EV = (() => {
  const KEY = 'evoter_db_v1';

  const defaultDB = () => ({
    election: {
      title: 'Pemilihan Ketua OSIS 2026',
      desc: 'Pilih kandidat terbaikmu!',
      status: 'closed', // 'closed' | 'open'
      openedAt: null,
      closedAt: null,
    },
    admin: { username: 'admin', password: 'admin123' },
    candidates: [], // { id, no, name, kelas, photo, visi, misi }
    voters: [],     // { id, nis, name, pin, hasVoted, votedAt }
    votes: [],      // { id, voterId, nis, name, candidateId, timestamp }
    session: null,  // nis voter yang sedang login
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...defaultDB(), ...JSON.parse(raw) };
    } catch (e) { /* corrupt -> reset */ }
    return defaultDB();
  }

  let db = load();

  function save() {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- Election ---------- */
  function getElection() { return { ...db.election }; }
  function setElection(patch) {
    db.election = { ...db.election, ...patch };
    save();
  }
  function openElection() {
    setElection({ status: 'open', openedAt: Date.now(), closedAt: null });
  }
  function closeElection() {
    setElection({ status: 'closed', closedAt: Date.now() });
  }

  /* ---------- Admin auth ---------- */
  function adminLogin(username, password) {
    const ok = username === db.admin.username && password === db.admin.password;
    if (ok) sessionStorage.setItem('evoter_admin', '1');
    return ok;
  }
  function isAdmin() { return sessionStorage.getItem('evoter_admin') === '1'; }
  function adminLogout() { sessionStorage.removeItem('evoter_admin'); }
  function updateAdmin(username, password) {
    db.admin = { username, password };
    save();
  }

  /* ---------- Kandidat ---------- */
  function getCandidates() { return [...db.candidates].sort((a, b) => a.no - b.no); }
  function addCandidate(c) {
    const no = c.no != null && c.no !== ''
      ? Number(c.no)
      : (db.candidates.reduce((m, x) => Math.max(m, x.no), 0) + 1);
    const cand = {
      id: uid(),
      no,
      name: (c.name || '').trim(),
      kelas: (c.kelas || '').trim(),
      photo: (c.photo || '').trim(),
      visi: (c.visi || '').trim(),
      misi: (c.misi || '').trim(),
    };
    db.candidates.push(cand);
    save();
    return cand;
  }
  function updateCandidate(id, patch) {
    const c = db.candidates.find(x => x.id === id);
    if (!c) return null;
    Object.assign(c, patch, { no: Number(patch.no ?? c.no) });
    save();
    return c;
  }
  function deleteCandidate(id) {
    db.candidates = db.candidates.filter(x => x.id !== id);
    save();
  }
  function deleteAllCandidates() {
    db.candidates = [];
    save();
  }

  /* ---------- Pemilih ---------- */
  function getVoters() {
    return [...db.voters].sort((a, b) => a.nis.localeCompare(b.nis, undefined, { numeric: true }));
  }
  function findVoter(nis) {
    return db.voters.find(v => v.nis === String(nis).trim()) || null;
  }
  function addVoter({ nis, name, pin }) {
    nis = String(nis).trim();
    if (!nis) return { error: 'NIS kosong' };
    if (db.voters.some(v => v.nis === nis)) return { error: `NIS ${nis} sudah terdaftar (duplikat di-skip)` };
    const p = (pin == null || pin === '') ? generatePin() : String(pin).trim();
    const voter = { id: uid(), nis, name: String(name || '').trim(), pin: p, hasVoted: false, votedAt: null };
    db.voters.push(voter);
    save();
    return { voter };
  }
  function generatePin() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }
  function updateVoter(id, patch) {
    const v = db.voters.find(x => x.id === id);
    if (!v) return null;
    if (patch.nis != null) {
      const dup = db.voters.find(x => x.id !== id && x.nis === patch.nis.trim());
      if (dup) return null;
    }
    Object.assign(v, patch);
    save();
    return v;
  }
  function deleteVoter(id) {
    db.voters = db.voters.filter(x => x.id !== id);
    save();
  }
  function deleteAllVoters() {
    db.voters = [];
    save();
  }
  function resetAllVotes() {
    db.votes = [];
    db.voters.forEach(v => { v.hasVoted = false; v.votedAt = null; });
    save();
  }

  /** Import massal kandidat dari array {no?, name, kelas?, ...} */
  function importCandidates(rows) {
    let ok = 0;
    const errors = [];
    rows.forEach((r, i) => {
      if (!r.name) { errors.push(`Baris ${i + 1}: nama kosong`); return; }
      addCandidate(r);
      ok++;
    });
    return { ok, errors };
  }

  /** Import massal pemilih dari array {nis, name, pin?} */
  function importVoters(rows) {
    let ok = 0;
    const errors = [];
    rows.forEach((r, i) => {
      const res = addVoter(r);
      if (res.error) errors.push(`Baris ${i + 1}: ${res.error}`);
      else ok++;
    });
    return { ok, errors };
  }

  /* ---------- Voting ---------- */
  function voterLogin(nis, pin) {
    const v = findVoter(nis);
    if (!v) return { error: 'NIS tidak terdaftar' };
    if (v.pin !== String(pin).trim()) return { error: 'PIN salah' };
    db.session = v.id;
    save();
    return { voter: getVoterSession() };
  }
  function getVoterSession() {
    if (!db.session) return null;
    const v = db.voters.find(x => x.id === db.session);
    return v ? { ...v } : null;
  }
  function voterLogout() { db.session = null; save(); }

  /**
   * Simpan suara. Identitas terekam (voterId, nis, name)
   * sesuai kebutuhan audit panitia.
   */
  function castVote(candidateId) {
    const v = getVoterSession();
    if (!v) return { error: 'Belum login' };
    if (db.election.status !== 'open') return { error: 'Pemilihan sedang ditutup' };
    if (v.hasVoted) return { error: 'Kamu sudah memberikan suara sebelumnya' };
    if (!db.candidates.some(c => c.id === candidateId)) return { error: 'Kandidat tidak valid' };
    db.votes.push({
      id: uid(),
      voterId: v.id,
      nis: v.nis,
      name: v.name,
      candidateId,
      timestamp: Date.now(),
    });
    const voter = db.voters.find(x => x.id === v.id);
    voter.hasVoted = true;
    voter.votedAt = Date.now();
    save();
    return { ok: true };
  }

  /* ---------- Hasil ---------- */
  function getResults() {
    const votes = [...db.votes].sort((a, b) => a.timestamp - b.timestamp);
    const perCandidate = db.candidates
      .slice()
      .sort((a, b) => a.no - b.no)
      .map(c => ({
        ...c,
        count: votes.filter(v => v.candidateId === c.id).length,
      }));
    return {
      votes,
      total: votes.length,
      totalVoters: db.voters.length,
      perCandidate,
      belumVoted: db.voters.filter(v => !v.hasVoted).length,
    };
  }

  return {
    getElection, setElection, openElection, closeElection,
    adminLogin, isAdmin, adminLogout, updateAdmin,
    getCandidates, addCandidate, updateCandidate, deleteCandidate, deleteAllCandidates, importCandidates,
    getVoters, findVoter, addVoter, updateVoter, deleteVoter, deleteAllVoters, importVoters, resetAllVotes,
    voterLogin, getVoterSession, voterLogout, castVote,
    getResults,
  };
})();
