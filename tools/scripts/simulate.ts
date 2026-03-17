/**
 * Rich 10-agent simulation with a Manager, coffee breaks, communication, and firing.
 * Run: npx tsx tools/scripts/simulate.ts [--fast]
 */

const BRIDGE = 'http://localhost:4700/api/collect/claude-code';
const SESSION_ID = `sim-${Date.now()}`;
const isFast = process.argv.includes('--fast');

const WORKERS = [
  { id: 'agent-alpha', name: 'Alpha', type: 'general-purpose' },
  { id: 'agent-bravo', name: 'Bravo', type: 'general-purpose' },
  { id: 'agent-charlie', name: 'Charlie', type: 'Explore' },
  { id: 'agent-delta', name: 'Delta', type: 'Plan' },
  { id: 'agent-echo', name: 'Echo', type: 'general-purpose' },
  { id: 'agent-foxtrot', name: 'Foxtrot', type: 'Explore' },
  { id: 'agent-golf', name: 'Golf', type: 'general-purpose' },
  { id: 'agent-hotel', name: 'Hotel', type: 'Plan' },
  { id: 'agent-india', name: 'India', type: 'general-purpose' },
  { id: 'agent-juliet', name: 'Juliet', type: 'Explore' },
];
const MANAGER = { id: 'agent-boss', name: 'The Boss', type: 'manager' };

const TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'Agent'];
const MODELS = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'];
const FILES = [
  'src/index.ts', 'src/server.ts', 'src/config.ts', 'src/utils.ts',
  'src/routes/api.ts', 'src/routes/auth.ts', 'src/db/schema.ts',
  'src/db/migrate.ts', 'src/services/user.ts', 'src/services/billing.ts',
  'tests/api.test.ts', 'tests/auth.test.ts', 'package.json', 'README.md',
];
const MESSAGES = [
  'Can you review my changes to {file}?',
  'Found a bug in {file}, looking into it',
  'Hey {target}, I need help with {file}',
  'Pushed a fix for the auth issue in {file}',
  'The tests in {file} are passing now',
  '{target}, can you pair on this refactor?',
  'Coffee break anyone?',
  'Just deployed the changes to staging',
  'PR is ready for review: {file}',
  'Blocked on {file} — need API access',
];

function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
function randInt(a: number, b: number) { return Math.floor(Math.random() * (b - a + 1)) + a; }
const delay = (base: number, v: number) => isFast ? Math.max(30, base / 8) : base + Math.random() * v;
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function send(payload: Record<string, unknown>) {
  try { await fetch(BRIDGE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: SESSION_ID, ...payload }) }); } catch {}
}

let totalCostUsd = 0;
const agentToolCounts = new Map<string, number>();
const MODEL_COSTS: Record<string, { i: number; o: number }> = {
  'claude-opus-4-6': { i: 15e-6, o: 75e-6 },
  'claude-sonnet-4-6': { i: 3e-6, o: 15e-6 },
  'claude-haiku-4-5': { i: 0.8e-6, o: 4e-6 },
};

async function emitTokens(agentId: string, model: string, pt: number, ct: number) {
  const c = MODEL_COSTS[model] ?? MODEL_COSTS['claude-sonnet-4-6'];
  totalCostUsd += pt * c.i + ct * c.o;
  await send({ event_type: 'token_usage_updated', agent_id: agentId, payload: { prompt_tokens: pt, completion_tokens: ct, total_tokens: pt + ct, model } });
  await send({ event_type: 'cost_estimate_updated', agent_id: agentId, payload: { cost_usd: Math.round((pt * c.i + ct * c.o) * 1e4) / 1e4, cumulative_cost_usd: Math.round(totalCostUsd * 1e4) / 1e4, model } });
}

async function sendMessage(fromId: string, msg: string) {
  await send({ hook_event_name: 'Notification', agent_id: fromId, message: msg });
}

// --- Phases ---

async function startSession() {
  console.log(`\n  🎬 Starting simulation: ${SESSION_ID}`);
  console.log(`  Mode: ${isFast ? 'fast' : 'real-time'}\n`);
  await send({ hook_event_name: 'SessionStart', agent_id: 'main', cwd: '/workspace/acme-project', source: 'simulation', model: 'claude-opus-4-6', permission_mode: 'auto' });
}

