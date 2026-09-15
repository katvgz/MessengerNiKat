import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { avatarToCharacter, characterToAvatar } from './avatar';

export default function useConversations(uid) {
  const [state, setState] = useState({ items: [], loading: true, error: '' });
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    const profiles = new Map();
    const people = new Map();
    const details = new Map();
    const profileErrors = new Map();
    const publish = () => {
      const items = [...people.values()].map(person => ({ ...person, ...details.get(person.id) }));
      items.sort((a, b) => (b.lastMessageAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0) - (a.lastMessageAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0) || a.id.localeCompare(b.id));
      if (active) setState({ items, loading: false, error: [...profileErrors.values()][0] || '' });
    };
    setState({ items: [], loading: !!uid, error: '' });
    if (!uid) return;
    async function start() {
      if (auth.currentUser?.uid !== uid) return;
      await auth.currentUser.getIdToken(true);
      if (!active || auth.currentUser?.uid !== uid) return;
      unsubscribe = onSnapshot(query(collection(db, 'conversations'), where('participants', 'array-contains', uid)), snapshot => {
        details.clear();
        snapshot.docs.forEach(entry => {
          const data = entry.data({ serverTimestamps: 'estimate' });
          details.set(data.participants.find(id => id !== uid), { lastMessage: data.lastMessage, lastMessageAt: data.lastMessageAt, createdAt: data.createdAt, lastSenderId: data.lastSenderId });
        });
        const current = new Map(snapshot.docs.map(entry => [entry.data().participants.find(id => id !== uid), entry.id]));
        for (const [id, stop] of profiles) if (!current.has(id)) { stop(); profiles.delete(id); people.delete(id); profileErrors.delete(id); }
        for (const [id, conversationId] of current) {
          if (profiles.has(id)) continue;
          let listening = true;
          const stop = onSnapshot(doc(db, 'publicProfiles', id), profile => {
            if (!active || !listening) return;
            if (profile.exists()) {
              profileErrors.delete(id);
              const data = profile.data();
              people.set(id, { id, conversationId, name: data.fullName, number: data.customNumber, character: avatarToCharacter(data.avatar || characterToAvatar()) });
            } else { people.delete(id); profileErrors.set(id, 'A conversation public profile is unavailable.'); }
            publish();
          }, error => {
            if (!active || !listening) return;
            console.error('Conversation profile failed', error);
            profileErrors.set(id, 'Unable to load some conversation profiles. Please refresh.'); publish();
          });
          profiles.set(id, () => { listening = false; stop(); });
        }
        publish();
      }, error => {
        console.error('Conversations failed', error);
        if (active) setState(previous => ({ ...previous, loading: false, error: error.code === 'permission-denied' ? 'Unable to load conversations. Publish the updated Firestore rules and refresh.' : 'Unable to load conversations. Check your connection and refresh.' }));
      });
    }
    void start().catch(() => { if (active) setState(previous => ({ ...previous, loading: false, error: 'Unable to connect. Please refresh.' })); });
    return () => { active = false; unsubscribe(); profiles.forEach(stop => stop()); };
  }, [uid]);
  return state;
}
