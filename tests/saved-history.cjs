const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
let state,effect,next,stopped=false,paths=[];
const output={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/useSavedMessages.js','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:output,require:name=>name==='react'?{useState:initial=>{state=initial;return[state,value=>state=typeof value==='function'?value(state):value];},useEffect:fn=>effect=fn}:name==='./avatar'?{avatarToCharacter:value=>value,characterToAvatar:()=>({})}:name==='firebase/firestore'?{collection:(_, ...p)=>p.join('/'),doc:(_, ...p)=>p.join('/'),onSnapshot:(path,callback)=>{assert.equal(path,'users/alice/savedMessages');next=callback;return()=>stopped=true;},getDocFromServer:async path=>{paths.push(path);return{exists:()=>true,data:()=>path.startsWith('publicProfiles/')?{fullName:'Bob Real',avatar:{badge:'heart'}}:{senderId:'bob',text:'Saved real text',createdAt:123}};}}:{auth:{currentUser:{uid:'alice',getIdToken:async()=>''}},db:{}}});
(async()=>{
 output.default('alice');const cleanup=effect();await new Promise(setImmediate);
 await next({docs:[{id:'chat_m1',data:()=>({conversationId:'chat',messageId:'m1',savedAt:1})}]});
 assert.ok(state.ids.has('chat_m1'));assert.equal(state.items[0].senderName,'Bob Real');assert.equal(state.items[0].text,'Saved real text');assert.equal(state.items[0].senderCharacter.badge,'heart');
 assert.deepEqual(paths,['conversations/chat/messages/m1','publicProfiles/bob']);
 cleanup();assert.equal(stopped,true);const prior=state;await next({docs:[]});assert.equal(state,prior);
 console.log('PASS private saved subscription, source message/profile hydration, sender avatar, duplicate-save IDs, cleanup and stale results');
})().catch(e=>{console.error(e);process.exitCode=1;});
