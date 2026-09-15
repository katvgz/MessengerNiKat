import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export function conversationId(first, second) {
  return [first, second].sort().map(uid => `${uid.length}:${uid}`).join('');
}

export function searchConversationPeople(conversations, contacts, search = '') {
  const people = new Map(conversations.map(person => [person.id, person]));
  if (search.trim()) contacts.forEach(person => people.set(person.id, { ...person, ...people.get(person.id) }));
  const term = search.trim().toLowerCase();
  return [...people.values()].filter(person => `${person.name} ${person.number}`.toLowerCase().includes(term));
}

export async function openConversation(otherUid) {
  const user = auth.currentUser;
  if (!user?.emailVerified) throw new Error('Please sign in with a verified email.');
  if (!otherUid || otherUid === user.uid) throw new Error('Choose an accepted contact.');
  await user.getIdToken(true);
  const participants = [user.uid, otherUid].sort();
  // Length-prefixed IDs avoid collisions even when a UID contains underscores.
  const id = conversationId(user.uid, otherUid);
  return runTransaction(db, async transaction => {
    const contact = await transaction.get(doc(db, 'users', user.uid, 'contacts', otherUid));
    if (!contact.exists()) throw new Error('Only accepted contacts can start a conversation.');
    const ref = doc(db, 'conversations', id);
    const existing = await transaction.get(ref);
    if (!existing.exists()) transaction.set(ref, { participants, createdAt: serverTimestamp() });
    return id;
  });
}
