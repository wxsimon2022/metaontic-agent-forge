import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/client/agent-picker.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {createAgentPickerView,registerAgentPicker}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const h=(type,props)=>({type,props});
test('picker filters only platform specialists, preserves current state and native callbacks',()=>{
 for(const [hook,field] of [['useAgentPresetSeat','options'],['useAgentPresetSection','rows']]){
 const rows=['standard','metaontic-agent-forge-studio','metaontic-agent-forge-video-director','metaontic-agent-forge-promo-video','other-plugin'].map(id=>({id}));
 const state={[field]:rows,current:'metaontic-agent-forge-video-director',loading:false};
 const callback=()=>{};const Original=()=>{};
 const View=createAgentPickerView(h,Original,hook,field);
 const tree=View({[hook]:select=>select(state),select:callback});
 const projected=tree.props[hook](s=>s);
 assert.equal(tree.type,Original);assert.equal(tree.props.select,callback);
 assert.deepEqual(projected[field].map(r=>r.id),['standard','metaontic-agent-forge-studio','other-plugin']);
 assert.equal(projected.current,state.current);assert.equal(state[field].length,5);
 assert.equal(tree.props[hook](s=>s),projected);
 }
});
test('slot adapter handles late native registration and restores originals on unload',()=>{
 const entries=new Map(),listeners=new Map(),cleanups=[];
 const emit=name=>{for(const fn of listeners.get(name)||[])fn();};
 const slots={entries:name=>entries.get(name)||[],entriesOfSlot:name=>(entries.get(name)||[]).slice().sort((a,b)=>(a.options.priority||0)-(b.options.priority||0)).slice(0,1),subscribe(name,fn){const list=listeners.get(name)||new Set();list.add(fn);listeners.set(name,list);return()=>list.delete(fn);},inject:(name,fn)=>fn(),register(spec,component){const entry={options:spec,component,inject:spec.inject,locale:spec.locale};entries.set(spec.name,[...(entries.get(spec.name)||[]),entry]);emit(spec.name);return()=>{entries.set(spec.name,entries.get(spec.name).filter(e=>e!==entry));emit(spec.name);};}};
 registerAgentPicker({slots,effect(fn){const cleanup=fn();if(cleanup)cleanups.push(cleanup);}},h);
 const injected=()=>({});const Original=()=>{};
 const remove=slots.register({name:'conversation.hero.agentPreset',inject:injected,locale:'native'},Original);
 let list=slots.entries('conversation.hero.agentPreset');assert.equal(list.length,2);
 const wrapper=list.find(e=>e.component!==Original);emit('conversation.hero.agentPreset');emit('conversation.hero.agentPreset');assert.equal(slots.entries('conversation.hero.agentPreset').length,2);assert.equal(wrapper.inject,injected);assert.equal(wrapper.locale,'native');assert.equal(wrapper.options.priority,-1);
 remove();assert.equal(slots.entries('conversation.hero.agentPreset').length,0);
 slots.register({name:'conversation.hero.agentPreset',inject:injected},Original);
 for(const cleanup of cleanups)cleanup();
 assert.equal(slots.entriesOfSlot('conversation.hero.agentPreset').length,1);
});
test('session hook is platform scoped in the shipped browser bundle',async()=>{
 const {readFile}=await import('node:fs/promises');const source=await readFile('client.js','utf8');
 assert.match(source,/metaonticAgentForgeVideoExecutions/);assert.doesNotMatch(source,/hooks:\s*\["videoExecutions"\]/);
});
