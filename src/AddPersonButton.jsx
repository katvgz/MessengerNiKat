import React, { useRef, useState } from 'react';
import { sendFriendRequest } from './friendRequests';

export default function AddPersonButton({ uid }) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  async function add() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { setStatus(await sendFriendRequest(uid)); }
    catch (err) { setError(err.code === 'permission-denied' ? 'Request denied. Check the published Firestore rules.' : err.code ? 'Unable to send request. Check your connection and try again.' : err.message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <span><button className="small-button" disabled={busy || !!status} onClick={add}>{busy ? 'Sending...' : status || 'Add'}</button>{error && <small className="error" role="alert">{error}</small>}{status && <small role="status">{status}</small>}</span>;
}
