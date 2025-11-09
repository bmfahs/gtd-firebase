import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyAnVPp7U4LhvFrKxAyKVfjXEN-_Q0NXaEo",
  authDomain: "personal-gtd-ea76d.firebaseapp.com",
  projectId: "personal-gtd-ea76d",
  storageBucket: "personal-gtd-ea76d.firebasestorage.app",
  messagingSenderId: "912329138271",
  appId: "1:912329138271:web:62fa2363334bce1d9bfbea"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, 'gtd-database');
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Multiple tabs open, persistence enabled in first tab only');
  } else if (err.code === 'unimplemented') {
    console.warn('Browser does not support offline persistence');
  }
});

export default app;
