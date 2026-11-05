/* ============================================================
 * E-Voter — Halaman Terima Kasih Setelah Voting
 * ============================================================ */

const $ = (sel) => document.querySelector(sel);

const REDIRECT_SECONDS = 5;
let redirectTimer = null;

function fmtTime(ts) {
  return new Date(ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/* Setelah beberapa detik, akhiri sesi pemilih lalu kembali ke halaman utama.
 * Sesi diakhiri agar tidak tersisa sesi pemilih di perangkat bersama. */
function startRedirectCountdown() {
  const note = $('#redirectNote');
  let seconds = REDIRECT_SECONDS;

  const render = () => {
    note.textContent = `Kembali ke halaman utama dalam ${seconds} detik...`;
  };

  render();
  redirectTimer = setInterval(() => {
    seconds--;
    if (seconds <= 0) {
      clearInterval(redirectTimer);
      EV.voterLogout();
      location.replace('index.html');
      return;
    }
    render();
  }, 1000);
}

async function init() {
  const voter = EV.getVoterSession();

  // Tidak ada sesi pemilih -> kembali ke halaman utama.
  if (!voter) {
    location.replace('index.html');
    return;
  }

  $('#thanksName').textContent = voter.name || voter.nis;

  // Mode Firebase tidak menyimpan votedAt di sesi, jadi ambil dari data pemilih.
  let votedAt = voter.votedAt;
  if (!votedAt) {
    try {
      const list = await EV.getVoters();
      const found = list.find(v => v.nis === voter.nis);
      if (found) votedAt = found.votedAt;
    } catch (e) { /* abaikan — cukup tampilkan nama */ }
  }

  $('#thanksMeta').textContent =
    'NIS ' + voter.nis + (votedAt ? ' · ' + fmtTime(votedAt) : '');
  $('#voterSummary').classList.remove('hidden');
}

$('#btnLogoutThanks').addEventListener('click', () => {
  if (redirectTimer) clearInterval(redirectTimer);
  EV.voterLogout();
  location.href = 'vote.html';
});

startRedirectCountdown();
init();