async function registerAll() {
  // Register manager first
  await send({ hook_event_name: 'SubagentStart', agent_id: MANAGER.id, agent_type: MANAGER.type });
  console.log(`  👔 ${MANAGER.name} (manager) joined`);
  await sleep(delay(200, 100));

  // Register workers
  for (const w of WORKERS) {
    await send({ hook_event_name: 'SubagentStart', agent_id: w.id, agent_type: w.type });
    agentToolCounts.set(w.id, 0);
    console.log(`  🧑‍💻 ${w.name} (${w.type}) joined`);
    await sleep(delay(150, 100));
  }
}

async function toolCall(agent: typeof WORKERS[0], tool: string, file: string, model: string) {
  await send({
    hook_event_name: 'PreToolUse', agent_id: agent.id, tool_name: tool,
    tool_input: tool === 'Agent' ? { prompt: `Investigate ${file}`, subagent_type: 'Explore' }
      : tool === 'Bash' ? { command: `npm test -- ${file}` } : { file_path: file },
  });
  await sleep(delay(300, 500));

  // Occasionally fail
  if (Math.random() < 0.08) {
    await send({ hook_event_name: 'PostToolUseFailure', agent_id: agent.id, tool_name: tool, error: `Permission denied: ${file}` });
    return;
  }

  await send({ hook_event_name: 'PostToolUse', agent_id: agent.id, tool_name: tool, tool_response: { type: 'text', content: `Done: ${tool} ${file}` } });
  await emitTokens(agent.id, model, randInt(200, 4000), randInt(50, 1500));
  agentToolCounts.set(agent.id, (agentToolCounts.get(agent.id) ?? 0) + 1);
}

async function coffeeBreak(agent: typeof WORKERS[0]) {
  console.log(`    ☕ ${agent.name} taking a coffee break`);
  // Send idle event (moves agent to coffee shop)
  await send({ hook_event_name: 'Stop', agent_id: agent.id });
  await sleep(delay(2000, 1500));
  // Resume working — next tool call will move them back
}

async function communicate(agent: typeof WORKERS[0]) {
  const target = pick(WORKERS.filter(w => w.id !== agent.id));
  const file = pick(FILES);
  const msg = pick(MESSAGES).replace('{target}', target.name).replace('{file}', file);
  await sendMessage(agent.id, msg);
  console.log(`    💬 ${agent.name} → "${msg.slice(0, 50)}"`);
  await sleep(delay(200, 200));
}

async function agentWork(agent: typeof WORKERS[0], rounds: number) {
  const model = pick(MODELS);
  for (let i = 0; i < rounds; i++) {
    // 15% chance of coffee break mid-work
    if (i > 2 && Math.random() < 0.15) {
      await coffeeBreak(agent);
    }

    const tool = pick(TOOLS);
    const file = pick(FILES);
    await toolCall(agent, tool, file, model);
    console.log(`    ${agent.name}: ${tool} → ${file} (${i + 1}/${rounds})`);

    await sleep(delay(200, 400));

    // 40% chance of communicating with someone
    if (Math.random() < 0.4) {
      await communicate(agent);
    }
  }
}

async function managerWork() {
  const model = 'claude-opus-4-6';
  // Manager periodically checks on agents and reviews
  for (let i = 0; i < 6; i++) {
    await sleep(delay(3000, 2000));

    // Manager reviews code
    const file = pick(FILES);
    await send({ hook_event_name: 'PreToolUse', agent_id: MANAGER.id, tool_name: 'Read', tool_input: { file_path: file } });
    await sleep(delay(500, 300));
    await send({ hook_event_name: 'PostToolUse', agent_id: MANAGER.id, tool_name: 'Read', tool_response: { type: 'text', content: `Reviewing ${file}` } });
    await emitTokens(MANAGER.id, model, randInt(500, 2000), randInt(200, 800));
    console.log(`  👔 Boss reviewing ${file}`);

    // Manager sends status update
    const worker = pick(WORKERS);
    await sendMessage(MANAGER.id, `${worker.name}, status update on your current task?`);
    console.log(`  👔 Boss → ${worker.name}: status check`);

    await sleep(delay(500, 300));
    // Worker responds
    await sendMessage(worker.id, `Working on it Boss, almost done!`);
  }
}

