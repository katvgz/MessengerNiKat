const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
const compile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
const records=new Map(),auth={currentUser:{uid:'alice',emailVerified:true}},actions={};
vm.runInNewContext(compile('src/useSavedMessages.js'),{exports:actions,require:name=>name==='firebase/firestore'?{doc:(_, ...p)=>p.join('/'),serverTimestamp:()=>1,setDoc:async(path,data)=>records.set(path,data),deleteDoc:async path=>records.delete(path)}:name==='./firebase'?{auth,db:{}}:{}});
(async()=>{
 await actions.setMessageSaved('chat','message',true);await actions.setMessageSaved('chat','message',true);assert.equal(records.size,1);
 auth.currentUser.uid='bob';await actions.setMessageSaved('chat','message',true);assert.equal(records.size,2);await actions.setMessageSaved('chat','message',false);assert.equal(records.size,1);assert.ok(records.has('users/alice/savedMessages/chat_message'));
 const ui={},item={id:'chat_message',conversationId:'chat',messageId:'message',senderName:'Alice',senderCharacter:{badge:'heart'},text:'Keep this',createdAt:{toDate:()=>({toLocaleString:()=> 'Original timestamp'})}};let opened;
 const react={createElement:(type,props,...children)=>({type,props:props||{},children}),useState:value=>[value,()=>{}],useRef:value=>({current:value})};
 vm.runInNewContext(compile('src/SavedMessages.jsx'),{exports:ui,require:name=>name==='react'?react:name==='./useSavedMessages'?actions:{}});
 const tree=ui.default({saved:{items:[item]},onOpen:value=>opened=value});
 const nodes=t=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(nodes):[t,...t.children.flatMap(nodes)];
 assert.ok(nodes(tree).some(n=>n.props['aria-label']==='Alice avatar'));assert.ok(nodes(tree).some(n=>n.props.value===item.senderCharacter));assert.match(JSON.stringify(tree),/Keep this/);assert.match(JSON.stringify(tree),/Original timestamp/);
 nodes(tree).find(n=>n.type==='button'&&n.children.includes('Open conversation')).props.onClick();assert.equal(opened.messageId,'message');
 auth.currentUser.uid='alice';await nodes(tree).find(n=>n.props['aria-label']==='Unsave message').props.onClick();assert.equal(records.size,0);
 console.log('PASS duplicate-free per-user saves, independent unsave, saved sender avatar/name/text/timestamp and Open conversation');
})().catch(e=>{console.error(e);process.exitCode=1;});
