/** Import real source exports through esbuild; no dependency on bundle names or formatting. */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { after } from 'node:test';
const dir = await mkdtemp(path.join(tmpdir(), 'metaontic-module-test-'));
await build({ stdin: { contents: `
export * from './src/client/progress.ts';
export * from './src/client/tool-result.ts';
export * from './src/client/settings-actions.ts';
export * from './src/client/state.ts';
export * from './src/client/updates.ts';
export * from './src/workflow/planning.ts';
export {resolveResolution} from './src/config.ts';
export {isOmniExtendModel} from './src/providers/connection.ts';
export * from './src/workflow/result-state.ts';
export * from './src/workflow/duration-choice.ts';
export {segmentContinueLine} from './src/workflow/approval.ts';
export {validateImageRoles} from './src/media/references.ts';
export {withVideoExecution,withGenerationProgress} from './src/workflow/execution.ts';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', outfile: path.join(dir, 'api.mjs') });
export const api = await import(pathToFileURL(path.join(dir, 'api.mjs')).href);
after(() => rm(dir, { recursive: true, force: true }));
