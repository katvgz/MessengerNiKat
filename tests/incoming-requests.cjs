const fs = require('fs'), ts = require('typescript'), vm = require('vm'), assert = require('node:assert/strict');
const source = ts.transpileModule(fs.readFileSync('src/friendRequests.js','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
async function test(kind) {
 const writes=[];
 const request={fromUid:'a',toUid:'b',status:kind==='already'?'accepted':'pending'};
 const sdk={doc:(_, ...path)=>path.join('/'),runTransaction:async(_,fn)=>fn({get:async()=>({exists:()=>kind!=='missing',data:()=>request}),set:(p,d)=>writes.push(['set',p,d]),update:(p,d)=>writes.push(['update',p,d])})};
 const output={}; vm.runInNewContext(source,{exports:output,require:n=>n==='firebase/firestore'?sdk:{auth:{currentUser:{uid:kind==='sender'?'a':'b',emailVerified:true}},db:{}}});
 if(kind==='sender'||kind==='missing') await assert.rejects(output.respondToFriendRequest('a_b','accepted'));
 else {await output.respondToFriendRequest('a_b',kind==='decline'?'declined':'accepted'); if(kind==='already'){assert.equal(writes.length,2);assert.equal(writes[0][1],'users/a/contacts/b');assert.equal(writes[1][1],'users/b/contacts/a');} else if(kind==='decline'){assert.equal(writes.length,1);assert.equal(writes[0][2].status,'declined');}else {assert.equal(writes.length,3);assert.equal(writes[0][2].status,'accepted');assert.equal(writes[1][1],'users/a/contacts/b');assert.equal(writes[2][1],'users/b/contacts/a');}}
 console.log('PASS response '+kind);
}
(async()=>{for(const kind of ['accept','decline','already','sender','missing'])await test(kind);})().catch(e=>{console.error(e);process.exitCode=1;});


