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
  enabled: true,
  apiKey: "AIzaSyAdKP_R9OuI1DWxGJhnUVYFO83sjwP7VrU",
  authDomain: "jamasmatsanewa-98921.firebaseapp.com",
  databaseURL: "https://jamasmatsanewa-98921-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jamasmatsanewa-98921",
};
