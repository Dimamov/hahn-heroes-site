// Copies only the public website files into dist-site/ for Cloudflare to serve.
// Everything not listed here (server/, src/, tests/, scripts/, notes) stays private.
import {rm,mkdir,cp} from 'node:fs/promises';
const out='dist-site';
const publish=['index.html','about.html','episodes.html','episodes.json','style.css','about.css','site.css','site.js','analytics.js','creator-contact.js','robots.txt','_headers','assets','rebuild','_nexus-test'];
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const p of publish) await cp(p,`${out}/${p}`,{recursive:true});
console.log('Staged',publish.length,'entries into',out);
