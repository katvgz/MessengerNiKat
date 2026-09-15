import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Users, Bookmark, Settings, HelpCircle, Search, SquarePen, ChevronDown, X, ArrowLeft, LogOut, Plus, ArrowUpRight, Check, Info } from 'lucide-react';
import Brand from './Brand';
import Welcome from './Welcome';
import AuthPage from './AuthPage';
import AuthBoundary from './AuthBoundary';
import usePeopleSearch from './usePeopleSearch';
import AddPersonButton from './AddPersonButton';
import IncomingRequests from './IncomingRequests';
import useConnections from './useConnections';
import useConversations from './useConversations';
import ChatMessages from './ChatMessages';
import useSavedMessages from './useSavedMessages';
import SavedMessages from './SavedMessages';
import { messageTime } from './messages';
import { openConversation, searchConversationPeople } from './conversations';
import { signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { characterToAvatar } from './avatar';
import CharacterCustomizer, { Character, defaultCharacter } from './Character';



function Avatar({ person, small = false }) {
  return <span className={`avatar ${small ? 'small' : ''}`} style={{ background: person.color || '#e6ede8' }}>{person.character ? <Character value={person.character} /> : person.photo ? <img src={`https://i.pravatar.cc/100?img=${person.photo}`} alt="" /> : person.name.split(' ').map(n => n[0]).slice(0, 2).join('')}{person.online && <i />}</span>;
}
function IconButton({ label, children, onClick, ...props }) { return <button className="icon-button" title={label} aria-label={label} onClick={onClick} {...props}>{children}</button>; }
export default function App() { return <AuthBoundary>{props => <Workspace key={props.profile?.id || 'public'} {...props} />}</AuthBoundary>; }
function Workspace({ profile, onLogin, profileLoading, profileError, retryProfile }) {
  const [page, setPage] = useState(location.hash.slice(1) || 'welcome');
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [avatarOverride, setAvatarOverride] = useState(null);
  const user = profile ? { ...profile, character: avatarOverride || profile.character } : { id: '', name: '', number: '', character: defaultCharacter };
  const [selected, setSelected] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [focusMessage, setFocusMessage] = useState(null);
  const saved = useSavedMessages(profile?.id);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [modal, setModal] = useState(null);
  const [characterDraft, setCharacterDraft] = useState(user.character || defaultCharacter);
  const [contactQuery, setContactQuery] = useState('');
  const liveContacts = useConnections(profile?.id);
  const conversations = useConversations(profile?.id);
  const [opening, setOpening] = useState(false);
  const openingLock = useRef(false);
  const [conversationError, setConversationError] = useState('');
  const modalSearch = usePeopleSearch(contactQuery, modal === 'add');
  const contactSearch = usePeopleSearch(query, page === 'contacts');
  const allPeople = [...conversations.items, ...liveContacts.items];
  const person = allPeople.find(p => p.id === selected);
  const newPeople = searchConversationPeople([], liveContacts.items, contactQuery || ' ').filter(p => p.id !== user.id);
  useEffect(() => { const handler = () => setPage(location.hash.slice(1) || 'welcome'); window.addEventListener('hashchange', handler); return () => window.removeEventListener('hashchange', handler); }, []);
  async function saveCharacter() {
    if (savingAvatar) return;
    setSavingAvatar(true); setAvatarError('');
    try {
      if (!profile || auth.currentUser?.uid !== profile.id) throw new Error('Not signed in');
      const avatar = characterToAvatar(characterDraft);
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', profile.id), { avatar });
      batch.set(doc(db, 'publicProfiles', profile.id), { fullName: profile.name, customNumber: profile.number, avatar });
      await batch.commit();
      setAvatarOverride(characterDraft); setModal(null);
    } catch (error) { setAvatarError(error.code === 'permission-denied' ? 'Avatar save was denied. Publish the updated Firestore rules, then try again.' : 'Your character could not be saved. Check your connection and try again.'); }
    finally { setSavingAvatar(false); }
  }
  function navigate(next) { location.hash = next; setPage(next); setQuery(''); }
  async function openChat(id, focus = null) {
    if (openingLock.current) return;
    if (!liveContacts.items.some(contact => contact.id === id)) { setConversationError('Only accepted contacts can start a conversation.'); return; }
    openingLock.current = true; setOpening(true); setConversationError('');
    try {
      const conversationId = await openConversation(id);
      setSelectedConversation(conversationId); setFocusMessage(focus);
      setSelected(id); setModal(null); navigate('chat');
    } catch (error) {
      setConversationError(error.code === 'permission-denied' ? 'Conversation access denied. Publish the updated Firestore rules and retry.' : error.code ? 'Unable to open the conversation. Check your connection and retry.' : error.message);
    } finally { openingLock.current = false; setOpening(false); }
  }
  const list = searchConversationPeople(conversations.items, liveContacts.items, query).filter(() => query.trim() || filter === 'All');
  if (page === 'welcome') return <Welcome navigate={navigate} />;
  if (page === 'login' || page === 'signup') return <AuthPage key={page} signup={page === 'signup'} navigate={navigate} onLogin={onLogin} />;
  return <div className={`app ${page === 'chat' && person ? 'mobile-chat' : ''}`}>
    <aside className="sidebar"><button className="brand-home" aria-label="Messenger Ni Kat home" onClick={() => navigate('welcome')}><Brand /></button><span className="workspace-label">YOUR WORKSPACE</span><nav><button className={['home', 'chat'].includes(page) ? 'active' : ''} onClick={() => navigate('home')}><MessageCircle size={20} /> Messages <span className="nav-count">{conversations.items.length}</span></button><button className={page === 'contacts' ? 'active' : ''} onClick={() => navigate('contacts')}><Users size={20} /> Contacts</button><button className={page === 'saved' ? 'active' : ''} onClick={() => navigate('saved')}><Bookmark size={20} /> Saved messages</button></nav><div className="sidebar-bottom"><div className="number-card"><span><span className="number-symbol">#</span> YOUR CONTACT NUMBER</span><strong>{user.number.replace(/(\d{3})(?=\d)/g, '$1 ')}</strong><p>A little number. A lot of connection.</p></div><button className="sidebar-link" onClick={() => setModal('settings')}><Settings size={19} /> Settings</button><button className="sidebar-link" onClick={() => setModal('help')}><HelpCircle size={19} /> Help & getting started <ArrowUpRight size={15} /></button><button className="profile" aria-label={`${user.name} profile`} onClick={() => setModal('profile')}><Avatar person={user} small /><span><strong>{user.name}</strong><small><i /> Available</small></span><ChevronDown size={17} /></button></div></aside>
    <main className="main">{conversationError && <p className="error" role="alert">{conversationError}</p>}{profileLoading && <p role="status">Loading your profile...</p>}{profileError && <div className="demo-note" role="alert">{profileError} <button className="small-button" onClick={retryProfile}>Retry profile</button></div>}<header className="topbar"><div><h1>{page === 'contacts' ? 'Contacts' : page === 'saved' ? 'Saved messages' : 'Messages'}</h1><p>{page === 'contacts' ? 'Good conversations start with a connection.' : page === 'saved' ? 'A little space for things worth keeping.' : 'A little hello can go a long way.'}</p></div><div className="top-actions"><span className="demo-badge"><span /> Personal workspace</span><button className="primary" onClick={() => { setContactQuery(''); setModal('new'); }}><Plus size={17} /> New message</button></div></header>
    {page === 'contacts' ? <section className="contacts-page"><div className="section-heading"><h2>Your people <span>{liveContacts.items.length}</span></h2><button className="primary" onClick={() => { setContactQuery(''); setModal('add'); }}><Plus size={16} /> Add contact</button></div><div className="search-box"><Search size={18} /><input aria-label="Search contacts" placeholder="Search by custom contact number" inputMode="numeric" value={query} onChange={e => setQuery(e.target.value)} /></div><div className="contact-grid">{(query ? contactSearch.person ? [contactSearch.person] : [] : liveContacts.items).map(p => <article className="contact-card" key={p.id}><Avatar person={p} /><h3>{p.name}</h3><p>#{p.number}</p>{liveContacts.items.some(contact => contact.id === p.id) ? <button className="primary" disabled={opening} onClick={() => openChat(p.id)}>Message</button> : query && <AddPersonButton key={p.id} uid={p.id} />}</article>)}</div>{query && contactSearch.message && <p className={contactSearch.error ? 'error' : 'empty'} role={contactSearch.error ? 'alert' : 'status'} aria-live="polite">{contactSearch.message}</p>}{!query && liveContacts.loading && <p role="status">Loading contacts...</p>}{liveContacts.error && <p className="error" role="alert">{liveContacts.error}</p>}{!query && !liveContacts.loading && !liveContacts.error && !liveContacts.items.length && <p className="empty">No contacts yet. Accept a friend request to connect.</p>}<IncomingRequests uid={profile?.id} /></section> : page === 'saved' ? <SavedMessages saved={saved} onOpen={item => { const contact = conversations.items.find(p => p.conversationId === item.conversationId); if (contact) void openChat(contact.id, item.messageId); else setConversationError('Conversation unavailable. Wait for conversations to load or refresh.'); }} /> : <div className="messenger"><section className="conversation-panel"><div className="conversation-heading"><h2>All conversations <span>{conversations.items.length}</span></h2><IconButton label="Start a conversation" onClick={() => { setContactQuery(''); setModal('new'); }}><SquarePen size={19} /></IconButton></div><div className="search-box"><Search size={18} /><input aria-label="Search messages or people" placeholder="Search messages or people" value={query} onChange={e => setQuery(e.target.value)} /><kbd>⌘ K</kbd></div><div className="filters">{['All', 'Unread', 'Pinned'].map(f => <button key={f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>{f}{f === 'Unread' && <span>{0}</span>}</button>)}</div><div className="conversations"><div className="list-label">{query.trim() ? 'CONVERSATIONS & CONTACTS' : 'ALL CONVERSATIONS'}</div>{conversations.loading && <p role="status">Loading conversations...</p>}{conversations.error && <p className="error" role="alert">{conversations.error}</p>}{liveContacts.error && <p className="error" role="alert">{liveContacts.error}</p>}{list.map(p => <button key={p.id} disabled={opening || !liveContacts.items.some(contact => contact.id === p.id)} className={`conversation ${selected === p.id ? 'selected' : ''}`} onClick={() => openChat(p.id)}><Avatar person={p} /><span className="conversation-text"><span className="conversation-title"><strong>{p.name}</strong><time>{messageTime(p.lastMessageAt)}</time></span><span className="preview"><span>{p.conversationId ? p.lastMessage || 'No messages yet' : `#${p.number} - Contact - Start a conversation`}</span></span></span></button>)}{!list.length && !conversations.loading && <p className="empty">No conversations found.</p>}</div><div className="list-footer"><span className="status-dot" /> You’re all caught up. Say hello!</div></section>
    <section className="chat-panel">{person ? <><header className="chat-header"><IconButton label="Back to conversations" onClick={() => navigate('home')}><ArrowLeft className="mobile-back" size={19} /></IconButton><Avatar person={person} small /><div className="chat-person"><h2>{person.name}</h2><span>#{person.number}</span></div><IconButton label="Search this chat" disabled><Search size={20} /></IconButton><span className="header-divider" /><IconButton label="Contact details" onClick={() => setModal('details')}><Info size={20} /></IconButton></header><ChatMessages key={selectedConversation} uid={user.id} conversationId={selectedConversation} person={person} Avatar={Avatar} savedIds={saved.ids} focusMessage={focusMessage} /></> : <div className="empty"><MessageCircle size={32} /><h2>Select a conversation.</h2><p>Find an accepted contact by name or number to get started.</p></div>}</section></div>}
    <footer className="app-footer"><span>Stay close, wherever you are.</span><span><span className="status-dot" /> All systems feeling good <span className="footer-dot">·</span> Messenger Ni Kat</span></footer></main>
    {modal && <div className="modal-backdrop" onClick={() => setModal(null)}><section className="modal" role="dialog" aria-modal="true" aria-label={modal} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') setModal(null); }}><IconButton label="Close dialog" onClick={() => setModal(null)}><X size={20} /></IconButton>{modal === 'new' ? <><span className="mini-logo"><Users /></span><h2>Start a conversation.</h2><p>Find an accepted contact by name or number.</p><div className="search-box"><Search size={18} /><input autoFocus placeholder="Name or contact number" value={contactQuery} onChange={e => setContactQuery(e.target.value)} /></div>{conversationError && <p className="error" role="alert">{conversationError}</p>}<div className="modal-people">{(contactQuery.trim() ? newPeople : liveContacts.items).map(p => <div key={p.id}><Avatar person={p} small /><span><strong>{p.name}</strong><small>#{p.number}</small></span><button disabled={opening} onClick={() => openChat(p.id)}>Message</button></div>)}</div>{!liveContacts.items.length && <p>No accepted contacts yet.</p>}</> : modal === 'add' ? <><span className="mini-logo"><Users /></span><h2>{modal === 'add' ? 'Find your people.' : 'Start a conversation.'}</h2><p>Search for a custom contact number.</p><div className="search-box"><Search size={18} /><input autoFocus placeholder="Custom contact number" inputMode="numeric" value={contactQuery} onChange={e => setContactQuery(e.target.value)} /></div><div className="modal-people">{modalSearch.person && <div key={modalSearch.person.id}><Avatar person={modalSearch.person} small /><span><strong>{modalSearch.person.name}</strong><small>#{modalSearch.person.number}</small></span><AddPersonButton key={modalSearch.person.id} uid={modalSearch.person.id} /></div>}</div>{modalSearch.message && <p className={modalSearch.error ? 'error' : ''} role={modalSearch.error ? 'alert' : 'status'} aria-live="polite">{modalSearch.message}</p>}</> : modal === 'character' ? <><h2>Your character. Your vibe.</h2><p>Make a little change. Make it feel like you.</p><CharacterCustomizer value={characterDraft} onChange={setCharacterDraft} /><p className="error" role="alert">{avatarError}</p><button className="primary modal-action" disabled={savingAvatar || profileLoading || !profile?.name} onClick={saveCharacter}>{savingAvatar ? 'Saving...' : 'Save character'} <Check size={16} /></button></> : modal === 'details' && person ? <><Avatar person={person} /><h2>{person.name}</h2><p>contact number: {person.number}</p><p>{'Accepted contact'}</p></> : modal === 'profile' || modal === 'settings' ? <><Avatar person={user} /><h2>{user.name}</h2><p>Your contact number: <strong>{user.number}</strong></p><div className="demo-note">Your profile and conversations are saved to your account.</div><button className="primary modal-action" onClick={() => { setCharacterDraft(user.character || defaultCharacter); setModal('character'); }}>Customize my character <SquarePen size={16} /></button><button className="secondary modal-action" onClick={() => { setModal(null); localStorage.removeItem('loop-session'); void signOut(auth); navigate('login'); }}><LogOut size={16} /> {user.id === 'me' ? 'Log in to your account' : 'Log out'}</button></> : <><span className="mini-logo"><HelpCircle /></span><h2>A little help getting started.</h2><p>1. Create an account and choose a unique 6–15 digit contact number.</p><p>2. Find people by name or number in Contacts.</p><p>3. Open a conversation with an accepted contact.</p><div className="demo-note">Contacts, conversations, and text messages are saved to your account.</div><button className="primary modal-action" onClick={() => { setModal(null); navigate('signup'); }}>Get started <ArrowUpRight size={17} /></button></>}</section></div>}
  </div>;
}




