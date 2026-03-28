/**
 * CINEMATIC SIMULATION — designed for screen recording / YouTube demo.
 * ~2-3 minutes of dramatic, VISIBLE agent activity.
 *
 * Run: npx tsx tools/scripts/simulate-cinematic.ts
 */

const BRIDGE = process.env.BRIDGE_URL ?? 'http://localhost:4700/api/collect/claude-code';
const SESSION_ID = `demo-${Date.now()}`;

const WORKERS = [
  { id: 'agent-alice',   name: 'Alice',   type: 'general-purpose', model: 'claude-opus-4-6' },
  { id: 'agent-bob',     name: 'Bob',     type: 'general-purpose', model: 'claude-sonnet-4-6' },
  { id: 'agent-carol',   name: 'Carol',   type: 'Explore',         model: 'claude-sonnet-4-6' },
  { id: 'agent-dave',    name: 'Dave',    type: 'Plan',            model: 'claude-opus-4-6' },
  { id: 'agent-eve',     name: 'Eve',     type: 'general-purpose', model: 'claude-haiku-4-5' },
  { id: 'agent-frank',   name: 'Frank',   type: 'Explore',         model: 'claude-sonnet-4-6' },
  { id: 'agent-grace',   name: 'Grace',   type: 'general-purpose', model: 'claude-opus-4-6' },
  { id: 'agent-heidi',   name: 'Heidi',   type: 'Plan',            model: 'claude-sonnet-4-6' },
  { id: 'agent-ivan',    name: 'Ivan',    type: 'general-purpose', model: 'claude-haiku-4-5' },
  { id: 'agent-judy',    name: 'Judy',    type: 'Explore',         model: 'claude-opus-4-6' },
];
const BOSS = { id: 'agent-boss', name: 'The Boss', type: 'manager', model: 'claude-opus-4-6' };

const TOOLS_CODE = ['Write', 'Edit', 'Read', 'Bash'];
const TOOLS_EXPLORE = ['Read', 'Grep', 'Glob'];
const TOOLS_PLAN = ['Read', 'Agent', 'Bash'];
const FILES = [
  'src/index.ts', 'src/server.ts', 'src/config.ts',
  'src/routes/api.ts', 'src/routes/auth.ts',
  'src/db/schema.ts', 'src/db/migrate.ts',
  'src/services/user.ts', 'src/services/billing.ts',
  'tests/api.test.ts', 'tests/auth.test.ts',
  'package.json', 'README.md', 'src/middleware/cors.ts',
];

function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
function randInt(a: number, b: number) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function send(payload: Record<string, unknown>) {
  try { await fetch(BRIDGE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: SESSION_ID, ...payload }) }); } catch {}
}

let totalCost = 0;
const agentWork = new Map<string, number>();
const MODEL_COSTS: Record<string, { i: number; o: number }> = {
  'claude-opus-4-6': { i: 15e-6, o: 75e-6 },
  'claude-sonnet-4-6': { i: 3e-6, o: 15e-6 },
  'claude-haiku-4-5': { i: 0.8e-6, o: 4e-6 },
};

async function tokens(agentId: string, model: string, pt: number, ct: number) {
  const c = MODEL_COSTS[model] ?? MODEL_COSTS['claude-sonnet-4-6'];
  totalCost += pt * c.i + ct * c.o;
  await send({ event_type: 'token_usage_updated', agent_id: agentId, payload: { prompt_tokens: pt, completion_tokens: ct, total_tokens: pt + ct, model } });
  await send({ event_type: 'cost_estimate_updated', agent_id: agentId, payload: { cost_usd: Math.round((pt * c.i + ct * c.o) * 1e4) / 1e4, cumulative_cost_usd: Math.round(totalCost * 1e4) / 1e4, model } });
}

async function msg(fromId: string, text: string) {
  await send({ hook_event_name: 'Notification', agent_id: fromId, message: text });
}

// Register a subagent with explicit parent
async function registerAgent(agent: { id: string; type: string }, parentId: string) {
  await send({
    hook_event_name: 'SubagentStart',
    agent_id: agent.id,
    agent_type: agent.type,
    parent_agent_id: parentId,
  });
  agentWork.set(agent.id, 0);
}

