import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';

export const MAX_MESSAGE_LENGTH = 4000;
export async function sendTextMessage(conversationId, value) {
  const user = auth.currentUser;
  if (!user?.emailVerified) throw new Error('Please sign in with a verified email.');
  const text = value.trim();
  if (!text || text.length > MAX_MESSAGE_LENGTH) throw new Error('Enter a message between 1 and 4000 characters.');
  if (!conversationId) throw new Error('Open a conversation first.');
  const parent = doc(db, 'conversations', conversationId);
  const message = doc(collection(db, 'conversations', conversationId, 'messages'));
  const batch = writeBatch(db);
  batch.set(message, { senderId: user.uid, text, createdAt: serverTimestamp() });
  batch.update(parent, { lastMessage: text, lastMessageAt: serverTimestamp(), lastSenderId: user.uid, lastMessageId: message.id });
  await batch.commit();
  return message.id;
}

export function messageTime(timestamp) {
  return timestamp?.toDate ? timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}
