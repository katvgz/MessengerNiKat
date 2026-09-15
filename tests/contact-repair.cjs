const fs = require('fs'), ts = require('typescript'), vm = require('vm'), assert = require('node:assert/strict');
const source = ts.transpileModule(fs.readFileSync('src/friendRequests.js', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function setup(uid, initial, denied = false) {
  const database = new Map(Object.entries(initial));
  const snapshot = (id, value) => ({ id, exists: () => !!value, data: () => value });
  const sdk = {
    doc: (_, ...path) => path.join('/'), collection: (_, path) => path,
    where: (field, op, value) => ({ field, value }), query: (path, filter) => ({ path, filter }),
    getDocs: async ({ path, filter }) => ({ docs: [...database].filter(([key, data]) => key.startsWith(path + '/') && data[filter.field] === filter.value).map(([key, data]) => snapshot(key.split('/').pop(), data)) }),
    runTransaction: async (_, fn) => {
      const writes = [];
      await fn({ get: async key => snapshot(key, database.get(key)), set: (key, data) => writes.push([key, data]), update: (key, data) => writes.push([key, { ...database.get(key), ...data }]) });
      if (denied) throw Object.assign(new Error('denied'), { code: 'permission-denied' });
      writes.forEach(([key, data]) => database.set(key, data));
    }
  };
  const output = {};
  vm.runInNewContext(source, { exports: output, require: name => name === 'firebase/firestore' ? sdk : { auth: { currentUser: { uid, emailVerified: true } }, db: {} } });
  return { database, ...output };
}
(async () => {
  for (const uid of ['a', 'b']) {
    const request = { fromUid: 'a', toUid: 'b', status: 'accepted' };
    const app = setup(uid, { 'friendRequests/a_b': request, 'users/a/contacts/b': { uid: 'b', requestId: 'a_b' } });
    await app.repairAcceptedContacts(uid);
    await app.repairAcceptedContacts(uid);
    assert.equal(app.database.size, 3);
    assert.equal(app.database.get('users/a/contacts/b').uid, 'b');
    assert.equal(app.database.get('users/b/contacts/a').uid, 'a');
    assert.equal(app.database.get('friendRequests/a_b').status, 'accepted');
  }
  const pending = setup('b', { 'friendRequests/a_b': { fromUid: 'a', toUid: 'b', status: 'pending' } }, true);
  await assert.rejects(pending.respondToFriendRequest('a_b', 'accepted'));
  assert.equal(pending.database.size, 1);
  assert.equal(pending.database.get('friendRequests/a_b').status, 'pending');
  const accepted = setup('b', { 'friendRequests/a_b': { fromUid: 'a', toUid: 'b', status: 'accepted' } }, true);
  await assert.rejects(accepted.repairAcceptedContacts('b'));
  assert.equal(accepted.database.get('friendRequests/a_b').status, 'accepted');
  for (const status of ['pending', 'declined']) {
    const app = setup('b', { 'friendRequests/a_b': { fromUid: 'a', toUid: 'b', status } });
    await app.repairAcceptedContacts('b');
    assert.equal(app.database.size, 1);
  }
  const outsider = setup('c', { 'friendRequests/a_b': { fromUid: 'a', toUid: 'b', status: 'accepted' } });
  await outsider.repairAcceptedContacts('c');
  assert.equal(outsider.database.size, 1);
  console.log('PASS bilateral repair from either account, repeated repair without duplicates, failed accept/repair preservation, pending/declined/outsider excluded');
})().catch(error => { console.error(error); process.exitCode = 1; });
