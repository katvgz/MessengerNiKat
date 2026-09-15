import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth, db } from './firebase';

export default function useMessages(uid, conversationId) {
  const [state, setState] = useState({ conversationId: null, items: [], loading: false, error: '' });
  useEffect(() => {
    let active = true;
    let stop = () => {};
    setState({ conversationId, items: [], loading: !!conversationId, error: '' });
    if (!uid || !conversationId) return;
    async function start() {
      const user = auth.currentUser;
      if (user?.uid !== uid) return;
      await user.getIdToken();
      if (!active || auth.currentUser?.uid !== uid) return;
      stop = onSnapshot(query(collection(db, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc')), { includeMetadataChanges: true }, snapshot => {
        if (active) setState({ conversationId, items: snapshot.docs.map(entry => ({ id: entry.id, ...entry.data({ serverTimestamps: 'estimate' }), pending: entry.metadata.hasPendingWrites })), loading: false, error: '' });
      }, error => {
        if (active) setState(previous => ({ ...previous, loading: false, error: error.code === 'permission-denied' ? 'Message access denied. Publish the updated Firestore rules and refresh.' : 'Unable to load messages. Check your connection and reopen the conversation.' }));
      });
    }
    void start().catch(() => { if (active) setState({ conversationId, items: [], loading: false, error: 'Unable to connect. Reopen the conversation to retry.' }); });
    return () => { active = false; stop(); };
  }, [uid, conversationId]);
  return state.conversationId === conversationId ? state : { items: [], loading: !!conversationId, error: '' };
}
