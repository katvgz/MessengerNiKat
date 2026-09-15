import React, { useRef, useState } from 'react';
import { Bookmark, X } from 'lucide-react';
import { Character } from './Character';
import { setMessageSaved } from './useSavedMessages';
export default function SavedMessages({ saved, onOpen }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const lock = useRef(false);
  async function remove(item) {
    if (lock.current) return;
    lock.current = true; setBusy(item.id); setError('');
    try { await setMessageSaved(item.conversationId, item.messageId, false); }
    catch { setError('Unable to unsave this message. Please retry.'); }
    finally { lock.current = false; setBusy(null); }
  }
  return <section className="saved-page">
    {saved.loading && <p role="status">Loading saved messages...</p>}
    {(saved.error || error) && <p className="error" role="alert">{saved.error || error}</p>}
    {saved.items.map(item => <article key={item.id}>{!item.unavailable && <span className="avatar small" aria-label={`${item.senderName} avatar`}><Character value={item.senderCharacter} /></span>}<div>
      {item.unavailable ? <p>Original message unavailable. Check your connection and refresh.</p> : <><small>{item.senderName} · {item.createdAt?.toDate?.().toLocaleString()}</small><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.text}</p><button className="small-button" onClick={() => onOpen(item)}>Open conversation</button></>}
    </div><button aria-label="Unsave message" title="Unsave" disabled={busy !== null} onClick={() => remove(item)}><X size={17} /></button></article>)}
    {!saved.loading && !saved.error && !saved.items.length && <div className="empty"><Bookmark size={34} /><h2>Keep the good stuff.</h2><p>No saved messages yet.</p></div>}
  </section>;
}

