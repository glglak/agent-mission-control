/**
 * SCRUM SPRINT SIMULATION — Full sprint with ceremonies.
 * Sprint Planning → Task Distribution → Daily Work → Standup →
 * Code Review → QA Testing → Retro → Human Interaction points.
 *
 * Run: npx tsx tools/scripts/simulate-scrum.ts
 */

const BRIDGE = 'http://localhost:4700/api/collect/claude-code';
const SESSION_ID = `sprint-${Date.now()}`;

// === TEAM (Scrum roles) ===
const SCRUM_MASTER = { id: 'agent-sm', name: 'Sam (SM)', type: 'Plan', model: 'claude-opus-4-6' };
const PRODUCT_OWNER = { id: 'agent-po', name: 'Priya (PO)', type: 'Plan', model: 'claude-opus-4-6' };
const DEVS = [
  { id: 'agent-dev1', name: 'Alice', type: 'general-purpose', model: 'claude-opus-4-6' },
  { id: 'agent-dev2', name: 'Bob', type: 'general-purpose', model: 'claude-sonnet-4-6' },
  { id: 'agent-dev3', name: 'Carol', type: 'Explore', model: 'claude-sonnet-4-6' },
  { id: 'agent-dev4', name: 'Dave', type: 'general-purpose', model: 'claude-haiku-4-5' },
];
const QA = [
  { id: 'agent-qa1', name: 'Eve (QA)', type: 'general-purpose', model: 'claude-sonnet-4-6' },
  { id: 'agent-qa2', name: 'Frank (QA)', type: 'Explore', model: 'claude-haiku-4-5' },
];
const ALL = [SCRUM_MASTER, PRODUCT_OWNER, ...DEVS, ...QA];

// === SPRINT BACKLOG ===
const STORIES = [
  { id: 'US-101', title: 'User login with JWT auth', points: 5, assignee: 'agent-dev1', files: ['src/routes/auth.ts','src/middleware/jwt.ts'] },
  { id: 'US-102', title: 'Password reset flow', points: 3, assignee: 'agent-dev2', files: ['src/routes/auth.ts','src/services/email.ts'] },
  { id: 'US-103', title: 'User profile CRUD', points: 3, assignee: 'agent-dev3', files: ['src/routes/users.ts','src/db/schema.ts'] },
  { id: 'US-104', title: 'API rate limiting', points: 2, assignee: 'agent-dev4', files: ['src/middleware/rate-limit.ts','src/config.ts'] },
  { id: 'US-105', title: 'E2E auth test suite', points: 3, assignee: 'agent-qa1', files: ['tests/auth.e2e.ts','tests/helpers.ts'] },
  { id: 'US-106', title: 'Integration test for users', points: 2, assignee: 'agent-qa2', files: ['tests/users.test.ts','tests/fixtures.ts'] },
];
const SPRINT_GOAL = 'Deliver auth system MVP with login, password reset, profiles, and rate limiting';
const storyStatus = new Map<string, 'backlog'|'in_progress'|'review'|'done'>();
STORIES.forEach(s => storyStatus.set(s.id, 'backlog'));

// === HELPERS ===
function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
function randInt(a: number, b: number) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function send(payload: Record<string, unknown>) {
  try { await fetch(BRIDGE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: SESSION_ID, ...payload }) }); } catch {}
}

let totalCost = 0;
const MC: Record<string, { i: number; o: number }> = {
  'claude-opus-4-6': { i: 15e-6, o: 75e-6 },
  'claude-sonnet-4-6': { i: 3e-6, o: 15e-6 },
  'claude-haiku-4-5': { i: 0.8e-6, o: 4e-6 },
};

async function tokens(agentId: string, model: string) {
  const pt = randInt(300, 3000), ct = randInt(100, 1000);
  const c = MC[model] ?? MC['claude-sonnet-4-6'];
  totalCost += pt * c.i + ct * c.o;
  await send({ event_type: 'token_usage_updated', agent_id: agentId, payload: { prompt_tokens: pt, completion_tokens: ct, total_tokens: pt + ct, model } });
  await send({ event_type: 'cost_estimate_updated', agent_id: agentId, payload: { cost_usd: Math.round((pt * c.i + ct * c.o) * 1e4) / 1e4, cumulative_cost_usd: Math.round(totalCost * 1e4) / 1e4, model } });
}

