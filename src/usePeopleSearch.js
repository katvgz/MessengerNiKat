import { useEffect, useState } from 'react';
import { doc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from './firebase';
import { avatarToCharacter } from './avatar';

export async function findPersonByNumber(number) {
  const user = auth.currentUser;
  if (!user?.emailVerified) throw new Error('Please sign in with a verified email to search for people.');
  if (!/^[0-9]{6,15}$/.test(number)) throw new Error('Enter a custom contact number with 6-15 digits only.');
  const lookup = await getDocFromServer(doc(db, 'numbers', number));
  if (!lookup.exists()) return null;
  const uid = lookup.data().uid;
  if (uid === user.uid) throw new Error('You cannot add yourself.');
  if (typeof uid !== 'string' || !uid || uid.includes('/')) throw new Error('This user lookup is unavailable. Please try again later.');
  const profile = await getDocFromServer(doc(db, 'publicProfiles', uid));
  if (!profile.exists()) return null;
  const data = profile.data();
  if (data.customNumber !== number) throw new Error('This user lookup is unavailable. Please try again later.');
  return { id: uid, name: data.fullName, number: data.customNumber, character: data.avatar ? avatarToCharacter(data.avatar) : undefined };
}

export default function usePeopleSearch(query, enabled) {
  const [result, setResult] = useState({ query: '', person: null, loading: false, error: '' });
  useEffect(() => {
    if (!enabled || !query) return;
    let active = true;
    setResult({ query, person: null, loading: true, error: '' });
    const timer = setTimeout(async () => {
      try {
        const person = await findPersonByNumber(query);
        if (active) setResult({ query, person, loading: false, error: '' });
      } catch (error) {
        const message = error.code === 'permission-denied' ? 'Search is not permitted. Please check the Firestore profile-read rules.'
          : error.code === 'unavailable' ? 'Unable to reach Firestore. Check your connection and try again.'
          : error.code ? 'Unable to search right now. Please try again.' : error.message;
        if (active) setResult({ query, person: null, loading: false, error: message });
      }
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [query, enabled]);
  if (!enabled || !query) return { person: null, loading: false, error: '', message: 'Enter a custom contact number to find someone.' };
  if (result.query !== query || result.loading) return { person: null, loading: true, error: '', message: 'Searching...' };
  return { ...result, message: result.error || (!result.person ? 'User not found.' : '') };
}
