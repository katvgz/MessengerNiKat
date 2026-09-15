import React, { useRef, useState } from 'react';
import { Character } from './Character';
import useConnections from './useConnections';
import { respondToFriendRequest } from './friendRequests';

function RequestCard({ person }) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  async function respond(status) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await respondToFriendRequest(person.requestId, status); setDone(status === 'accepted' ? 'Request accepted' : 'Request declined'); }
    catch (err) { setError(err.code === 'permission-denied' ? 'Response denied. Publish the updated Firestore rules and retry.' : err.code ? 'Unable to respond. Check your connection and retry.' : err.message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <article className="contact-card"><span className="avatar"><Character value={person.character} /></span><h3>{person.name}</h3><p>{person.number ? `#${person.number}` : 'Public profile unavailable'}</p><button disabled={busy || !!done} onClick={() => respond('accepted')}>{busy ? 'Saving...' : 'Accept'}</button><button disabled={busy || !!done} onClick={() => respond('declined')}>Decline</button>{error && <p className="error" role="alert">{error}</p>}{done && <p role="status">{done}</p>}</article>;
}

export default function IncomingRequests({ uid }) {
  const { items, loading, error } = useConnections(uid, true);
  return <section aria-label="Incoming friend requests"><div className="section-heading"><h2>Incoming requests <span>{items.length}</span></h2></div>{loading && <p role="status">Loading incoming requests...</p>}{error && <p className="error" role="alert">{error}</p>}{!loading && !error && !items.length && <p className="empty">No incoming requests.</p>}<div className="contact-grid">{items.map(person => <RequestCard key={person.requestId} person={person} />)}</div></section>;
}
