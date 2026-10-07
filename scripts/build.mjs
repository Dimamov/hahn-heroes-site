import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist/rebuild',{recursive:true});
await build({entryPoints:['src/rebuild/main.tsx'],bundle:true,minify:true,format:'esm',target:['es2022'],outfile:'dist/rebuild/app.js',loader:{'.woff2':'file'},assetNames:'fonts/[name]-[hash]'});
await copyFile('src/rebuild/app.css','dist/rebuild/app.css');
console.log('HAHN modular rebuild compiled');
