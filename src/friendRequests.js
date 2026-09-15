import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { auth, db } from './firebase';

export async function respondToFriendRequest(requestId, status) {
  const user = auth.currentUser;
  if (!user?.emailVerified) throw new Error('Please sign in with a verified email.');
  if (!['accepted', 'declined'].includes(status)) throw new Error('Invalid response.');
  return runTransaction(db, async transaction => {
    const requestRef = doc(db, 'friendRequests', requestId);
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists()) throw new Error('This request no longer exists.');
    const request = snapshot.data();
    if (request.toUid !== user.uid) throw new Error('Only the recipient can respond.');
    if (request.status !== 'pending' && !(request.status === 'accepted' && status === 'accepted')) return;
    if (request.status === 'pending') transaction.update(requestRef, { status });
    if (status === 'accepted') {
      transaction.set(doc(db, 'users', request.fromUid, 'contacts', request.toUid), { uid: request.toUid, requestId });
      transaction.set(doc(db, 'users', request.toUid, 'contacts', request.fromUid), { uid: request.fromUid, requestId });
    }
  });
}

// Rebuild legacy accepted relationships without changing or deleting the request.
// Either participant can repair both deterministic contact paths.
export async function repairAcceptedContacts(uid) {
  if (auth.currentUser?.uid !== uid || !auth.currentUser.emailVerified) return;
  const results = await Promise.allSettled(['fromUid', 'toUid'].map(async field => {
    const snapshot = await getDocs(query(collection(db, 'friendRequests'), where(field, '==', uid)));
    const repairs = await Promise.allSettled(snapshot.docs.filter(entry => entry.data().status === 'accepted').map(entry =>
      runTransaction(db, async transaction => {
        const ref = doc(db, 'friendRequests', entry.id);
        const latest = await transaction.get(ref);
        if (!latest.exists()) return;
        const request = latest.data();
        if (request.status !== 'accepted' || ![request.fromUid, request.toUid].includes(uid)) return;
        transaction.set(doc(db, 'users', request.fromUid, 'contacts', request.toUid), { uid: request.toUid, requestId: entry.id });
        transaction.set(doc(db, 'users', request.toUid, 'contacts', request.fromUid), { uid: request.fromUid, requestId: entry.id });
      })
    ));
    const failure = repairs.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
  }));
  const failure = results.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
}

export async function sendFriendRequest(toUid) {
  const user = auth.currentUser;
  if (!user?.emailVerified) throw new Error('Please sign in with a verified email.');
  const fromUid = user.uid;
  if (fromUid === toUid) throw new Error('You cannot add yourself.');
  return runTransaction(db, async transaction => {
    const forward = doc(db, 'friendRequests', `${fromUid}_${toUid}`);
    const reverse = doc(db, 'friendRequests', `${toUid}_${fromUid}`);
    const sent = await transaction.get(forward);
    const received = await transaction.get(reverse);
    if (sent.exists() || received.exists()) return 'Request already sent';
    transaction.set(doc(db, 'friendRequestLocks', `${fromUid}_${toUid}`), { fromUid, toUid, requestId: `${fromUid}_${toUid}` });
    transaction.set(doc(db, 'friendRequestLocks', `${toUid}_${fromUid}`), { fromUid, toUid, requestId: `${fromUid}_${toUid}` });
    transaction.set(forward, { fromUid, toUid, status: 'pending', createdAt: serverTimestamp() });
    return 'Request sent';
  });
}
