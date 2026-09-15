const fs = require('fs'), ts = require('typescript'), vm = require('vm'), assert = require('node:assert/strict');
const source = ts.transpileModule(fs.readFileSync('src/App.jsx','utf8') + '\nexport { Workspace };', { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
let slots = [], cursor = 0, opened = [];
const contact = { id: 'b', name: 'dodlet', number: '333333', character: { badge: 'heart' } };
const conversations = { items: [], loading: false, error: '' };
const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }), useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; }, useRef: initial => { const i = cursor++; return slots[i] ||= { current: initial }; }, useEffect() {} };
const helpers = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/conversations.js','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: helpers, require: () => ({}) });
const output = {};
vm.runInNewContext(source, { exports: output, location: { hash: '#contacts' }, require: name => name === 'react' ? react : name === './useConnections' ? { default: () => ({ items: [contact], loading: false, error: '' }), __esModule: true } : name === './useConversations' ? { default: () => conversations, __esModule: true } : name === './usePeopleSearch' ? { default: () => ({}), __esModule: true } : name === './conversations' ? { ...helpers, openConversation: async uid => { opened.push(uid); conversations.items = [{ ...contact, conversationId: '1:a1:b' }]; } } : name === './useSavedMessages' ? { __esModule: true, default: () => ({ items: [], ids: new Set(), loading: false, error: '' }) } : name === './messages' ? { messageTime: () => '' } : name === './firebase' ? { auth: { currentUser: { uid: 'a' } } } : {} });
const render = () => { cursor = 0; return output.Workspace({ profile: { id: 'a', name: 'Alice', number: '111111' } }); };
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...tree.children.flatMap(nodes)]; }
function find(tree, predicate) { const result = nodes(tree).find(predicate); assert.ok(result, 'Expected UI element'); return result; }
(async () => {
  let tree = render();
  await find(tree, n => n.type === 'button' && n.children.includes('Message')).props.onClick();
  tree = render();
  assert.deepEqual(opened, ['b']);
  assert.match(JSON.stringify(tree), /dodlet/);
  assert.match(JSON.stringify(tree), /333333/);
  assert.ok(find(tree, n => n.props.uid === 'a' && n.props.person?.id === 'b'));

  assert.doesNotMatch(JSON.stringify(tree), /Emma Wilson|James Miller|Sophia Chen/);
  conversations.items = [];
  for (const term of ['dodlet', '333333']) {
    find(tree, n => n.props['aria-label'] === 'Search messages or people').props.onChange({ target: { value: term } });
    tree = render();
    assert.ok(nodes(tree).some(n => n.type === 'button' && n.props.className?.startsWith('conversation ')));
    assert.match(JSON.stringify(tree), /Contact .* Start a conversation/);
  }
  console.log('PASS Contacts Message navigation, real selected profile, contact search results, removed demos, real chat component');
})().catch(error => { console.error(error); process.exitCode = 1; });
