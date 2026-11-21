/* Google sign-in + Firestore sync of the user store.
   The Firebase web config is public by design (security comes from Firestore rules). */
import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import { create } from 'zustand';
import { convertLegacy, pickData, useUser, type UserData } from '../store/user';

const app = initializeApp({
  apiKey: 'AIzaSyCsesOgEGCuLOCSE2MJA1cq537h3byK5Do',
  authDomain: 'cryptointel1.firebaseapp.com',
  projectId: 'cryptointel1',
  storageBucket: 'cryptointel1.firebasestorage.app',
  messagingSenderId: '815872629847',
  appId: '1:815872629847:web:b9f486897ba756e431d712',
});
const auth = getAuth(app);
const db = getFirestore(app);

export const useAuth = create<{ user: User | null; ready: boolean; syncing: boolean }>(() => ({
  user: null,
  ready: false,
  syncing: false,
}));

export const signIn = () =>
  signInWithPopup(auth, new GoogleAuthProvider()).catch((err) => {
    if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') throw err;
  });
export const logOut = () => signOut(auth);

let unsubStore: (() => void) | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function mergeById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const map = new Map(a.map((x) => [x.id, x]));
  b.forEach((x) => map.set(x.id, x));
  return [...map.values()];
}

async function pullFromCloud(user: User) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  const local = pickData(useUser.getState());
  if (!snap.exists()) return save(user);

  const d = snap.data();
  let cloud: UserData;
  if (d.v2) {
    cloud = d.v2 as UserData;
  } else {
    // First login after the redesign: convert the old cloud format
    cloud = convertLegacy(d.portfolio, d.alerts);
  }
  useUser.getState().replaceAll({
    watchlist: [...new Set([...(cloud.watchlist ?? []), ...local.watchlist])],
    transactions: mergeById(local.transactions, cloud.transactions ?? []),
    alerts: mergeById(local.alerts, cloud.alerts ?? []),
  });
  await save(user);
}

function save(user: User) {
  return setDoc(
    doc(db, 'users', user.uid),
    { v2: pickData(useUser.getState()), updatedAt: new Date().toISOString() },
    { merge: true },
  ).catch((e) => console.error('Cloud save failed', e));
}

let authStarted = false;
export function initAuth() {
  if (authStarted) return;
  authStarted = true;
  onAuthStateChanged(auth, async (user) => {
    unsubStore?.();
    unsubStore = null;
    useAuth.setState({ user, ready: true });
    if (!user) return;
    useAuth.setState({ syncing: true });
    try {
      await pullFromCloud(user);
    } catch (e) {
      console.error('Cloud sync failed', e);
    }
    useAuth.setState({ syncing: false });
    unsubStore = useUser.subscribe((s, prev) => {
      if (s.updatedAt === prev.updatedAt) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => save(user), 800);
    });
  });
}