async function doTool(agent: typeof WORKERS[0], toolName: string, file: string) {
  await send({ hook_event_name: 'PreToolUse', agent_id: agent.id, tool_name: toolName,
    tool_input: toolName === 'Agent' ? { prompt: `Investigate ${file}`, subagent_type: 'Explore' }
      : toolName === 'Bash' ? { command: `npm test -- ${file}` } : { file_path: file } });
  await sleep(800 + Math.random() * 1200); // SLOW: 0.8-2s per tool call
  if (Math.random() < 0.06) {
    await send({ hook_event_name: 'PostToolUseFailure', agent_id: agent.id, tool_name: toolName, error: `Error: ${file}` });
    return;
  }
  await send({ hook_event_name: 'PostToolUse', agent_id: agent.id, tool_name: toolName, tool_response: { type: 'text', content: `Done` } });
  await tokens(agent.id, agent.model, randInt(300, 3500), randInt(100, 1200));
  agentWork.set(agent.id, (agentWork.get(agent.id) ?? 0) + 1);
}

function toolsFor(type: string) {
  return type === 'Explore' ? TOOLS_EXPLORE : type === 'Plan' ? TOOLS_PLAN : TOOLS_CODE;
}

function header(text: string) {
  console.log(`\n  ${'═'.repeat(50)}`);
  console.log(`  ${text}`);
  console.log(`  ${'═'.repeat(50)}\n`);
}

// Sequential tool call — one agent at a time for visibility
async function seqTool(agent: typeof WORKERS[0]) {
  const t = pick(toolsFor(agent.type));
  const f = pick(FILES);
  await doTool(agent, t, f);
  console.log(`    ${agent.name}: ${t} → ${f}`);
}

// ═══════════════════════════════════════════════════
async function act1_assemble() {
  header('ACT 1: THE TEAM ASSEMBLES');

  await send({ hook_event_name: 'SessionStart', agent_id: 'main', cwd: '/workspace/acme-saas-platform', source: 'simulation', model: 'claude-opus-4-6', permission_mode: 'auto' });
  console.log('  Project: ACME SaaS Platform\n');
  await sleep(2000);

  // Boss arrives
  await registerAgent(BOSS, 'main');
  console.log('  👔 The Boss has entered the building');
  await sleep(1500);
  await msg(BOSS.id, 'Alright team, big day today. Lets ship this!');
  await sleep(1500);

  // Agents join one by one — SLOW, 1.2s each
  for (let i = 0; i < WORKERS.length; i++) {
    const w = WORKERS[i];
    // First 4 agents report to Boss, rest to other agents (sub-agent hierarchy)
    const parent = i < 4 ? BOSS.id : WORKERS[Math.floor(i / 2)].id;
    await registerAgent(w, parent);
    const emoji = w.type === 'Explore' ? '🔍' : w.type === 'Plan' ? '📋' : '💻';
    console.log(`  ${emoji} ${w.name} joined → reports to ${i < 4 ? 'Boss' : WORKERS[Math.floor(i / 2)].name}`);
    await sleep(1200);
  }

  await sleep(1000);
  await msg(BOSS.id, 'Alice and Bob — authentication. Carol — explore codebase. Dave — plan billing.');
  await sleep(2000);
}

// ═══════════════════════════════════════════════════
async function act2_work() {
  header('ACT 2: INITIAL SPRINT');

  // Staggered work — 2-3 agents at a time so you can SEE each one move
  for (let round = 0; round < 3; round++) {
    const batch = WORKERS.slice(round * 3, round * 3 + 4);
    await Promise.all(batch.map(w => seqTool(w)));
    await sleep(1500);
  }

  // Boss reviews
  await doTool({ ...BOSS, model: BOSS.model } as typeof WORKERS[0], 'Read', 'src/routes/auth.ts');
  console.log('  👔 Boss reviewing auth implementation...');
  await sleep(2000);
  await msg(BOSS.id, 'Auth looks solid so far. Keep it up.');
  await sleep(1500);
}

// ═══════════════════════════════════════════════════
async function act3_collaborate() {
  header('ACT 3: COLLABORATION');

  // Slow conversation — each message visible
  await msg('agent-alice', 'Bob, can you review my auth middleware?');
  await sleep(1500);
  await msg('agent-bob', 'On it! You missed the refresh token flow.');
  await sleep(1500);
  await msg('agent-alice', 'Good catch. Fixing now.');
  await sleep(1200);

  await msg('agent-carol', 'Found patterns in the codebase — sharing with Dave.');
  await sleep(1200);
  await msg('agent-dave', 'Thanks Carol! Adding to the billing plan.');
  await sleep(1200);

  await msg('agent-grace', 'Eve, want to pair on user service?');
  await sleep(1000);
  await msg('agent-eve', 'Sure! Joining now.');
  await sleep(1000);

  // Some parallel work between conversations
  await Promise.all([
    seqTool(WORKERS[0]), // Alice
    seqTool(WORKERS[1]), // Bob
    seqTool(WORKERS[3]), // Dave
  ]);
  await sleep(1500);

  await Promise.all([
    seqTool(WORKERS[4]), // Eve
    seqTool(WORKERS[6]), // Grace
    seqTool(WORKERS[2]), // Carol
  ]);
  await sleep(1500);
}

