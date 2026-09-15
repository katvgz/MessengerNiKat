const fs = require('fs'), ts = require('typescript'), vm = require('vm'), assert = require('node:assert/strict');
const compile = file => ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
const output = {}, commits = []; let denied = false;
const sdk = { collection: (_, ...parts) => parts.join('/'), doc: (...args) => args.length === 1 ? { id: 'message-1', path: args[0] + '/message-1' } : args.slice(1).join('/'), serverTimestamp: () => 'SERVER_TIME', writeBatch: () => { const writes=[]; return { set: (ref,data) => writes.push(['set',ref,data]), update: (ref,data) => writes.push(['update',ref,data]), commit: async () => { if (denied) throw Error('denied'); commits.push(writes); } }; } };
vm.runInNewContext(compile('src/messages.js'), { exports: output, require: name => name === 'firebase/firestore' ? sdk : { auth: { currentUser: { uid: 'a', emailVerified: true } }, db: {} } });
(async () => {
  for (const text of ['', '  \n\t', 'a'.repeat(4001)]) await assert.rejects(output.sendTextMessage('chat', text));
  assert.equal(commits.length, 0);
  await output.sendTextMessage('chat', ' Hello\nworld ');
  assert.equal(commits[0][0][1].path, 'conversations/chat/messages/message-1');
  assert.equal(commits[0][0][2].senderId, 'a'); assert.equal(commits[0][0][2].text, 'Hello\nworld'); assert.equal(commits[0][0][2].createdAt, 'SERVER_TIME');
  assert.equal(commits[0][1][2].lastMessageId, 'message-1'); assert.equal(commits[0][1][2].lastMessageAt, 'SERVER_TIME');
  denied = true; await assert.rejects(output.sendTextMessage('chat', 'retry')); assert.equal(commits.length, 1);
  console.log('PASS trimmed text validation, size limit, atomic message/preview writes, server timestamps and failure propagation');
})().catch(error => { console.error(error); process.exitCode = 1; });