async function msg(fromId: string, text: string) {
  await send({ hook_event_name: 'Notification', agent_id: fromId, message: text });
}

async function doTool(agentId: string, model: string, tool: string, file: string) {
  await send({ hook_event_name: 'PreToolUse', agent_id: agentId, tool_name: tool,
    tool_input: tool === 'Bash' ? { command: `npm test -- ${file}` } : { file_path: file } });
  await sleep(800 + Math.random() * 1000);
  await send({ hook_event_name: 'PostToolUse', agent_id: agentId, tool_name: tool, tool_response: { type: 'text', content: `Done: ${tool} ${file}` } });
  await tokens(agentId, model);
}

async function assignTask(story: typeof STORIES[0]) {
  storyStatus.set(story.id, 'in_progress');
  await send({ event_type: 'task_assigned', agent_id: story.assignee, payload: {
    task_id: story.id, description: story.title, assigned_to: story.assignee,
    story_points: story.points, sprint_goal: SPRINT_GOAL, status: 'in_progress',
  }});
}

async function completeTask(story: typeof STORIES[0], newStatus: 'review'|'done') {
  storyStatus.set(story.id, newStatus);
  await send({ event_type: 'task_completed', agent_id: story.assignee, payload: {
    task_id: story.id, result: `${story.title} — ${newStatus}`, success: true,
    status: newStatus, story_points: story.points,
  }});
}

async function goIdle(agentId: string) {
  await send({ hook_event_name: 'Stop', agent_id: agentId });
}

function header(text: string) {
  console.log(`\n  ${'═'.repeat(55)}`);
  console.log(`  ${text}`);
  console.log(`  ${'═'.repeat(55)}\n`);
}

// ═══════════════════════════════════════════════════════
async function phase0_setup() {
  header('SPRINT SETUP');
  await send({ hook_event_name: 'SessionStart', agent_id: 'main', cwd: '/workspace/acme-auth-mvp', source: 'simulation', model: 'claude-opus-4-6', permission_mode: 'auto' });
  console.log(`  Sprint Goal: ${SPRINT_GOAL}\n`);
  await sleep(2000);

  for (const a of ALL) {
    await send({ hook_event_name: 'SubagentStart', agent_id: a.id, agent_type: a.type, parent_agent_id: a === SCRUM_MASTER || a === PRODUCT_OWNER ? 'main' : SCRUM_MASTER.id });
    const role = a === SCRUM_MASTER ? 'Scrum Master' : a === PRODUCT_OWNER ? 'Product Owner' : QA.includes(a) ? 'QA' : 'Developer';
    console.log(`  ${role}: ${a.name} joined`);
    await sleep(800);
  }
  await sleep(1000);
}

// ═══════════════════════════════════════════════════════
async function phase1_planning() {
  header('SPRINT PLANNING (all in Planning Room)');

  // Everyone goes to planning
  for (const a of ALL) {
    await send({ hook_event_name: 'PreToolUse', agent_id: a.id, tool_name: 'Read', tool_input: { file_path: 'docs/backlog.md' } });
    await sleep(300);
    await send({ hook_event_name: 'PostToolUse', agent_id: a.id, tool_name: 'Read', tool_response: { type: 'text', content: 'Reading backlog' } });
  }

  await sleep(2000);
  await msg(SCRUM_MASTER.id, 'Welcome to Sprint Planning! Priya, whats the priority?');
  await sleep(2000);
  await msg(PRODUCT_OWNER.id, `Sprint Goal: ${SPRINT_GOAL}`);
  await sleep(2000);
  await msg(PRODUCT_OWNER.id, 'We have 6 stories totaling 18 points. Lets discuss.');
  await sleep(2000);

  // Discuss each story
  for (const story of STORIES) {
    const dev = ALL.find(a => a.id === story.assignee)!;
    await msg(PRODUCT_OWNER.id, `${story.id}: "${story.title}" — ${story.points} points`);
    await sleep(1500);
    await msg(dev.id, `I can take ${story.id}. Estimated effort looks right.`);
    await sleep(1200);
  }

  await sleep(1500);
  await msg(SCRUM_MASTER.id, 'Team agrees on all 6 stories. Sprint starts now!');
  await sleep(2000);

  // Assign all tasks
  for (const story of STORIES) {
    await assignTask(story);
    console.log(`  Assigned: ${story.id} "${story.title}" → ${ALL.find(a=>a.id===story.assignee)?.name}`);
    await sleep(500);
  }
  await sleep(1500);
}