async function fireWorstAgent() {
  // Find agent with fewest tool calls
  let worstId = '';
  let worstCount = Infinity;
  for (const [id, count] of agentToolCounts) {
    if (count < worstCount) { worstCount = count; worstId = id; }
  }
  const worst = WORKERS.find(w => w.id === worstId);
  if (!worst) return;

  console.log(`\n  🔥 THE BOSS IS FIRING ${worst.name.toUpperCase()}! (only ${worstCount} tool calls)\n`);

  // Boss announces
  await sendMessage(MANAGER.id, `${worst.name}, you're FIRED! Pack your things!`);
  await sleep(delay(1000, 500));

  // Other agents react
  const bystander = pick(WORKERS.filter(w => w.id !== worst.id));
  await sendMessage(bystander.id, `Oh no, poor ${worst.name}... RIP 😢`);
  await sleep(delay(500, 300));

  // Fire the agent — success: false marks them as fired
  await send({
    hook_event_name: 'SubagentStop', agent_id: worst.id,
    last_assistant_message: `${worst.name} has been fired for underperformance!`,
  });

  // Override with direct event to mark as failed completion
  await send({
    event_type: 'agent_completed', agent_id: worst.id,
    payload: { result: 'Fired for underperformance', success: false },
  });

  // Remove from active workers
  agentToolCounts.delete(worst.id);

  await sleep(delay(800, 400));

  // Morale boost from others
  const survivor = pick(WORKERS.filter(w => w.id !== worst.id));
  await sendMessage(survivor.id, `Back to work everyone... 😰`);
}

async function completeRemaining() {
  console.log('\n  ✅ Completing remaining agents...');
  for (const w of WORKERS) {
    if (!agentToolCounts.has(w.id)) continue; // already fired
    await send({ hook_event_name: 'SubagentStop', agent_id: w.id, last_assistant_message: `${w.name} completed all tasks.` });
    console.log(`    ✓ ${w.name} done`);
    await sleep(delay(200, 100));
  }
  // Manager completes last
  await send({ hook_event_name: 'SubagentStop', agent_id: MANAGER.id, last_assistant_message: 'All tasks supervised.' });
  console.log(`    ✓ ${MANAGER.name} done`);
}

async function endSession() {
  await send({ hook_event_name: 'SessionEnd', agent_id: 'main', reason: 'simulation_complete' });
  console.log(`\n  📊 Total cost: $${totalCostUsd.toFixed(4)}`);
  console.log(`  🎬 Session: ${SESSION_ID}\n`);
}

// --- Main ---

async function main() {
  await startSession();
  await sleep(delay(500, 200));
  await registerAll();
  await sleep(delay(500, 200));

  console.log('\n  🚀 Agents working... (watch the dashboard!)\n');

  // Run workers and manager in parallel
  const workerTasks = WORKERS.map(w => agentWork(w, randInt(8, 15)));
  const managerTask = managerWork();

  await Promise.all([...workerTasks, managerTask]);

  // Boss fires the worst performer
  await fireWorstAgent();

  // Let remaining agents do a bit more work
  console.log('\n  💪 Remaining agents working harder...\n');
  const activeWorkers = WORKERS.filter(w => agentToolCounts.has(w.id));
  await Promise.all(activeWorkers.map(w => agentWork(w, randInt(3, 6))));

  // Final push — everyone does one last task (ensures they end in working zone)
  console.log('\n  🏁 Final tasks...\n');
  await Promise.all(activeWorkers.map(async (w) => {
    await toolCall(w, pick(TOOLS), pick(FILES), pick(MODELS));
    console.log(`    ${w.name}: final commit`);
  }));
  await sendMessage(MANAGER.id, 'Great work team! Wrapping up.');

  await sleep(delay(500, 200));
  await completeRemaining();
  await sleep(delay(300, 200));
  await endSession();
  console.log('  🎉 Simulation complete!\n');
}

main().catch(console.error);
