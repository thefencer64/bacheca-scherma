import { initializeApp } from 'firebase/app';
import { getAuth }       from 'firebase/auth';
import { getFirestore }  from 'firebase/firestore';
import { getStorage }    from 'firebase/storage';
import { getFunctions }  from 'firebase/functions';

const firebaseConfig = {
  apiKey:            "AIzaSyBjd134sxeVtQrTJ1_OcQqN7hafR4hLc30",
  authDomain:        "fcbachecascherma.firebaseapp.com",
  projectId:         "fcbachecascherma",
  storageBucket:     "fcbachecascherma.firebasestorage.app",
  messagingSenderId: "628298751185",
  appId:             "1:628298751185:web:62a7645daac9a1ea30b9f0",
};

const app              = initializeApp(firebaseConfig);
export const auth      = getAuth(app);
export const db        = getFirestore(app);
export const storage   = getStorage(app);
export const functions = getFunctions(app, 'europe-west1');