// ═══════════════════════════════════════════════════
async function act4_coffee() {
  header('ACT 4: COFFEE BREAK');

  const breakers = [WORKERS[2], WORKERS[5], WORKERS[8]]; // Carol, Frank, Ivan
  console.log('  ☕ Carol, Frank, and Ivan head to the coffee shop\n');

  // Send them to idle zone — they'll move to coffee shop
  for (const w of breakers) {
    await send({ hook_event_name: 'Stop', agent_id: w.id });
    await sleep(500);
  }

  await sleep(2000); // Let them arrive at coffee shop

  await msg('agent-carol', 'This espresso is amazing');
  await sleep(2000);
  await msg('agent-frank', 'Anyone tried the cold brew?');
  await sleep(2000);
  await msg('agent-ivan', 'Ill have what Franks having');
  await sleep(3000); // Long hang at coffee shop — VISIBLE

  // Meanwhile others keep working (one at a time so visible)
  const workers = WORKERS.filter(w => !breakers.includes(w));
  for (const w of workers.slice(0, 4)) {
    await seqTool(w);
    await sleep(800);
  }

  await sleep(2000);

  // Coffee breakers return — a tool call moves them back
  console.log('\n  ☕ Coffee break over, back to work!\n');
  for (const w of breakers) {
    await seqTool(w);
    await sleep(800);
  }
  await sleep(1500);
}

// ═══════════════════════════════════════════════════
async function act5_firing() {
  header('ACT 5: PERFORMANCE REVIEW');

  await doTool({ ...BOSS, model: BOSS.model } as typeof WORKERS[0], 'Read', 'src/services/billing.ts');
  console.log('  👔 Boss reviewing everyone...');
  await sleep(3000);

  // Find worst performer
  let worstId = '', worstCount = Infinity;
  for (const [id, count] of agentWork) {
    if (id === BOSS.id) continue;
    if (count < worstCount) { worstCount = count; worstId = id; }
  }
  const worst = WORKERS.find(w => w.id === worstId)!;

  await msg(BOSS.id, 'Team, I need to address something...');
  await sleep(2000);
  await msg(BOSS.id, `${worst.name}, your output has been... disappointing.`);
  await sleep(2000);
  await msg(worst.id, 'But Boss, I was doing deep research—');
  await sleep(1500);
  await msg(BOSS.id, `${worst.name}, you're FIRED! Pack your things.`);
  await sleep(1500);

  console.log(`\n  🔥 ${worst.name.toUpperCase()} HAS BEEN FIRED! (${worstCount} tasks)\n`);

  await send({ hook_event_name: 'SubagentStop', agent_id: worst.id, last_assistant_message: 'Fired!' });
  await send({ event_type: 'agent_completed', agent_id: worst.id, payload: { result: 'Fired for underperformance', success: false } });
  agentWork.delete(worst.id);

  await sleep(2000);
  const others = WORKERS.filter(w => w.id !== worst.id && agentWork.has(w.id));
  await msg(others[0].id, 'That was harsh...');
  await sleep(1500);
  await msg(others[1].id, 'Back to work everyone... 😰');
  await sleep(2000);
}

