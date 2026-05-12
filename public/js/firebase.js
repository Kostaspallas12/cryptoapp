/* ============================================
   firebase.js — Google Auth + Firestore Sync
   ============================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, onSnapshot }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCsesOgEGCuLOCSE2MJA1cq537h3byK5Do",
  authDomain: "cryptointel1.firebaseapp.com",
  projectId: "cryptointel1",
  storageBucket: "cryptointel1.firebasestorage.app",
  messagingSenderId: "815872629847",
  appId: "1:815872629847:web:b9f486897ba756e431d712"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const FirebaseAuth = {

  currentUser: null,

  /* ── Εκκίνηση — παρακολούθηση auth state ── */
  init(onLogin, onLogout) {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.currentUser = user;
        UI.updateAuthUI(user);
        await this.syncFromCloud(); // Φόρτωσε δεδομένα από cloud
        if (onLogin) onLogin(user);
      } else {
        this.currentUser = null;
        UI.updateAuthUI(null);
        if (onLogout) onLogout();
      }
    });
  },

  /* ── Google Sign In ── */
  async signInWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Sign in error:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        alert('Σφάλμα σύνδεσης. Δοκίμασε ξανά.');
      }
    }
  },

  /* ── Sign Out ── */
  async signOut() {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  },

  /* ── Αποθήκευση στο Firestore ── */
  async saveToCloud() {
    if (!this.currentUser) return;
    try {
      const ref = doc(db, 'users', this.currentUser.uid);
      await setDoc(ref, {
        portfolio: Portfolio.data,
        alerts: Alerts.data,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error('Save to cloud error:', err);
    }
  },

  /* ── Φόρτωση από Firestore ── */
  async syncFromCloud() {
    if (!this.currentUser) return;
    try {
      const ref  = doc(db, 'users', this.currentUser.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        if (data.portfolio) {
          Portfolio.data = data.portfolio;
          Portfolio.save(); // Αποθήκευσε και στο localStorage
        }
        if (data.alerts) {
          Alerts.data = data.alerts;
          Alerts.save();
        }
      }
    } catch (err) {
      console.error('Sync from cloud error:', err);
    }
  }

};

// Κάνε auto-save στο cloud όταν αλλάζει το portfolio ή τα alerts
const _portfolioSave = Portfolio.save.bind(Portfolio);
Portfolio.save = function() {
  _portfolioSave();
  if (FirebaseAuth.currentUser) FirebaseAuth.saveToCloud();
};

const _alertsSave = Alerts.save.bind(Alerts);
Alerts.save = function() {
  _alertsSave();
  if (FirebaseAuth.currentUser) FirebaseAuth.saveToCloud();
};

export { FirebaseAuth };