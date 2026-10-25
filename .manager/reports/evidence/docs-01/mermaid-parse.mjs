import { JSDOM } from '/tmp/relay-docs-parser/node_modules/jsdom/lib/api.js';
const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window=dom.window; globalThis.document=dom.window.document;
const { default: mermaid } = await import('/tmp/relay-docs-01-npm-cache/_npx/fa58c8ce4c502b5d/node_modules/mermaid/dist/mermaid.esm.mjs');
import { readFileSync } from 'node:fs';
mermaid.initialize({startOnLoad:false, securityLevel:'loose'});
for(let i=1;i<=3;i++) {
 try { console.log(`Bloc ${i}:`, await mermaid.parse(readFileSync(`/tmp/relay-docs-mermaid/architecture-${i}.mmd`,'utf8'))); }
 catch(e) { console.error(`Bloc ${i}:`, e.message); process.exitCode=1; }
}