// ═══════════════════════════════════════════════════
async function act6_crunch() {
  header('ACT 6: CRUNCH TIME');

  const active = WORKERS.filter(w => agentWork.has(w.id));
  await msg(BOSS.id, 'Deadline approaching. Push harder!');
  await sleep(1500);

  // Faster-paced work — 2-3 agents at a time
  for (let round = 0; round < 4; round++) {
    const batch = active.slice((round * 3) % active.length, (round * 3) % active.length + 3);
    await Promise.all(batch.map(w => seqTool(w)));
    // Communication under pressure
    if (round === 1) {
      await msg(pick(active).id, `${pick(active).name}, I need help NOW with ${pick(FILES)}!`);
    }
    if (round === 2) {
      await msg(BOSS.id, `Status report everyone!`);
      await sleep(1000);
      await msg(pick(active).id, 'Almost done Boss!');
    }
    await sleep(1200);
  }

  await sleep(2000);

  // Second firing
  let worstId2 = '', worstCount2 = Infinity;
  for (const [id, count] of agentWork) {
    if (id === BOSS.id) continue;
    if (count < worstCount2) { worstCount2 = count; worstId2 = id; }
  }
  const worst2 = WORKERS.find(w => w.id === worstId2)!;

  await msg(BOSS.id, `${worst2.name}... we need to talk.`);
  await sleep(2000);
  await msg(BOSS.id, `You're not cutting it. You're FIRED!`);
  await sleep(1500);
  console.log(`\n  🔥 ${worst2.name.toUpperCase()} ALSO FIRED! (${worstCount2} tasks)\n`);

  await send({ hook_event_name: 'SubagentStop', agent_id: worst2.id, last_assistant_message: 'Fired!' });
  await send({ event_type: 'agent_completed', agent_id: worst2.id, payload: { result: 'Fired', success: false } });
  agentWork.delete(worst2.id);

  await sleep(2000);
  await msg(pick(WORKERS.filter(w => agentWork.has(w.id))).id, 'Two down... we need to survive this 😱');
  await sleep(2000);
}

// ═══════════════════════════════════════════════════
async function act7_ship() {
  header('ACT 7: SHIP IT!');

  const active = WORKERS.filter(w => agentWork.has(w.id));

  // Final tasks — visible one by one
  for (const w of active) {
    await seqTool(w);
    console.log(`    ✓ ${w.name}: final commit`);
    await sleep(600);
  }

  await sleep(1500);
  await msg(BOSS.id, 'Tests passing. Deploying to production...');
  await sleep(3000);
  await msg(BOSS.id, '🚀 WE SHIPPED IT! Great work survivors!');
  await sleep(1500);

  // Celebration
  for (const w of active.slice(0, 5)) {
    await msg(w.id, pick(['🎉 Woohoo!', '🍾 Finally!', '💪 We did it!', '🙌 Ship it!', '🎊 Victory!']));
    await sleep(600);
  }
  await sleep(2000);

  // Complete everyone — agents stay in last working zone
  console.log('\n  ✅ Wrapping up...');
  for (const w of active) {
    await send({ hook_event_name: 'SubagentStop', agent_id: w.id, last_assistant_message: `${w.name} completed.` });
    console.log(`    ✓ ${w.name} done`);
    await sleep(400);
  }
  await send({ hook_event_name: 'SubagentStop', agent_id: BOSS.id, last_assistant_message: 'Project shipped.' });
  console.log('    ✓ The Boss done');

  await sleep(1000);
  await send({ hook_event_name: 'SessionEnd', agent_id: 'main', reason: 'project_shipped' });
}

// ═══════════════════════════════════════════════════
async function healthCheck() {
  const healthUrl = BRIDGE.replace(/\/api\/collect\/claude-code$/, '/api/health');
  try {
    const res = await fetch(healthUrl);
    if (!res.ok) throw new Error(`status ${res.status}`);
    console.log('  Bridge is running.\n');
  } catch (err) {
    console.error(`  ERROR: Bridge not reachable at ${healthUrl}`);
    console.error('  Start it with: npm run dev --workspace=packages/telemetry-bridge\n');
    process.exit(1);
  }
}

async function main() {
  await healthCheck();
  console.log('\n  🎬 AGENT MISSION CONTROL — CINEMATIC DEMO');
  console.log(`  Session: ${SESSION_ID}`);
  console.log('  Duration: ~2.5 minutes\n');

  await act1_assemble();   // ~18s — Team joins one by one
  await act2_work();       // ~20s — Initial sprint
  await act3_collaborate();// ~18s — Communication
  await act4_coffee();     // ~25s — Coffee break (LONG, visible)
  await act5_firing();     // ~18s — First firing
  await act6_crunch();     // ~22s — Crunch + second firing
  await act7_ship();       // ~15s — Ship it

  console.log(`\n  📊 Final Stats:`);
  console.log(`     Total cost: $${totalCost.toFixed(4)}`);
  console.log(`     Agents fired: 2`);
  console.log(`     Survivors: ${WORKERS.filter(w => agentWork.has(w.id)).length}`);
  console.log(`     Session: ${SESSION_ID}`);
  console.log('\n  🎬 CUT! That\'s a wrap!\n');
}

main().catch(console.error);
