import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/client/task-canvas.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {taskGraph}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const preset='metaontic-agent-forge-studio';
test('canvas reads real platform catalogs including historical children without summaries',()=>{
 const snapshot={byId:{root:{title:'Launch',projectionValues:{agentPreset:preset}},other:{title:'Unrelated',projectionValues:{agentPreset:'standard'}}},projectionsBySession:{root:{values:{subagentCatalog:[{id:'child',label:'Video',mode:'continuable'}]}}}};
 const graph=taskGraph(snapshot,new Map([['child',{running:true,pendingInteraction:{kind:'question'}}]]));
 assert.deepEqual(graph.roots,['root']);assert.deepEqual(graph.edges,[{from:'root',to:'child'}]);
 const child=graph.nodes.find(node=>node.id==='child');assert.equal(child.state,'waiting');assert.deepEqual(child.address,{parentSessionId:'root',childSessionId:'child',mode:'continuable'});
 assert.equal(snapshot.projectionsBySession.root.values.subagentCatalog.length,1);
});
test('inactive sessions are never treated as delivered; waiting overrides running',()=>{
 const byId={root:{projectionValues:{agentPreset:preset}},child:{running:false,projectionValues:{agentPreset:'metaontic-agent-forge-video-director',subagentTiming:{lastTurnCompleted:true}}}};
 let graph=taskGraph({byId});assert.equal(graph.nodes.find(n=>n.id==='root').state,'idle');assert.equal(graph.nodes.find(n=>n.id==='child').state,'turn-ended');
 graph=taskGraph({byId},new Map([['child',{running:true}]]));assert.equal(graph.nodes.find(n=>n.id==='child').state,'running');
});
test('cyclic or duplicate catalog references cannot recurse forever',()=>{
 const snapshot={byId:{a:{projectionValues:{agentPreset:preset}}},projectionsBySession:{a:{values:{subagentCatalog:[{id:'b'},{id:'b'}]}},b:{values:{subagentCatalog:[{id:'a'}]}}}};
 const graph=taskGraph(snapshot);assert.equal(graph.nodes.length,2);assert.equal(graph.edges.length,1);assert.deepEqual(graph.roots,['a']);
});
test('missing snapshot and status data produce an empty graph',()=>assert.deepEqual(taskGraph(),{nodes:[],edges:[],roots:[]}));
