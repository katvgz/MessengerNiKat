import { collection, deleteDoc, doc, getDocFromServer, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { avatarToCharacter, characterToAvatar } from './avatar';
export const savedMessageId = (conversationId, messageId) => `${conversationId}_${messageId}`;
export async function setMessageSaved(conversationId, messageId, saved) {
  const user = auth.currentUser;
  if (!user?.emailVerified) throw new Error('Sign in with a verified email.');
  const ref = doc(db, 'users', user.uid, 'savedMessages', savedMessageId(conversationId, messageId));
  if (saved) await setDoc(ref, { conversationId, messageId, savedAt: serverTimestamp() });
  else await deleteDoc(ref);
}
export default function useSavedMessages(uid) {
  const [state, setState] = useState({ items: [], ids: new Set(), loading: false, error: '' });
  useEffect(() => {
    let active = true, version = 0, stop = () => {};
    setState({ items: [], ids: new Set(), loading: !!uid, error: '' });
    if (!uid) return;
    async function start() {
      if (auth.currentUser?.uid !== uid) return;
      await auth.currentUser.getIdToken();
      if (!active) return;
      stop = onSnapshot(collection(db, 'users', uid, 'savedMessages'), async snapshot => {
        const ticket = ++version;
        const ids = new Set(snapshot.docs.map(entry => entry.id));
        // Bookmark state must not wait for unrelated message/profile requests.
        if (active) setState(previous => ({ ...previous, ids, error: '' }));
        const results = await Promise.allSettled(snapshot.docs.map(async entry => {
          const saved = entry.data();
          const message = await getDocFromServer(doc(db, 'conversations', saved.conversationId, 'messages', saved.messageId));
          if (!message.exists()) throw new Error('Message unavailable');
          const data = message.data();
          const profile = await getDocFromServer(doc(db, 'publicProfiles', data.senderId));
          const sender = profile.exists() ? profile.data() : {};
          return { ...saved, text: data.text, senderId: data.senderId, createdAt: data.createdAt, id: entry.id,
            senderName: sender.fullName || 'Profile unavailable', senderCharacter: avatarToCharacter(sender.avatar || characterToAvatar()) };
        }));
        if (active && ticket === version) setState({ ids, items: results.map((result, index) => result.status === 'fulfilled' ? result.value : { ...snapshot.docs[index].data(), id: snapshot.docs[index].id, unavailable: true }).sort((a,b) => (b.savedAt?.toMillis?.() || 0) - (a.savedAt?.toMillis?.() || 0)), loading: false, error: '' });
      }, error => {
        version++;
        console.error('Saved messages subscription failed', error);
        if (active) setState(previous => ({ ...previous, loading: false, error: error.code === 'permission-denied' ? 'Saved messages access denied. Publish the current Firestore rules and refresh.' : 'Unable to load saved messages. Check your connection and refresh.' }));
      });
    }
    void start().catch(() => { if (active) setState(previous => ({ ...previous, loading: false, error: 'Unable to connect to saved messages.' })); });
    return () => { active = false; version++; stop(); };
  }, [uid]);
  return state;
}
