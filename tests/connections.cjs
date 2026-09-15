const fs = require('fs'), ts = require('typescript'), vm = require('vm'), assert = require('node:assert/strict');
const source = ts.transpileModule(fs.readFileSync('src/useConnections.js', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
let state, effect, next, fail, target, stopped = false, repaired = 0, release;
const token = new Promise(resolve => { release = resolve; });
const profiles = new Map([['a', { fullName: 'Alice Real', customNumber: '123456', avatar: { badge: 'heart' } }], ['c', { fullName: 'Chris Real', customNumber: '987654', avatar: { badge: 'moon' } }]]);
const sdk = {
  collection: (_, ...path) => path.join('/'), doc: (_, ...path) => path.join('/'), query: (path, filter) => ({ path, filter }), where: (field, op, value) => ({ field, value }),
  onSnapshot: (path, callback, error) => { target = path; next = callback; fail = error; return () => { stopped = true; }; },
  getDocFromServer: async path => { const data = profiles.get(path.split('/').pop()); if (data instanceof Error) throw data; return { exists: () => !!data, data: () => data }; }
};
const output = {};
vm.runInNewContext(source, { exports: output, console: { error() {} }, require: name => name === 'react' ? { useState: initial => { state = initial; return [state, value => { state = typeof value === 'function' ? value(state) : value; }]; }, useEffect: fn => { effect = fn; } } : name === 'firebase/firestore' ? sdk : name === './firebase' ? { auth: { currentUser: { uid: 'b', getIdToken: () => token } }, db: {} } : name === './friendRequests' ? { repairAcceptedContacts: async uid => { assert.equal(uid, 'b'); repaired++; } } : { avatarToCharacter: avatar => avatar, characterToAvatar: () => ({}) } });
const snapshot = entries => ({ docs: entries.map(([id, data]) => ({ id, data: () => data })) });
(async () => {
  output.default('b'); const cleanup = effect();
  assert.equal(next, undefined, 'subscription must wait for token refresh');
  release(); await new Promise(setImmediate);
  assert.equal(target, 'users/b/contacts'); assert.equal(repaired, 1);
  await next(snapshot([['a', {}], ['c', {}]]));
  assert.equal(state.items.length, 2); assert.equal(state.items[0].name, 'Alice Real'); assert.equal(state.items[0].number, '123456'); assert.equal(state.items[0].character.badge, 'heart');
  profiles.set('c', new Error('offline'));
  await next(snapshot([['a', {}], ['c', {}]]));
  assert.equal(state.items.length, 2); assert.match(state.error, /some public profiles/);
  fail({ code: 'permission-denied' }); assert.equal(state.items.length, 2); assert.match(state.error, /rules/);
  cleanup(); assert.equal(stopped, true);
  output.default('b', true); const cleanupIncoming = effect(); await new Promise(setImmediate);
  assert.equal(target.filter.field, 'toUid');
  await next(snapshot([['a_b', { fromUid: 'a', status: 'pending' }], ['c_b', { fromUid: 'c', status: 'accepted' }]]));
  assert.equal(state.items.length, 1); assert.equal(state.items[0].id, 'a');
  cleanupIncoming();
  console.log('PASS token readiness, owner contact query, real public profiles, partial failure preservation, listener errors, cleanup, pending filtering');
})().catch(error => { console.error(error); process.exitCode = 1; });

