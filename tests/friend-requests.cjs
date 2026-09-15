const fs = require('fs'), ts = require('typescript'), vm = require('vm'), assert = require('node:assert/strict');
const source = ts.transpileModule(fs.readFileSync('src/friendRequests.js','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
async function test(kind) {
 const writes=[];
 const sdk={doc:(_,c,id)=>c+'/'+id,serverTimestamp:()=> 'TIME',runTransaction:async(_,fn)=>fn({get:async p=>({exists:()=>kind==='duplicate' && p==='friendRequests/a_b' || kind==='reverse' && p==='friendRequests/b_a'}),set:(p,d)=>writes.push([p,d])})};
 const output={}; vm.runInNewContext(source,{exports:output,require:n=>n==='firebase/firestore'?sdk:{auth:{currentUser:{uid:'a',emailVerified:kind!=='unverified'}},db:{}}});
 if(kind==='self'||kind==='unverified') await assert.rejects(output.sendFriendRequest(kind==='self'?'a':'b'));
 else {const result=await output.sendFriendRequest('b'); if(kind==='duplicate'||kind==='reverse'){assert.equal(result,'Request already sent');assert.equal(writes.length,0);} else {assert.equal(writes.length,3);assert.equal(JSON.stringify(writes[2]),JSON.stringify(['friendRequests/a_b',{fromUid:'a',toUid:'b',status:'pending',createdAt:'TIME'}]));}}
 console.log('PASS friend request '+kind);
}
(async()=>{for(const kind of ['create','duplicate','reverse','self','unverified'])await test(kind);})().catch(e=>{console.error(e);process.exitCode=1;});
