import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCatVK6xTHI50em8eZ2_Inwpt0n_VZGUaY',
  authDomain: 'messenger-ni-kat.firebaseapp.com',
  projectId: 'messenger-ni-kat',
  messagingSenderId: '619671784185',
  appId: '1:619671784185:web:4e799d57dcbd6e70d3f028',
  measurementId: 'G-4RHSW1HYNW',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

