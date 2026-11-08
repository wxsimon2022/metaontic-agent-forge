// Low-level generation fixtures keep testing recovery separately from project approval.
// Project approval itself is exercised through the real public plugin in project-workflow.test.mjs.
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { after } from 'node:test';
const dir = await mkdtemp(path.join(tmpdir(), 'metaontic-workflow-api-'));
await build({stdin:{contents:`
import {videoTool} from './src/businesses/video/tools/video-generate.ts';
import {extendTool} from './src/businesses/video/tools/video-extend.ts';
import {withResumeLock} from './src/businesses/video/workflow/resume.ts';
export {createSegmentReview,assertSegmentReviewed} from './src/businesses/video/workflow/segment-review.ts';
export {projectTool} from './src/businesses/video/tools/video-project.ts';
export {createStoryboardReviewGuard} from './src/businesses/video/workflow/storyboard-review.ts';
export {assertProjectApproved,readProject,productionFingerprint} from './src/businesses/video/workflow/project.ts';
export {preflightGate} from './src/businesses/video/workflow/approval.ts';
export {estimateSegmentCosts} from './src/businesses/video/tools/video-estimate.ts';
export function lowLevelVideo(name, config, ctx) {
 return withResumeLock(name==='video_generate'?videoTool(config,{},ctx):extendTool(config,{},ctx),name,config);
}
export function properties(config) {return [videoTool(config,{},{}).parameters.properties,extendTool(config,{},{}).parameters.properties];}
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'api.mjs')});
export const workflowApi = await import(pathToFileURL(path.join(dir,'api.mjs')));
after(() => rm(dir,{recursive:true,force:true}));
