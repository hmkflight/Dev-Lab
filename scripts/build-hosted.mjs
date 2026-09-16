import { build } from 'esbuild';
import { mkdirSync, cpSync, copyFileSync, readdirSync, renameSync } from 'node:fs';
const clientEntries = readdirSync('dist');
mkdirSync('dist/client',{recursive:true});
for (const name of clientEntries) renameSync(`dist/${name}`, `dist/client/${name}`);
await build({entryPoints:['server/worker.ts'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'neutral',target:'es2022',external:['node:*'],conditions:['workerd','worker','import','default']});
mkdirSync('dist/.openai',{recursive:true});
copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
cpSync('drizzle','dist/.openai/drizzle',{recursive:true});
