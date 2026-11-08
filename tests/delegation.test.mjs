import assert from 'node:assert/strict';
import { test } from 'node:test';
import { api } from './module-test-api.mjs';
const registry = api.createAgentRegistry(api.agents);
function check(id, name, args = {}, header = {}, options = {}) {
  const exec = { name, arguments: args, agent: { session: { header: { agentPreset: id, ...header } }, options } };
  return api.delegationDecision(registry, {}, exec);
}
test('cloud studio can delegate only to explicitly approved specialist presets', () => {
  for (const target of ['forge-video-director', 'forge-promo-video']) assert.equal(check('forge-studio', 'delegate_agent', { agent_preset: target }), null);
  assert.equal(check('forge-studio', 'delegate_agent'), null);
  for (const target of ['forge-studio', 'unknown', 'standard', '', null, 5]) {
    assert.equal(check('forge-studio', 'delegate_agent', { agent_preset: target }).kind, 'deny');
  }
  assert.equal(check('forge-studio', 'delegate_agent', '{invalid').kind, 'deny');
});
test('general host delegation entries cannot bypass the studio whitelist or specialist restrictions', () => {
  for (const id of ['forge-studio', 'forge-video-director', 'forge-promo-video']) {
    for (const name of ['subagent', 'subagent_fork', 'subagent_codex']) assert.equal(check(id, name).kind, 'deny');
  }
  for (const id of ['forge-video-director', 'forge-promo-video']) assert.equal(check(id, 'delegate_agent').kind, 'deny');
  assert.equal(check(null, 'subagent'), null); assert.equal(check('unknown', 'subagent'), null);
  assert.equal(check('forge-video-director', 'video_generate'), null);
  assert.equal(check('forge-studio', 'send_message'), null);
});
test('persisted and runtime delegation depths cannot reset a nested studio to top-level', () => {
  assert.equal(check('forge-studio', 'delegate_agent', {}, { delegationDepth: 1 }).kind, 'deny');
  assert.equal(check('forge-studio', 'delegate_agent', {}, {}, { subagentDepth: 1 }).kind, 'deny');
  assert.equal(check('forge-studio', 'delegate_agent', {}, { delegationDepth: 1 }, { subagentDepth: 0 }).kind, 'deny');
  for (const value of [-1, -0, 0.5, NaN, '0']) assert.equal(check('forge-studio', 'delegate_agent', {}, { delegationDepth: value }).kind, 'deny');
});
test('invalid delegation topology, self calls and delegate-capable targets fail during registry construction', () => {
  const definitions = () => api.agents.map(agent => ({ ...agent, delegation: agent.delegation && { ...agent.delegation } }));
  for (const change of [
    p => { p.allowedAgents = ['forge-studio']; p.defaultAgent = 'forge-studio'; },
    p => { p.allowedAgents = ['missing']; p.defaultAgent = 'missing'; },
    p => { p.defaultAgent = 'missing'; },
    p => { p.maxDepth = 2; },
  ]) {
    const values = definitions(); change(values.find(agent => agent.id === 'forge-studio').delegation);
    assert.throws(() => api.createAgentRegistry(values), /委派/);
  }
});
