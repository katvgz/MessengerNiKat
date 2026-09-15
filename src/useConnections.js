import { useEffect, useState } from 'react';
import { collection, doc, getDocFromServer, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { repairAcceptedContacts } from './friendRequests';
import { avatarToCharacter, characterToAvatar } from './avatar';

export default function useConnections(uid, incoming = false) {
  const [state, setState] = useState({ items: [], loading: true, error: '' });
  useEffect(() => {
    if (!uid) { setState({ items: [], loading: false, error: '' }); return; }
    let version = 0;
    let active = true;
    let unsubscribe = () => {};
    let repairError = '';
    setState({ items: [], loading: true, error: '' });
    async function start() {
      const user = auth.currentUser;
      if (user?.uid !== uid) return;
      await user.getIdToken(true);
      if (!active || auth.currentUser?.uid !== uid) return;
      const target = incoming
        ? query(collection(db, 'friendRequests'), where('toUid', '==', uid))
        : collection(db, 'users', uid, 'contacts');
      unsubscribe = onSnapshot(target, async snapshot => {
        const ticket = ++version;
        try {
          const entries = incoming ? snapshot.docs.filter(entry => entry.data().status === 'pending') : snapshot.docs;
          const results = await Promise.allSettled(entries.map(async entry => {
            const data = entry.data();
            const personUid = incoming ? data.fromUid : entry.id;
            const profile = await getDocFromServer(doc(db, 'publicProfiles', personUid));
            if (!profile.exists()) throw new Error(`Public profile missing: ${personUid}`);
            const person = profile.data();
            return { id: personUid, requestId: entry.id, name: person.fullName, number: person.customNumber, character: avatarToCharacter(person.avatar || characterToAvatar()) };
          }));
          const failed = results.some(result => result.status === 'rejected');
          results.filter(result => result.status === 'rejected').forEach(result => console.error('Public profile read failed', result.reason));
          if (active && ticket === version) setState(previous => {
            const items = results.flatMap((result, index) => result.status === 'fulfilled' ? [result.value]
              : previous.items.filter(person => person.id === (incoming ? entries[index].data().fromUid : entries[index].id)));
            return { items: [...new Map(items.map(person => [person.id, person])).values()], loading: false,
              error: failed ? 'Unable to load some public profiles. Check your connection and public profile permissions, then refresh.' : repairError };
          });
        } catch (error) { console.error('Connection profiles failed', error); if (active && ticket === version) setState(previous => ({ ...previous, loading: false, error: 'Unable to load profiles. Check your connection and public profile permissions.' })); }
      }, error => {
        version++;
        console.error(`Firestore ${incoming ? 'requests' : 'contacts'} subscription failed`, error.code, error);
        if (active) setState(previous => ({ ...previous, loading: false, error: error.code === 'permission-denied' ? 'Access denied. Publish the updated Firestore rules and refresh.' : 'Unable to load requests or contacts. Check your connection and refresh.' }));
      });
      if (!incoming) {
        try { await repairAcceptedContacts(uid); }
        catch (error) {
          console.error('Accepted contact repair failed', error.code, error);
          repairError = 'Unable to restore some accepted contacts. Check your connection and publish the updated Firestore rules, then refresh.';
          if (active) setState(previous => ({ ...previous, error: repairError }));
        }
      }
    }
    void start().catch(error => {
      console.error('Connection initialization failed', error);
      if (active) setState(previous => ({ ...previous, loading: false, error: 'Unable to refresh your connection. Please refresh the page.' }));
    });
    return () => { active = false; version++; unsubscribe(); };
  }, [uid, incoming]);
  return state;
}
