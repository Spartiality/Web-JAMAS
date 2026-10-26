/* ============================================================
 * E-Voter — Konfigurasi Mode Penyimpanan
 * ============================================================
 * MODE TERPUSAT (Firebase Realtime Database):
 *   1. Buat proyek di https://console.firebase.google.com
 *   2. Tambahkan "Realtime Database" → salin URL-nya ke databaseURL
 *   3. Project Settings → Your apps → Web → salin apiKey/authDomain
 *   4. Set enabled: true di bawah ini, lalu push/deploy ulang.
 *
 * MODE LOKAL (localStorage, satu browser saja):
 *   Biarkan enabled: false.
 * ============================================================ */
const EV_FIREBASE = {
  enabled: false, // ← set true setelah kredensial di bawah terisi
  apiKey: "ISI_API_KEY",
  authDomain: "ISI_PROYEK.firebaseapp.com",
  databaseURL: "https://ISI_PROYEK-default-rtdb.firebaseio.com",
  projectId: "ISI_PROYEK",
};
