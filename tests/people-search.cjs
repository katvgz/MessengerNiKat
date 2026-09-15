const fs = require('fs'), ts = require('typescript'), vm = require('vm'), assert = require('node:assert/strict');
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const avatar = {}; vm.runInNewContext(compile('src/avatar.js'), { exports: avatar });
async function test(kind) {
  const paths = [];
  const user = { uid: 'me', emailVerified: kind !== 'unverified' };
  const sdk = { doc: (_, collection, id) => collection + '/' + id, getDocFromServer: async path => {
    paths.push(path);
    if (kind === 'permission') throw { code: 'permission-denied' };
    if (kind === 'network') throw { code: 'unavailable' };
    return path.startsWith('numbers/') ? { exists: () => kind !== 'missing', data: () => ({ uid: kind === 'self' ? 'me' : 'other' }) } : { exists: () => kind !== 'missing-profile', data: () => ({ fullName: 'Other User', customNumber: '00123456', avatar: { character: 2, hoodieColor: 'amber', skinTone: 0, glasses: false, badge: 'none' } }) };
  } };
  const output = {};
  vm.runInNewContext(compile('src/usePeopleSearch.js'), { exports: output, require: n => n === 'firebase/firestore' ? sdk : n === './firebase' ? { auth: { currentUser: user }, db: {} } : n === './avatar' ? avatar : {} });
  if (['self', 'invalid', 'unverified', 'permission', 'network'].includes(kind)) {
    await assert.rejects(output.findPersonByNumber(kind === 'invalid' ? '001 23456' : '00123456'));
    if (kind === 'self') assert.deepEqual(paths, ['numbers/00123456']);
    if (kind === 'invalid' || kind === 'unverified') assert.equal(paths.length, 0);
  } else {
    const result = await output.findPersonByNumber('00123456');
    if (kind.startsWith('missing')) assert.equal(result, null);
    else { assert.equal(result.name, 'Other User'); assert.equal(result.number, '00123456'); assert.equal(JSON.stringify(result.character), JSON.stringify({ style: 2, mood: 'amber', skin: 0, glasses: false, badge: 'none' })); assert.deepEqual(paths, ['numbers/00123456', 'publicProfiles/other']); }
  }
  console.log('PASS ' + kind);
}
(async () => { for (const kind of ['found', 'missing', 'missing-profile', 'self', 'invalid', 'unverified', 'permission', 'network']) await test(kind); })().catch(e => { console.error(e); process.exitCode = 1; });
