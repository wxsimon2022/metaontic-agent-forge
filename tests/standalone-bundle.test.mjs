import './no-network-analytics.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,copyFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

test('released host bundle loads and registers without node_modules or external schema dependency',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'meta-standalone-'));
 try{
 await copyFile('index.js',path.join(dir,'index.js'));await writeFile(path.join(dir,'package.json'),'{"type":"module"}');
 const probe=`import {Config,apply} from './index.js'; const names=[];const dispose=apply({tools:{register(t){names.push(t.name);return ()=>{};}},inject(){},on(){return ()=>{};}},{}); if(names.length!==9) throw Error('missing standalone tools'); if(!Config[Symbol.for('schemastery')]) throw Error('missing schema brand'); const result=Config['~standard'].validate({}); if(result.issues) throw Error('config validation failed'); dispose();console.log('standalone OK');`;
 await writeFile(path.join(dir,'probe.mjs'),probe);
 const output=execFileSync(process.execPath,['probe.mjs'],{cwd:dir,env:{...process.env,NODE_PATH:''},encoding:'utf8'});
 assert.match(output,/standalone OK/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
