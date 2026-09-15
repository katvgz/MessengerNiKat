const fs = require('fs'), ts = require('typescript'), vm = require('vm'), assert = require('node:assert/strict');
const source = ts.transpileModule(fs.readFileSync('src/useConversations.js','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
let state, effect, queryTarget;
const listeners = new Map(), stopped = [];
const sdk = { collection: (_, ...p) => p.join('/'), doc: (_, ...p) => p.join('/'), where: (...p) => p, query: (path, filter) => ({ path, filter }), onSnapshot: (target, next, error) => { const key = typeof target === 'string' ? target : target.path; if (typeof target !== 'string') queryTarget = target; listeners.set(key, { next, error }); return () => { stopped.push(key); listeners.delete(key); }; } };
const output = {};
vm.runInNewContext(source, { exports: output, console: { error() {} }, require: name => name === 'react' ? { useState: initial => { state = initial; return [state, value => { state = typeof value === 'function' ? value(state) : value; }]; }, useEffect: fn => { effect = fn; } } : name === 'firebase/firestore' ? sdk : name === './firebase' ? { auth: { currentUser: { uid: 'a', getIdToken: async () => 'token' } }, db: {} } : { avatarToCharacter: value => value, characterToAvatar: () => ({}) } });
(async () => {
  output.default('a'); const cleanup = effect(); await new Promise(setImmediate);
  assert.equal(JSON.stringify(queryTarget.filter), JSON.stringify(['participants', 'array-contains', 'a']));
  listeners.get('conversations').next({ docs: [{ id: '1:a1:b', data: () => ({ participants: ['a', 'b'] }) }] });
  listeners.get('publicProfiles/b').next({ exists: () => true, data: () => ({ fullName: 'dodlet', customNumber: '333333', avatar: { badge: 'heart' } }) });
  assert.equal(state.items[0].name, 'dodlet'); assert.equal(state.items[0].conversationId, '1:a1:b');
  listeners.get('publicProfiles/b').next({ exists: () => true, data: () => ({ fullName: 'Updated name', customNumber: '333333', avatar: { badge: 'moon' } }) });
  assert.equal(state.items[0].name, 'Updated name'); assert.equal(state.items[0].character.badge, 'moon');
  listeners.get('conversations').next({ docs: [
    { id: '1:a1:b', data: () => ({ participants: ['a', 'b'], lastMessage: 'First', lastMessageAt: { toMillis: () => 1 } }) },
    { id: '1:a1:c', data: () => ({ participants: ['a', 'c'], lastMessage: 'Latest', lastMessageAt: { toMillis: () => 2 } }) }
  ] });
  listeners.get('publicProfiles/c').next({ exists: () => true, data: () => ({ fullName: 'Chris', customNumber: '444444', avatar: {} }) });
  assert.equal(state.items[0].id, 'c'); assert.equal(state.items[0].lastMessage, 'Latest');
  listeners.get('conversations').next({ docs: [{ id: '1:a1:b', data: () => ({ participants: ['a', 'b'], lastMessage: 'Changed preview', lastMessageAt: { toMillis: () => 3 } }) }] });
  assert.equal(state.items[0].lastMessage, 'Changed preview');
  listeners.get('conversations').error({ code: 'permission-denied' });
  assert.equal(state.items.length, 1); assert.match(state.error, /rules/);
  cleanup(); assert.ok(stopped.includes('conversations')); assert.ok(stopped.includes('publicProfiles/b'));
  output.default('a'); const cleanupRefresh = effect(); await new Promise(setImmediate);
  listeners.get('conversations').next({ docs: [{ id: '1:a1:b', data: () => ({ participants: ['a', 'b'] }) }] });
  listeners.get('publicProfiles/b').next({ exists: () => true, data: () => ({ fullName: 'dodlet', customNumber: '333333', avatar: {} }) });
  assert.equal(state.items[0].id, 'b'); cleanupRefresh();
  console.log('PASS participant query, conversation hydration after remount, live public profile updates, preserved data on read failure, listener cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; });
