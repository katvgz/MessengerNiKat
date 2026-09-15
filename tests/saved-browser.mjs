import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const firestore = `
const time={toDate:()=>new Date('2026-09-15T10:00:00Z'),toMillis:()=>1};
const saved=()=>JSON.parse(localStorage.getItem('test-saved')||'{}');
const listeners=new Set();
export const doc=(_, ...p)=>p.join('/'); export const collection=doc;
export const where=(...args)=>args; export const orderBy=where; export const query=(path,...filters)=>path;
export const serverTimestamp=()=>time;
const data={
 'users/a/contacts/b':{uid:'b'},
 'conversations/1:a1:b':{participants:['a','b'],createdAt:time},
 'conversations/1:a1:b/messages/own':{senderId:'a',text:'My saved message',createdAt:time},
 'conversations/1:a1:b/messages/received':{senderId:'b',text:'Hello from dodlet',createdAt:time},
 'publicProfiles/a':{fullName:'Alice',customNumber:'111111',avatar:{character:0,hoodieColor:'rose',skinTone:0,glasses:true,badge:'heart'}},
 'publicProfiles/b':{fullName:'dodlet',customNumber:'333333',avatar:{character:1,hoodieColor:'amber',skinTone:1,glasses:false,badge:'moon'}}};
function entry(path,value){return{id:path.split('/').pop(),exists:()=>value!==undefined,data:()=>value,metadata:{hasPendingWrites:false}};}
export const getDocFromServer=async path=>{if(path.includes('/messages/')&&localStorage.getItem('slow-profiles'))await new Promise(r=>setTimeout(r,300));return entry(path,data[path]);};
export const getDocs=async()=>({docs:[]});
function snapshot(path){if(path.startsWith('publicProfiles/'))return entry(path,data[path]); const all={...data,...saved()};return{docs:Object.entries(all).filter(([key])=>key.startsWith(path+'/')&&key.slice(path.length+1).split('/').length===1).map(([key,value])=>entry(key,value))};}
export function onSnapshot(path,...args){const next=args.find(v=>typeof v==='function'); const error=args.filter(v=>typeof v==='function')[1]; const emit=()=>{if(path.endsWith('savedMessages')&&localStorage.getItem('deny-saves'))error({code:'permission-denied'});else next(snapshot(path));};listeners.add(emit);queueMicrotask(emit);return()=>listeners.delete(emit);}
export async function setDoc(path,value){if(localStorage.getItem('deny-saves'))throw{code:'permission-denied'};const all=saved();all[path]=value;localStorage.setItem('test-saved',JSON.stringify(all));listeners.forEach(fn=>fn());}
export async function deleteDoc(path){const all=saved();delete all[path];localStorage.setItem('test-saved',JSON.stringify(all));listeners.forEach(fn=>fn());}
export const runTransaction=async(_,fn)=>fn({get:getDocFromServer,set(){},update(){}});
export const writeBatch=()=>({set(){},update(){},commit:async()=>{}});
`;
const server=await createServer({configFile:false,esbuild:{jsx:'transform'},server:{host:'127.0.0.1',port:5199},plugins:[{name:'saved-runtime-fixture',enforce:'pre',resolveId(id){if(id==='firebase/firestore')return '\0fixture-firestore';if(id==='./firebase')return '\0fixture-firebase';},load(id){if(id==='\0fixture-firestore')return firestore;if(id==='\0fixture-firebase')return `export const db={};export const auth={currentUser:{uid:'a',emailVerified:true,getIdToken:async()=>''}};`;},transform(code,id){if(id.replaceAll('\\','/').endsWith('/src/App.jsx'))return code+'\nexport { Workspace };';},configureServer(server){server.middlewares.use('/saved-test',(req,res)=>{res.setHeader('Content-Type','text/html');res.end(`<div id="root"></div><script type="module">import React from '/node_modules/.vite/deps/react.js';import{createRoot}from '/node_modules/.vite/deps/react-dom_client.js';import{Workspace}from '/src/App.jsx';import '/src/style.css';import '/src/theme.css';createRoot(document.getElementById('root')).render(React.createElement(Workspace,{profile:{id:'a',name:'Alice',number:'111111'}}));</script>`);});}}]});
await server.listen();const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge'});const page=await browser.newPage();const crashes=[];page.on('pageerror',e=>crashes.push(e.message));
try{
 await page.goto('http://127.0.0.1:5199/saved-test#saved');
 await page.getByText('No saved messages yet.',{exact:true}).waitFor();
 await page.reload();await page.getByText('No saved messages yet.',{exact:true}).waitFor();assert.equal(await page.locator('.sidebar').count(),1);
 await page.getByRole('button',{name:'Messages',exact:false}).first().click();
 await page.locator('button.conversation').click();
 const own=page.locator('[data-message-id="own"]');const received=page.locator('[data-message-id="received"]');
 await own.hover();await own.getByRole('button',{name:'Save message',exact:true}).click();await own.getByRole('button',{name:'Unsave message',exact:true}).waitFor();assert.equal(await own.locator('button').getAttribute('aria-pressed'),'true');
 await received.hover();await received.getByRole('button',{name:'Save message',exact:true}).click();await received.getByRole('button',{name:'Unsave message',exact:true}).waitFor();
 await page.getByRole('button',{name:'Saved messages',exact:true}).click();await page.locator('.saved-page article').nth(1).waitFor();
 assert.equal(await page.locator('.saved-page article').count(),2);await page.reload();await page.locator('.saved-page article').nth(1).waitFor();
 const original=page.locator('.saved-page article').filter({hasText:'Hello from dodlet'});await original.getByRole('button',{name:'Open conversation'}).click();await page.locator('[data-message-id="received"].located-message').waitFor();
 await page.locator('[data-message-id="received"]').getByRole('button',{name:'Unsave message',exact:true}).click();await page.locator('[data-message-id="received"]').getByRole('button',{name:'Save message',exact:true}).waitFor();
 await page.getByRole('button',{name:'Saved messages',exact:true}).click();await page.getByText('My saved message',{exact:true}).waitFor();
 await fs.mkdir('tests/artifacts',{recursive:true});await page.screenshot({path:'tests/artifacts/saved-messages.png'});
 await page.evaluate(()=>localStorage.setItem('deny-saves','1'));await page.reload();await page.getByText('Saved messages access denied.',{exact:false}).waitFor();assert.equal(await page.locator('.sidebar').count(),1);assert.deepEqual(crashes,[]);
 console.log('PASS real browser: direct #saved, refresh, sidebar navigation, both sender bookmarks, saved state, persistent fixture history, unsave, source highlighting, permission failure without crash');
}finally{await browser.close();await server.close();}

