const fs = require('fs'), ts = require('typescript'), vm = require('vm'), assert = require('node:assert/strict');
const source = ts.transpileModule(fs.readFileSync('src/AuthBoundary.jsx','utf8'), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const avatarHelpers = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/avatar.js','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: avatarHelpers });
let cursor = 0, slots = [], effects = [], listener, sent = 0, reloaded = 0, stored, syncFails = false, readFails = false, refreshVerified = false, missingProfile = false;
const user = { uid: 'uid', email: 'test@example.com', emailVerified: false, getIdToken: async () => 'token' };
const auth = { currentUser: user };
const react = { createElement: (type, props, ...children) => ({ type, props, children }), useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => slots[i] = value]; }, useRef: initial => { const i = cursor++; return slots[i] ||= { current: initial }; }, useEffect: fn => { const i = cursor++; if (!slots[i]) { slots[i] = true; effects.push(fn); } } };
const sdk = { setDoc: async () => { if (syncFails) throw { code: 'permission-denied' }; }, onAuthStateChanged: (_, fn) => { listener = fn; return () => {}; }, reload: async () => { reloaded++; if (refreshVerified) auth.currentUser = { ...user, emailVerified: true }; }, sendEmailVerification: async () => { sent++; }, signOut: async () => {}, doc: () => '', getDocFromServer: async () => { if (readFails) throw { code: 'permission-denied' }; return ({ exists: () => !missingProfile, data: () => ({ fullName: 'Test', email: user.email, customNumber: '123456', avatar: { character: 1, hoodieColor: 'lavender', skinTone: 2, glasses: true, badge: 'heart' } }) }); } };
const output = {};
vm.runInNewContext(source, { exports: output, location: { hash: '#home' }, window: { addEventListener() {}, removeEventListener() {} }, require: n => n === './avatar' ? avatarHelpers : n === 'react' ? react : n.startsWith('firebase/') ? sdk : n === './firebase' ? { auth, db: {} } : n === './data' ? { readStore: () => { throw new Error('Profile must not use localStorage'); }, saveStore: (_, value) => stored = value } : {} });
const render = () => { cursor = 0; return output.default({ children: ({ profile, profileError }) => { stored = profile; return 'WORKSPACE ' + (profileError || ''); } }); };
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
function button(node, label) { if (!node || typeof node !== 'object') return; if (node.type === 'button' && node.children.includes(label)) return node; for (const child of node.children || []) { const match = button(child, label); if (match) return match; } }
(async () => {
  assert.match(JSON.stringify(render()), /Checking your account/); effects.forEach(fn => fn());
  listener(user); await flush();
  let tree = render(); assert.match(JSON.stringify(tree), /Email verification required/); assert.ok(!JSON.stringify(tree).includes('WORKSPACE'));
  await button(tree, 'Resend verification email').props.onClick(); assert.equal(sent, 1);
  await button(render(), "I've verified my email").props.onClick(); assert.match(JSON.stringify(render()), /not verified yet/);
  user.emailVerified = true;
  await button(render(), "I've verified my email").props.onClick(); await flush();
  assert.ok(JSON.stringify(render()).includes('WORKSPACE')); assert.equal(stored.id, 'uid'); assert.equal(stored.name, 'Test'); assert.equal(stored.number, '123456'); assert.equal(JSON.stringify(stored.character), JSON.stringify({ style: 1, mood: 'lavender', skin: 2, glasses: true, badge: 'heart' })); assert.ok(reloaded >= 3);
  syncFails = true; listener(user); await flush(); assert.match(JSON.stringify(render()), /WORKSPACE/); assert.match(JSON.stringify(render()), /search listing/);
  readFails = true; listener(user); await flush(); assert.match(JSON.stringify(render()), /WORKSPACE/); assert.match(JSON.stringify(render()), /Firestore denied/); assert.ok(!JSON.stringify(render()).includes('Email verification required'));
  readFails = false; syncFails = false; missingProfile = true; listener(user); await flush(); assert.match(JSON.stringify(render()), /WORKSPACE/); assert.match(JSON.stringify(render()), /profile is missing/); assert.ok(!JSON.stringify(render()).includes('Email verification required'));
  missingProfile = false;
  // Simulate a fresh page mounting with a verified Firebase session and denied profile reads.
  user.emailVerified = true; readFails = true; slots = []; effects = []; render(); effects.forEach(fn => fn()); listener(user); await flush(); assert.match(JSON.stringify(render()), /WORKSPACE/); assert.match(JSON.stringify(render()), /Firestore denied/);
  readFails = false; syncFails = false; user.emailVerified = false; refreshVerified = true; listener(user); await flush(); assert.match(JSON.stringify(render()), /WORKSPACE/);
  listener(null); await flush(); assert.ok(!JSON.stringify(render()).includes('WORKSPACE'));
  console.log('PASS verification refresh, resend, verified access, denied profile read/write, missing profile, page refresh, signed-out gate');
})().catch(err => { console.error(err); process.exitCode = 1; });