// ═══════════════════════════════════════════════════════
async function phase2_development() {
  header('SPRINT DAY 1-2: DEVELOPMENT');

  // Devs and QA start working on their stories
  for (const story of STORIES) {
    const dev = ALL.find(a => a.id === story.assignee)!;
    for (const file of story.files) {
      await doTool(dev.id, dev.model, pick(['Write', 'Edit', 'Read']), file);
      console.log(`    ${dev.name}: ${pick(['Write','Edit'])} → ${file} (${story.id})`);
      await sleep(400);
    }
    // Extra work
    await doTool(dev.id, dev.model, pick(['Bash', 'Grep']), pick(story.files));
    await sleep(300);
  }

  // Some collaboration
  await msg(DEVS[0].id, 'Bob, the auth middleware needs your password reset hook');
  await sleep(1500);
  await msg(DEVS[1].id, 'Got it Alice, adding the integration point now');
  await sleep(1500);
  await msg(DEVS[2].id, 'Schema changes committed. Dave, your rate limiter can use the new user model.');
  await sleep(1500);
  await msg(DEVS[3].id, 'Thanks Carol!');
  await sleep(1500);
}

// ═══════════════════════════════════════════════════════
async function phase3_standup() {
  header('DAILY STANDUP');

  // Everyone briefly goes to planning for standup
  await msg(SCRUM_MASTER.id, 'Time for standup! Quick round-robin.');
  await sleep(2000);

  const updates = [
    { agent: DEVS[0], text: 'JWT login working. Starting token refresh today.' },
    { agent: DEVS[1], text: 'Password reset email sends. Need to test the link flow.' },
    { agent: DEVS[2], text: 'User CRUD done. Need human approval on schema changes.' },
    { agent: DEVS[3], text: 'Rate limiter prototype ready. Blocked on Redis config.' },
    { agent: QA[0], text: 'Auth E2E framework set up. Waiting for login endpoint to stabilize.' },
    { agent: QA[1], text: 'Integration test fixtures ready. Will start testing after Carol finishes.' },
  ];

  for (const u of updates) {
    await msg(u.agent.id, u.text);
    console.log(`    ${u.agent.name}: ${u.text.slice(0, 60)}`);
    await sleep(2000);
  }

  // Human interaction needed!
  await msg(DEVS[2].id, 'BLOCKED: Need human approval on database schema changes!');
  await sleep(2000);
  await msg(DEVS[3].id, 'BLOCKED: Need human to configure Redis connection for rate limiting');
  await sleep(2000);
  await msg(SCRUM_MASTER.id, 'Noted the blockers. Priya, can you help unblock Carol and Dave?');
  await sleep(2000);
  await msg(PRODUCT_OWNER.id, 'Ill review the schema now. Redis config — Dave, use the staging env for now.');
  await sleep(2000);

  // Unblock after a moment
  await sleep(3000);
  await msg(PRODUCT_OWNER.id, 'Schema approved! Carol, youre good to go.');
  await sleep(1500);
  await msg(DEVS[2].id, 'Thanks Priya! Continuing.');
  await sleep(1000);
}

