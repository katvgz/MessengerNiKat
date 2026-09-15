const fs = require('fs');
const ts = require('typescript');
const vm = require('vm');
const assert = require('node:assert/strict');
const source = ts.transpileModule(fs.readFileSync('src/AuthPage.jsx', 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const avatarHelpers = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/avatar.js','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: avatarHelpers });
async function check(kind) {
  let index = 0, creates = 0, writes = [], attempt = 0, logged = false, sent = 0;
  const states = ['  Test User  ', 'test@example.com', '', '00123456', 'password123', { style: 2, mood: 'amber', skin: 0, glasses: false, badge: 'moon' }, '', false];
  if (kind === 'invalid-number') states[3] = '001 23456';
  if (kind === 'short-number') states[3] = '12345';
  if (kind === 'long-number') states[3] = '1234567890123456';
  if (kind === 'missing-name') states[0] = '   ';
  if (kind === 'invalid-email') states[1] = 'invalid';
  if (kind === 'short-password') states[4] = 'short';
  const react = { createElement: (type, props, ...children) => ({ type, props, children }), useRef: value => ({ current: value }), useState: value => { const i = index++; return [states[i] ?? value, next => states[i] = next]; } };
  const sdk = {
    sendEmailVerification: async () => { sent++; },
    doc: (_, collection, id) => collection + '/' + id,
    getDocFromServer: async () => ({ exists: () => kind === 'taken', data: () => ({ uid: 'someone-else' }) }),
    createUserWithEmailAndPassword: async (_, email, password) => { creates++; assert.equal(email, 'test@example.com'); assert.equal(password, 'password123'); if (kind === 'email-taken') throw { code: 'auth/email-already-in-use' }; return { user: { uid: 'test-uid', email } }; },
    serverTimestamp: () => 'SERVER_TIME',
    runTransaction: async (_, callback) => {
      attempt++;
      if (kind === 'retry' && attempt === 1) throw { code: 'permission-denied' };
      await callback({ get: async () => ({ exists: () => kind === 'race', data: () => ({ uid: 'someone-else' }) }), set: (path, value) => writes.push([path, value]) });
    },
  };
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => name === './avatar' ? avatarHelpers : name === 'react' ? react : name.startsWith('firebase/') ? sdk : name === './firebase' ? { auth: {}, db: {} } : name === './data' ? { normalizeNumber: n => n, readStore: () => [] } : {}, });
  const tree = exports.default({ signup: true, navigate() {}, onLogin() { logged = true; } });
  function find(node) { if (!node || typeof node !== 'object') return; if (node.type === 'form') return node; for (const child of node.children || []) { const result = find(child); if (result) return result; } }
  const submit = find(tree).props.onSubmit;
  await submit({ preventDefault() {} });
  if (kind === 'taken') { assert.equal(creates, 0); assert.match(states[6], /^This contact number is already taken\.$/); }
  if (kind === 'race') { assert.equal(writes.length, 0); assert.equal(logged, false); assert.match(states[6], /^This contact number is already taken\.$/); }
  if (kind === 'retry') { assert.equal(logged, false); assert.match(states[6], /Retry signup/); await submit({ preventDefault() {} }); assert.equal(creates, 1); }
  if (kind === 'success' || kind === 'retry') { assert.equal(logged, true); assert.equal(sent, 1); assert.equal(JSON.stringify(writes), JSON.stringify([['users/test-uid', { fullName: 'Test User', email: 'test@example.com', customNumber: '00123456', createdAt: 'SERVER_TIME', avatar: { character: 2, hoodieColor: 'amber', skinTone: 0, glasses: false, badge: 'moon' } }], ['numbers/00123456', { uid: 'test-uid' }], ['publicProfiles/test-uid', { fullName: 'Test User', customNumber: '00123456', avatar: { character: 2, hoodieColor: 'amber', skinTone: 0, glasses: false, badge: 'moon' } }]])); }
  if (['invalid-number', 'short-number', 'long-number', 'missing-name', 'invalid-email', 'short-password'].includes(kind)) { assert.equal(creates, 0); assert.equal(logged, false); assert.ok(states[6]); }
  if (kind === 'email-taken') { assert.equal(writes.length, 0); assert.equal(logged, false); assert.match(states[6], /email is already registered/); }
  console.log('PASS ' + kind);
}
(async () => { for (const kind of ['success', 'taken', 'race', 'retry', 'invalid-number', 'short-number', 'long-number', 'missing-name', 'invalid-email', 'short-password', 'email-taken']) await check(kind); })().catch(error => { console.error(error); process.exitCode = 1; });
