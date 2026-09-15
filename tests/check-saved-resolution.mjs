import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
const server = await createServer({ server: { middlewareMode: true } });
try {
 console.log(await server.pluginContainer.resolveId('./SavedMessages', process.cwd() + '/src/App.jsx'));
 const module = await server.ssrLoadModule('/src/SavedMessages');
 console.log(renderToString(React.createElement(module.default,{saved:{items:[],loading:false,error:''}})));
} catch(error) { console.log('REPRODUCED:',error.message); }
finally { await server.close(); }