// ═══════════════════════════════════════════════════════
async function phase4_moreWork() {
  header('SPRINT DAY 3-4: DEEP WORK');

  // QA agents go to coffee shop while waiting for dev work
  await msg(QA[0].id, 'Waiting for devs to finish... coffee time!');
  await sleep(1000);
  await goIdle(QA[0].id);
  await goIdle(QA[1].id);
  await sleep(1000);

  // QA idle chatter
  await msg(QA[0].id, 'Is it deployed yet?');
  await sleep(2500);
  await msg(QA[1].id, 'Works on my machine...');
  await sleep(2500);
  await msg(QA[0].id, 'Have you tried turning it off and on again?');
  await sleep(3000);

  // Meanwhile devs keep working
  const devStories = STORIES.filter(s => DEVS.some(d => d.id === s.assignee));
  for (const story of devStories) {
    const dev = ALL.find(a => a.id === story.assignee)!;
    await doTool(dev.id, dev.model, 'Edit', pick(story.files));
    await doTool(dev.id, dev.model, 'Bash', pick(story.files));
    console.log(`    ${dev.name}: working on ${story.id}`);
    await sleep(500);
  }

  // Devs finish → move stories to review
  for (const story of devStories) {
    await completeTask(story, 'review');
    const dev = ALL.find(a => a.id === story.assignee)!;
    await msg(dev.id, `${story.id} ready for review!`);
    console.log(`    ${dev.name}: ${story.id} → REVIEW`);
    await sleep(1000);
  }

  await sleep(1500);
  // QA comes back from coffee
  await msg(SCRUM_MASTER.id, 'Dev stories are in review. QA team, back to work!');
  await sleep(1500);
  await doTool(QA[0].id, QA[0].model, 'Read', 'tests/auth.e2e.ts');
  await doTool(QA[1].id, QA[1].model, 'Read', 'tests/users.test.ts');
  await sleep(1000);
}

// ═══════════════════════════════════════════════════════
async function phase5_codeReview() {
  header('CODE REVIEW');

  // Devs review each other's code
  await msg(DEVS[0].id, 'Reviewing Bobs password reset PR...');
  await sleep(1500);
  await doTool(DEVS[0].id, DEVS[0].model, 'Read', 'src/routes/auth.ts');
  await sleep(1000);
  await msg(DEVS[0].id, 'LGTM! Small nit: add input validation on the reset token.');
  await sleep(1500);

  await msg(DEVS[1].id, 'Reviewing Alice JWT implementation...');
  await sleep(1500);
  await doTool(DEVS[1].id, DEVS[1].model, 'Read', 'src/middleware/jwt.ts');
  await sleep(1000);
  await msg(DEVS[1].id, 'Approved! Solid implementation.');
  await sleep(1500);

  await msg(DEVS[2].id, 'Reviewing Daves rate limiter...');
  await sleep(1000);
  await doTool(DEVS[2].id, DEVS[2].model, 'Read', 'src/middleware/rate-limit.ts');
  await msg(DEVS[2].id, 'Nice work Dave. Approved with minor comments.');
  await sleep(1500);
}

// ═══════════════════════════════════════════════════════
async function phase6_testing() {
  header('QA TESTING');

  // QA runs tests
  await msg(QA[0].id, 'Running E2E auth test suite...');
  await sleep(1000);
  for (let i = 0; i < 3; i++) {
    await doTool(QA[0].id, QA[0].model, 'Bash', 'tests/auth.e2e.ts');
    console.log(`    ${QA[0].name}: E2E test run ${i + 1}/3`);
    await sleep(800);
  }
  await msg(QA[0].id, 'All E2E auth tests passing! 12/12 green.');
  await sleep(1500);

  await msg(QA[1].id, 'Running user integration tests...');
  await sleep(1000);
  for (let i = 0; i < 2; i++) {
    await doTool(QA[1].id, QA[1].model, 'Bash', 'tests/users.test.ts');
    console.log(`    ${QA[1].name}: integration test run ${i + 1}/2`);
    await sleep(800);
  }
  await msg(QA[1].id, 'User tests passing! 8/8 green.');
  await sleep(1500);

  // Mark QA stories done
  for (const story of STORIES.filter(s => QA.some(q => q.id === s.assignee))) {
    await completeTask(story, 'done');
    console.log(`    ${story.id} → DONE`);
    await sleep(500);
  }

  // Mark dev stories done (they passed review + QA)
  for (const story of STORIES.filter(s => DEVS.some(d => d.id === s.assignee))) {
    await completeTask(story, 'done');
    console.log(`    ${story.id} → DONE`);
    await sleep(500);
  }

  await sleep(1500);
  await msg(SCRUM_MASTER.id, 'All stories done! 18/18 story points completed.');
  await sleep(2000);
}

