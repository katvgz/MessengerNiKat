import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Hash, Info } from 'lucide-react';
import Brand from './Brand';
import { characterToAvatar } from './avatar';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, getDocFromServer, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import CharacterCustomizer, { Character, defaultCharacter } from './Character';


export default function AuthPage({ signup, navigate, onLogin }) {
  const pending = useRef(null);
  const submitting = useRef(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [number, setNumber] = useState('');
  const [password, setPassword] = useState('');
  const [character, setCharacter] = useState(defaultCharacter);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const normalized = number;
  const valid = /^\d{6,15}$/.test(normalized);

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    if (signup && !fullName.trim()) return setError('Please enter your full name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Please enter a valid email address.');
    if (signup && !valid) return setError('Custom contact number must contain only digits and be 6-15 digits long.');
    if (signup && password.length < 8) return setError('Password must contain at least 8 characters.');
    submitting.current = true;
    setBusy(true);
    let stage = 'auth';
    try {
      if (signup) {
        if (!pending.current?.profileSaved) {
          setStatus('Checking your number...');
          const lookup = await getDocFromServer(doc(db, 'numbers', normalized));
          if (lookup.exists() && lookup.data().uid !== pending.current?.id) {
            setError('This contact number is already taken.');
            return;
          }
        }
        if (!pending.current) {
          setStatus('Creating your account...');
          const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
          pending.current = { id: user.uid, name: fullName.trim(), email: user.email || email.trim(), number: normalized, character };
        }
        const account = pending.current;
        if (!account.profileSaved) account.number = normalized;
        stage = 'profile';
        setStatus('Saving your profile...');
        if (!account.profileSaved) {
          await runTransaction(db, async transaction => {
            const numberRef = doc(db, 'numbers', account.number);
            const userRef = doc(db, 'users', account.id);
            const lookup = await transaction.get(numberRef);
            if (lookup.exists()) {
              if (lookup.data().uid === account.id) return; // Retry after an acknowledged write was interrupted.
              throw Object.assign(new Error('Number taken'), { code: 'number-taken' });
            }
            transaction.set(userRef, { fullName: account.name, email: account.email, customNumber: account.number, createdAt: serverTimestamp(), avatar: characterToAvatar(account.character) });
            transaction.set(numberRef, { uid: account.id });
            transaction.set(doc(db, 'publicProfiles', account.id), { fullName: account.name, customNumber: account.number, avatar: characterToAvatar(account.character) });
          });
          account.profileSaved = true;
        }
        stage = 'workspace';
        if (!account.verificationAttempted) {
          setStatus('Sending verification email...');
          try { await sendEmailVerification(auth.currentUser); }
          catch { account.verificationError = 'Your account was created, but the verification email could not be sent. Please use Resend verification email.'; }
          account.verificationAttempted = true;
        }
        await onLogin(account);
      } else {
        setStatus('Logging in...');
        const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
        await onLogin({ id: user.uid });
      }
    } catch (err) {
      const messages = {
        'auth/email-already-in-use': 'This email is already registered. Please use a different email address.',
        'auth/invalid-credential': 'The email or password is incorrect.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'permission-denied': 'Cannot check number availability. Please check the Firestore rules.',
        'unavailable': 'Cannot reach Firestore. Check your connection and try again.',
        'auth/weak-password': 'Please choose a stronger password with at least 8 characters.',
        'auth/password-does-not-meet-requirements': 'Please choose a stronger password that meets the Firebase password policy.',
        'auth/network-request-failed': 'Check your internet connection and try again.',
        'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
        'auth/operation-not-allowed': 'Email/password signup is not enabled in Firebase yet.',
      };
      if (err.code === 'number-taken') {
        setError('This contact number is already taken.');
      } else if (stage === 'profile') {
        setError('Your Auth account was created, but your profile could not be saved. ' +
          (err.code === 'permission-denied' ? 'Firestore permissions must allow creating your own profile. ' : 'Check your connection and Firestore setup. ') +
          'Keep this page open and select Retry signup to save your profile without creating another account.');
      } else if (stage === 'workspace') {
        setError('Your account and profile were created, but the workspace could not open. Enable browser storage and retry.');
      } else {
        setError(messages[err.code] || (signup ? 'Could not create your account. Please try again.' : 'Could not log in. Check browser storage and try again.'));
      }
    } finally {
      submitting.current = false;
      setBusy(false);
      setStatus('');
    }
  }

  return <div className="auth-page"><section className="auth-story"><button className="brand-home" onClick={() => navigate('welcome')} aria-label="Messenger Ni Kat home"><Brand /></button><div className="auth-story-copy"><span className="hero-eyebrow">A PROFILE WITH PERSONALITY</span><h1>Your world.<br />Your people.<br /><em>Your character.</em></h1><p>There’s no one quite like you.<br />Your first hello should look that way, too.</p></div><div className="auth-character"><Character value={character} portrait /></div><small>Made for connection. With a little character. ♡</small></section><section className="auth-form"><div className="auth-top"><button className="back-link" onClick={() => navigate('welcome')}><ArrowLeft size={16} /> Back home</button><span>{signup ? 'ALREADY HERE?' : 'NEW HERE?'} <button onClick={() => navigate(signup ? 'login' : 'signup')}>{signup ? 'Log in' : 'Sign up'} <ArrowUpRight size={13} /></button></span></div><div className="auth-form-inner"><span className="hero-eyebrow">{signup ? 'YOUR NEXT CHAPTER STARTS HERE' : 'YOUR PEOPLE ARE WAITING'}</span><h1>{signup ? 'Make your entrance.' : 'Good to see you again.'}</h1><p>{signup ? 'A name, a number, a little personality. That’s you.' : 'Log in and pick up right where you left off.'}</p><form onSubmit={submit}>{signup && <CharacterCustomizer value={character} onChange={setCharacter} compact />}{signup && <label>Full name<input disabled={busy || !!pending.current} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="What should we call you?" required autoComplete="name" /></label>}<label>Email<input type="email" disabled={busy || !!pending.current} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></label>{signup && <label>Custom contact number<div className="number-input"><Hash size={18} /><input disabled={busy || !!pending.current?.profileSaved} value={number} onChange={e => setNumber(e.target.value)} placeholder="Choose 6–15 digits" required pattern={signup ? "[0-9]{6,15}" : undefined} inputMode="numeric" autoComplete="username" /></div></label>}{signup && <small aria-live="polite" className={number ? valid ? 'success' : 'error' : ''}>{!number ? 'Uniquely yours. No SIM card needed.' : !valid ? 'Use 6–15 digits.' : 'We will check availability when you sign up.'}</small>}<label>Password<input type="password" disabled={busy || !!pending.current} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={signup ? 8 : undefined} required autoComplete={signup ? 'new-password' : 'current-password'} /></label>{busy && <p role="status" aria-live="polite">{status}</p>}{error && <p className="error" role="alert">{error}</p>}<button className="primary auth-submit" disabled={busy || signup && !pending.current && !valid}>{busy ? status : signup ? pending.current ? 'Retry signup' : 'Create my account' : 'Log in'} <ArrowUpRight size={18} /></button></form><div className="demo-note"><Info size={15} /><span>{signup ? 'Signup uses Firebase. Your character is saved to your profile; messaging is still a demo.' : 'Sign in with your email and password. Email verification is required.'}</span></div></div></section></div>;
}
