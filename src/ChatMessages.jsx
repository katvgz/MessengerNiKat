import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Smile, Bookmark } from 'lucide-react';
import { savedMessageId, setMessageSaved } from './useSavedMessages';
import useMessages from './useMessages';
import { MAX_MESSAGE_LENGTH, messageTime, sendTextMessage } from './messages';
const EMPTY_SAVED_IDS = new Set();

export default function ChatMessages({ uid, conversationId, person, Avatar, savedIds = EMPTY_SAVED_IDS, focusMessage }) {
  const history = useMessages(uid, conversationId);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(null);
  const [savedOverrides, setSavedOverrides] = useState({});
  const [saveNotice, setSaveNotice] = useState('');
  useEffect(() => {
    setSavedOverrides(previous => {
      const pending = Object.entries(previous).filter(([id, value]) => savedIds.has(id) !== value);
      return pending.length === Object.keys(previous).length ? previous : Object.fromEntries(pending);
    });
  }, [savedIds, savedOverrides]);
  const saveLock = useRef(false);
  const focused = useRef(null);
  const lock = useRef(false);
  const area = useRef(null);
  const nearBottom = useRef(true);
  const firstLoad = useRef(true);
  const lastMessageId = useRef(null);
  useEffect(() => {
    const element = area.current;
    if (focusMessage && focused.current !== focusMessage && element) {
      const target = [...element.querySelectorAll('[data-message-id]')].find(node => node.dataset.messageId === focusMessage);
      if (target) { target.scrollIntoView({ block: 'center' }); focused.current = focusMessage; firstLoad.current = false; nearBottom.current = false; lastMessageId.current = history.items.at(-1)?.id; return; }
    }
    const last = history.items.at(-1);
    const ownNewMessage = last && last.id !== lastMessageId.current && last.senderId === uid;
    if (element && (firstLoad.current || nearBottom.current || ownNewMessage)) {
      element.scrollTop = element.scrollHeight;
      nearBottom.current = true;
    }
    if (history.items.length) firstLoad.current = false;
    lastMessageId.current = last?.id;
  }, [history.items, uid, focusMessage]);
  async function toggleSaved(message) {
    if (saveLock.current) return;
    saveLock.current = true; setSaving(message.id); setError(''); setSaveNotice('');
    const id = savedMessageId(conversationId, message.id);
    const next = !(savedOverrides[id] ?? savedIds.has(id));
    try {
      await setMessageSaved(conversationId, message.id, next);
      setSavedOverrides(previous => ({ ...previous, [id]: next }));
      setSaveNotice(next ? 'Message saved.' : 'Message unsaved.');
    }
    catch (failure) {
      console.error('Save/unsave message failed', failure);
      setError(failure.code === 'permission-denied' ? 'Saving denied. Publish the current Firestore rules and retry.' : 'Unable to update saved messages. Check your connection and retry.');
    }
    finally { saveLock.current = false; setSaving(null); }
  }
  async function send(event) {
    event.preventDefault();
    if (lock.current || !draft.trim() || !conversationId) return;
    lock.current = true; setSending(true); setError('');
    try { await sendTextMessage(conversationId, draft); setDraft(''); }
    catch (failure) { setError(failure.code === 'permission-denied' ? 'Message not sent. Publish the updated Firestore rules and retry.' : 'Message not sent. Check your connection and retry.'); }
    finally { lock.current = false; setSending(false); }
  }
  return <><div className="message-area" ref={area} onScroll={event => { const el = event.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}>
    <div className="connection-note"><span><MessageCircle size={13} /></span>You are connected on Messenger Ni Kat.</div>
    {history.loading && <p role="status">Loading messages...</p>}
    {history.error && <p className="error" role="alert">{history.error}</p>}
    {history.items.map((message, index) => {
      const mine = message.senderId === uid;
      const previous = history.items[index - 1];
      const saved = savedOverrides[savedMessageId(conversationId, message.id)] ?? savedIds.has(savedMessageId(conversationId, message.id));
      return <div key={message.id} data-message-id={message.id} className={`message-row ${mine ? 'outgoing' : ''} ${previous?.senderId === message.senderId ? 'continued' : ''}${focusMessage === message.id ? ' located-message' : ''}`}>
        {!mine && <Avatar person={person} small />}
        <div className="message-bubble"><span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.text}</span><div className="message-meta"><time title={message.createdAt?.toDate?.().toLocaleString()}>{message.pending ? 'Sending...' : messageTime(message.createdAt)}</time></div></div>
        <button type="button" className={`save-message ${saved ? 'is-saved' : ''}`} aria-pressed={saved} aria-busy={saving === message.id} aria-label={saved ? 'Unsave message' : 'Save message'} title={saved ? 'Unsave' : 'Save'} disabled={message.pending || saving !== null} onClick={() => toggleSaved(message)}><Bookmark size={14} fill={saved ? 'currentColor' : 'none'} /></button>
      </div>;
    })}
    {!history.loading && !history.error && !history.items.length && <div className="empty"><MessageCircle size={32} /><h2>No messages yet.</h2><p>Send {person.name} your first message.</p></div>}
  </div><div className="composer-wrap">
    {error && <p className="error" role="alert">{error}</p>}
    {saveNotice && <p role="status">{saveNotice}</p>}
    <form className="composer" onSubmit={send}>
      <button className="icon-button" aria-label="Add emoji" disabled type="button"><Smile size={22} /></button>
      <input aria-label="Message" placeholder="Write a message..." value={draft} maxLength={MAX_MESSAGE_LENGTH} disabled={sending || !conversationId} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} />
      <button className="send-button" type="submit" aria-label="Send message" disabled={sending || !draft.trim() || !conversationId}><Send size={19} /></button>
    </form><div className="composer-caption">A space for real conversations.<span>{sending ? 'Sending...' : 'Press Enter to send'}</span></div>
  </div></>;
}
