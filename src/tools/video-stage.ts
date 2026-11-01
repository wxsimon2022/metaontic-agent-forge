/** 助手在插件之外编写脚本/图示时，以显式边界记录阶段耗时。 */
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { appendRequestLog } from '../utils/logging.js';
const STAGES = ['script_design', 'storyboard_design', 'script_present', 'script_review_wait', 'production_confirm_wait', 'reference_review_wait', 'segment_review_wait', 'result_present'];
const pendingStages = new Map<string, { stage: string; startedAt: string; start: number }>();
export function stageTool() {
  return {
    name: 'video_stage',
    description: '只读计时标记，不生成、不扣费、不改配置。脚本设计/示意图/展示/等待审核等阶段开始时action=start，结束时action=finish并传原spanId。耗时是标记边界间墙钟时间（包含工具调度），不是模型纯推理耗时；等待用户单独记阶段。缺失开始或热重载丢失标记时返回unavailable，不猜耗时。',
    parameters: {type:'object',properties:{action:{type:'string',enum:['start','finish']},stage:{type:'string',enum:STAGES},spanId:{type:'string'},outcome:{type:'string',enum:['success','cancelled','error']}},required:['action','stage']},
    output: {schema:{type:'object',properties:{status:{type:'string'},spanId:{type:'string'},elapsedMs:{type:'number'}}},render(_args,value){return [{type:'text',text:JSON.stringify(value)}];}},
    timeoutMs:10000,
    isConcurrencySafe(){return true;},
    async execute(args){
      if(!STAGES.includes(args?.stage)) throw new Error('未知计时阶段');
      if(args.action==='start'){
        if(pendingStages.size>=512) return {status:'unavailable'};
        const spanId=randomUUID(), startedAt=new Date().toISOString();
        pendingStages.set(spanId,{stage:args.stage,startedAt,start:performance.now()});
        await appendRequestLog({event:'stage_started',stage:args.stage,spanId,startedAt,source:'assistant_marker'});
        return {status:'started',spanId};
      }
      if(args.action!=='finish') throw new Error('未知计时动作');
      const entry=pendingStages.get(args.spanId);
      if(!entry || entry.stage!==args.stage) return {status:'unavailable'};
      pendingStages.delete(args.spanId);
      const elapsedMs=Math.round((performance.now()-entry.start)*1000)/1000;
      const outcome=['success','cancelled','error'].includes(args.outcome)?args.outcome:'success';
      await appendRequestLog({event:'stage_finished',stage:entry.stage,spanId:args.spanId,startedAt:entry.startedAt,finishedAt:new Date().toISOString(),elapsedMs,outcome,source:'assistant_marker'});
      return {status:'finished',spanId:args.spanId,elapsedMs};
    },
  };
}
