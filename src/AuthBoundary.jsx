import React, { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, reload, sendEmailVerification, signOut } from 'firebase/auth';
import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import Brand from './Brand';
import { avatarToCharacter, characterToAvatar } from './avatar';
import { Character, defaultCharacter } from './Character';
import AuthPage from './AuthPage';


function Frame({ children }) {
  return <div className="auth-page"><section className="auth-story"><Brand /><div className="auth-story-copy"><span className="hero-eyebrow">A PROFILE WITH PERSONALITY</span><h1>Your world.<br />Your people.<br /><em>Your character.</em></h1></div><div className="auth-character"><Character value={defaultCharacter} portrait /></div></section><section className="auth-form"><div className="auth-form-inner">{children}</div></section></div>;
}

export default function AuthBoundary({ children }) {
  const [page, setPage] = useState(location.hash.slice(1) || 'welcome');
  const [session, setSession] = useState({ loading: true, user: null, verified: null });
  const [verificationError, setVerificationError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const action = useRef(false);
  const generation = useRef(0);

  async function resolveUser(user) {
    const ticket = ++generation.current;
    setSession({ loading: true, user, verified: null });
    let current;
    try {
      if (user) await reload(user);
      if (ticket !== generation.current) return;
      current = user ? auth.currentUser : null;
      if (current && current.uid !== user.uid) return resolveUser(current);
      if (!current) {
        setSession({ loading: false, user: null, verified: null });
        return;
      }
      // Only refreshed Firebase Auth state decides whether verification is needed.
      if (current.emailVerified === false) {
        setSession({ loading: false, user: current, verified: false });
        return false;
      }
      if (current.emailVerified !== true) throw new Error('Unable to confirm email verification. Please retry.');
    } catch (err) {
      if (ticket !== generation.current) return;
      setSession({ loading: false, user, verified: null, authError: 'Unable to refresh your Firebase session. Check your connection and retry.' });
      return;
    }

    // Render the dashboard immediately. A missing profile is not an unverified email.
    const emptyProfile = { id: current.uid, name: '', email: current.email || '', number: '', character: defaultCharacter };
    setSession({ loading: false, user: current, verified: true, profile: emptyProfile, profileLoading: true });
    try {
      await current.getIdToken(true);
      if (ticket !== generation.current) return;
      const snapshot = await getDocFromServer(doc(db, 'users', current.uid));
      if (!snapshot.exists()) throw new Error('Your profile is missing. Please contact support.');
      const data = snapshot.data();
      if (!data.fullName || !data.customNumber || !data.email) throw new Error('Your saved profile is missing required details. Please contact support.');
      if (ticket !== generation.current) return;
      const profile = { id: current.uid, name: data.fullName, email: data.email, number: data.customNumber, character: data.avatar ? avatarToCharacter(data.avatar) : defaultCharacter };
      setSession({ loading: false, user: current, verified: true, profile });
      // Optional search-profile backfill must never gate account access.
      void setDoc(doc(db, 'publicProfiles', current.uid), { fullName: data.fullName, customNumber: data.customNumber, avatar: data.avatar || characterToAvatar(defaultCharacter) }).catch(() => {
        if (ticket === generation.current) setSession({ loading: false, user: current, verified: true, profile, profileError: 'Your profile loaded, but its search listing could not be updated. Check the published publicProfiles rules.' });
      });
    } catch (err) {
      if (ticket !== generation.current) return;
      setSession({ loading: false, user: current, verified: true, profile: emptyProfile, profileError: err.code === 'permission-denied' ? 'Your email is verified. Firestore denied access to your profile. Check the published users rules and retry.' : err.message || 'Unable to load your profile. Please retry.' });
    }
    return true;
  }

  useEffect(() => {
    const change = () => setPage(location.hash.slice(1) || 'welcome');
    window.addEventListener('hashchange', change);
    const unsubscribe = onAuthStateChanged(auth, user => { setError(''); void resolveUser(user); });
    return () => { generation.current++; unsubscribe(); window.removeEventListener('hashchange', change); };
  }, []);

  async function perform(resend) {
    if (action.current) return;
    action.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const user = auth.currentUser;
      if (!user) { await resolveUser(null); return; }
      if (resend) {
        await sendEmailVerification(user);
        setMessage('Verification email sent. Check your inbox and spam folder.');
      } else {
        const verified = await resolveUser(user);
        if (verified === false) setMessage('Your email is not verified yet. Click the link in your email, then try again.');
      }
    } catch (err) {
      setError(err.code === 'auth/too-many-requests' ? 'Please wait a moment before requesting another email.' : 'Unable to complete this request. Check your connection and try again.');
    } finally { action.current = false; setBusy(false); }
  }

  async function completeLogin(account) {
    setVerificationError(account?.verificationError || '');
    const resolving = resolveUser(auth.currentUser);
    location.hash = 'home';
    setPage('home');
    await resolving;
  }

  // Public forms remain mounted while signup saves the profile and sends its email.
  if (['welcome', 'signup', 'login'].includes(page)) return children({ profile: null, onLogin: completeLogin });
  if (session.loading) return <Frame><p role="status">Checking your account...</p></Frame>;
  if (session.authError) return <Frame><h1>Unable to check your session</h1><p className="error" role="alert">{session.authError}</p><button className="primary auth-submit" onClick={() => resolveUser(auth.currentUser)}>Retry</button></Frame>;
  if (!session.user) return <AuthPage signup={false} navigate={next => { location.hash = next; }} onLogin={completeLogin} />;
  if (session.verified === false) {

    return <Frame><span className="hero-eyebrow">ONE MORE STEP</span><h1>Email verification required</h1><p>Check your email at <strong>{session.user.email}</strong> and click the verification link. Then return here to continue.</p>{verificationError && !message && <p role="status">{verificationError}</p>}{message && <p role="status" aria-live="polite">{message}</p>}{error && <p className="error" role="alert">{error}</p>}<button className="primary auth-submit" disabled={busy} onClick={() => perform(false)}>{busy ? 'Please wait...' : "I've verified my email"}</button><button className="secondary modal-action" disabled={busy} onClick={() => perform(true)}>Resend verification email</button><button className="back-link" disabled={busy} onClick={async () => { try { await signOut(auth); localStorage.removeItem('loop-session'); location.hash = 'login'; } catch { setError('Unable to sign out. Please try again.'); } }}>Sign out</button></Frame>;
  }
  return <React.Fragment key={session.user.uid}>{children({ profile: session.profile, onLogin: completeLogin, profileLoading: session.profileLoading, profileError: session.profileError, retryProfile: () => resolveUser(auth.currentUser) })}</React.Fragment>;
}