// ═══════════════════════════════════════════════════════
async function phase7_retro() {
  header('SPRINT RETROSPECTIVE');

  // Everyone gathers
  await msg(SCRUM_MASTER.id, 'Retro time! What went well, what can we improve?');
  await sleep(2500);

  await msg(DEVS[0].id, 'WELL: Good collaboration between Alice and Bob on auth.');
  await sleep(2000);
  await msg(QA[0].id, 'IMPROVE: QA waited too long for dev to finish. Start testing earlier.');
  await sleep(2000);
  await msg(DEVS[3].id, 'IMPROVE: Blockers took too long to resolve. Need faster PO response.');
  await sleep(2000);
  await msg(PRODUCT_OWNER.id, 'Fair point Dave. Ill dedicate morning slots for unblocking.');
  await sleep(2000);
  await msg(DEVS[2].id, 'WELL: Schema review process worked smoothly once approved.');
  await sleep(2000);
  await msg(QA[1].id, 'WELL: Test fixtures made integration testing fast.');
  await sleep(2000);
  await msg(SCRUM_MASTER.id, 'Action items noted. Great sprint team! Shipping to production.');
  await sleep(2500);

  // Ship it
  await msg(SCRUM_MASTER.id, '🚀 Sprint complete! All 18 points delivered.');
  await sleep(1500);
  for (const a of ALL.slice(0, 5)) {
    await msg(a.id, pick(['🎉 Shipped!', '💪 Great sprint!', '🙌 Team work!', '🍾 Done!', '✅ All green!']));
    await sleep(500);
  }
  await sleep(2000);
}

// ═══════════════════════════════════════════════════════
async function phase8_wrapup() {
  header('WRAP UP');

  // Final tool call to keep agents in working zones
  for (const a of [...DEVS, ...QA]) {
    await doTool(a.id, a.model, 'Read', 'package.json');
    await sleep(200);
  }

  // Complete all agents
  for (const a of ALL) {
    await send({ hook_event_name: 'SubagentStop', agent_id: a.id, last_assistant_message: `${a.name} completed sprint.` });
    console.log(`  ✓ ${a.name} done`);
    await sleep(300);
  }

  await send({ hook_event_name: 'SessionEnd', agent_id: 'main', reason: 'sprint_complete' });
}

// ═══════════════════════════════════════════════════════
async function main() {
  console.log('\n  🏃 SCRUM SPRINT SIMULATION');
  console.log(`  Session: ${SESSION_ID}`);
  console.log(`  Goal: ${SPRINT_GOAL}\n`);

  await phase0_setup();      // ~12s — Team joins
  await phase1_planning();   // ~30s — Sprint planning ceremony
  await phase2_development();// ~20s — Initial dev work
  await phase3_standup();    // ~25s — Daily standup + blockers
  await phase4_moreWork();   // ~25s — Deep work + QA coffee break
  await phase5_codeReview(); // ~15s — Code review
  await phase6_testing();    // ~15s — QA testing
  await phase7_retro();      // ~20s — Sprint retro
  await phase8_wrapup();     // ~8s  — Complete

  console.log(`\n  📊 Sprint Results:`);
  console.log(`     Stories: ${STORIES.length} completed (${STORIES.reduce((a,s)=>a+s.points,0)} points)`);
  console.log(`     Cost: $${totalCost.toFixed(4)}`);
  console.log(`     Session: ${SESSION_ID}`);
  console.log('\n  🏃 Sprint complete!\n');
}

main().catch(console.error);
