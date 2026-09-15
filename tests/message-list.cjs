const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
let state,effect,next,error,stopped=0,target;
const sdk={collection:(_, ...parts)=>parts.join('/'),orderBy:(...args)=>args,query:(path,order)=>({path,order}),onSnapshot:(query,options,callback,fail)=>{target=query;assert.equal(options.includeMetadataChanges,true);next=callback;error=fail;return()=>stopped++;}};
const output={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/useMessages.js','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:output,require:name=>name==='react'?{useState:initial=>{state=initial;return[state,value=>{state=typeof value==='function'?value(state):value;}];},useEffect:fn=>effect=fn}:name==='firebase/firestore'?sdk:{auth:{currentUser:{uid:'a',getIdToken:async()=>''}},db:{}}});
const snapshot=(pending=false)=>({docs:[{id:'1',data:()=>({senderId:'b',text:'Persistent history',createdAt:1}),metadata:{hasPendingWrites:pending}}]});
(async()=>{
 output.default('a','chat');const cleanup=effect();await new Promise(setImmediate);
 assert.equal(target.path,'conversations/chat/messages');assert.equal(JSON.stringify(target.order),'["createdAt","asc"]');
 next(snapshot(true));assert.equal(state.items[0].pending,true);next(snapshot());assert.equal(state.items[0].pending,false);
 const stale=next;cleanup();assert.equal(stopped,1);
 output.default('a','other');const cleanupOther=effect();await new Promise(setImmediate);assert.equal(state.items.length,0);stale(snapshot());assert.equal(state.items.length,0);cleanupOther();
 output.default('a','chat');const cleanupReopen=effect();await new Promise(setImmediate);next(snapshot());assert.equal(state.items[0].text,'Persistent history');error({code:'permission-denied'});assert.match(state.error,/denied/);cleanupReopen();
 console.log('PASS ordered real-time history, pending acknowledgement, listener cleanup, stale conversation isolation, reopen/history hydration, denied read feedback');
})().catch(e=>{console.error(e);process.exitCode=1;});
