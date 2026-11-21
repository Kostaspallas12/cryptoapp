/* Google sign-in + Firestore sync of the user store.
   The Firebase web config is public by design (security comes from Firestore rules). */
import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc, initializeFirestore, setDoc } from 'firebase/firestore';
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
// ignoreUndefinedProperties: optional fields (e.g. a transaction without a note) must not break saving
const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error';

export const useAuth = create<{ user: User | null; ready: boolean; sync: SyncState }>(() => ({
  user: null,
  ready: false,
  sync: 'idle',
}));

export const signIn = () =>
  signInWithPopup(auth, new GoogleAuthProvider()).catch((err) => {
    if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') throw err;
  });

/** Sign out. Local data is wiped only if it is safely stored in the cloud,
    so the next person on a shared device does not see (or inherit) it. */
export async function logOut() {
  const safe = useAuth.getState().sync === 'synced';
  await signOut(auth);
  if (safe) useUser.getState().resetLocal();
}

let unsubStore: (() => void) | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function mergeById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const map = new Map(a.map((x) => [x.id, x]));
  b.forEach((x) => x && typeof x.id === 'string' && map.set(x.id, x));
  return [...map.values()];
}

async function pullFromCloud(user: User) {
  const store = useUser.getState();
  // Local data that belongs to a *different* account must never be merged into this one
  const foreign = store.owner !== null && store.owner !== user.uid;
  const local: UserData = foreign ? { watchlist: [], transactions: [], alerts: [], notes: [] } : pickData(store);

  const snap = await getDoc(doc(db, 'users', user.uid));
  let cloud: UserData = { watchlist: [], transactions: [], alerts: [], notes: [] };
  if (snap.exists()) {
    const d = snap.data();
    // First login after the redesign: convert the old cloud format
    cloud = d.v2 ? (d.v2 as UserData) : convertLegacy(d.portfolio, d.alerts);
  }

  store.replaceAll({
    watchlist: [...new Set([...arr<string>(cloud.watchlist), ...local.watchlist])].filter((x) => typeof x === 'string'),
    transactions: mergeById(local.transactions, arr(cloud.transactions)),
    alerts: mergeById(local.alerts, arr(cloud.alerts)),
    notes: mergeById(local.notes, arr(cloud.notes)),
  });
  store.setOwner(user.uid);
  await save(user);
}

async function save(user: User) {
  try {
    await setDoc(
      doc(db, 'users', user.uid),
      { v2: pickData(useUser.getState()), updatedAt: new Date().toISOString() },
      { merge: true },
    );
    if (useAuth.getState().user?.uid === user.uid) useAuth.setState({ sync: 'synced' });
  } catch (e) {
    console.error('Cloud save failed', e);
    if (useAuth.getState().user?.uid === user.uid) useAuth.setState({ sync: 'error' });
    throw e;
  }
}

let authStarted = false;
export function initAuth() {
  if (authStarted) return;
  authStarted = true;
  onAuthStateChanged(auth, async (user) => {
    unsubStore?.();
    unsubStore = null;
    clearTimeout(saveTimer);
    useAuth.setState({ user, ready: true, sync: user ? 'syncing' : 'idle' });
    if (!user) return;
    try {
      await pullFromCloud(user);
    } catch (e) {
      console.error('Cloud sync failed', e);
      useAuth.setState({ sync: 'error' });
      // Still mark ownership so this data is never merged into another account later
      if (useUser.getState().owner === null) useUser.getState().setOwner(user.uid);
    }
    unsubStore = useUser.subscribe((s, prev) => {
      if (s.updatedAt === prev.updatedAt) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => save(user).catch(() => undefined), 800);
    });
  });
}
