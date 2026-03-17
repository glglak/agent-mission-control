# Agent Mission Control

Real-time visualization and telemetry dashboard for AI coding agents. Watch your Claude Code sessions come alive as pixel-art characters working in a virtual office — coding, reviewing, planning, communicating, and taking coffee breaks.

![Dashboard Screenshot](screenshots/dashboard.png)

## What It Does

Agent Mission Control captures telemetry from Claude Code sessions via hooks, normalizes events into a canonical format, persists them to a database, and broadcasts them in real-time to a web dashboard featuring:

- **Pixel-art office visualization** — Agents appear as characters sitting at desks in themed rooms (Dev Area, QA Lab, Planning, Review, Coffee Shop)
- **Real-time event streaming** — Watch tool calls, file edits, and agent communication as they happen
- **Token & cost tracking** — Per-agent and total prompt/completion token counts with USD cost estimates
- **Session replay** — Replay any past session and watch the timeline unfold
- **Clickable agents** — Click any character to see their status, token usage, and recent activity
- **Multi-session support** — Switch between active and historical sessions

![Pixel Office](screenshots/pixel-office.png)

## Architecture

```
Claude Code Hooks (HTTP POST)
    |
    v
Telemetry Bridge (Fastify, port 4700)
    |--- SQLite Database (persistence)
    |--- WebSocket (real-time broadcast)
    v
Web Dashboard (Next.js, port 3700)
    |--- Simulation Engine (state management)
    |--- Pixel Art Canvas (visualization)
    |--- Recharts (graphs & analytics)
```

### Packages

| Package | Description |
|---------|-------------|
| `packages/shared` | Event schemas (Zod), TypeScript types, WebSocket protocol |
| `packages/telemetry-bridge` | Fastify API server, SQLite storage, WebSocket broadcaster |
| `packages/simulation-engine` | World state management, event reducers, zone layout, replay |
| `apps/web` | Next.js dashboard with pixel art office and analytics |

## Quick Start

### Prerequisites

- **Node.js** 18+ (tested with 20.x)
- **npm** 9+ (comes with Node.js)
- **Claude Code** CLI installed and working

### 1. Clone and install

```bash
git clone https://github.com/glglak/agent-mission-control.git
cd agent-mission-control
npm install
```

### 2. Build all packages

```bash
npm run build
```

### 3. Start the services

Open **two terminals** in the project root:

**Terminal 1 — Telemetry Bridge:**
```bash
cd packages/telemetry-bridge
npx tsx src/index.ts
```

You should see:
```
Telemetry bridge listening on port 4700
```

**Terminal 2 — Web Dashboard:**
```bash
cd apps/web
npx next dev --port 3700
```

Then open **http://localhost:3700** in your browser.

> **Tip:** You can also use `bash tools/scripts/dev.sh` to start both at once (Linux/macOS).

### 4. Configure Claude Code hooks

Add the AMC telemetry hooks to your Claude Code configuration. Edit `~/.claude/settings.json` and merge in the hooks:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:4700/api/collect/claude-code",
            "timeout": 5
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:4700/api/collect/claude-code",
            "timeout": 5
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:4700/api/collect/claude-code",
            "timeout": 5
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:4700/api/collect/claude-code",
            "timeout": 5
          }
        ]
      }
    ],
    "PostToolUseFailure": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:4700/api/collect/claude-code",
            "timeout": 5
          }
        ]
      }
    ],
    "SubagentStart": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:4700/api/collect/claude-code",
            "timeout": 5
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:4700/api/collect/claude-code",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:4700/api/collect/claude-code",
            "timeout": 5
          }
        ]
      }
    ],
    "Notification": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:4700/api/collect/claude-code",
            "timeout": 5
          }
        ]
      }
    ],
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:4700/api/collect/claude-code",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

> **Note:** If you already have hooks in your settings.json, merge the `hooks` objects together. The full reference config is also available at `tools/hooks-config.json`.

> **Important:** Hooks are loaded when a Claude Code session starts. You must **start a new session** after saving settings.json for hooks to take effect.

### 5. Verify it works

1. Confirm the bridge is healthy:
   ```bash
   curl http://localhost:4700/api/health
   ```

2. Start a new Claude Code session in any project:
   ```bash
   claude
   ```

3. Open **http://localhost:3700** — you should see the session appear in the sidebar with a green LIVE indicator.

4. Ask Claude to do something (read a file, write code). Events should stream into the dashboard in real-time.

![Live Session](screenshots/live-session.png)

## Try the Demo Simulation

Don't want to wait for real Claude Code activity? Run the built-in simulation with 10 agents, a manager, coffee breaks, inter-agent communication, and dramatic firings:

```bash
npx tsx tools/scripts/simulate.ts
```

Options:
```bash
npx tsx tools/scripts/simulate.ts --fast    # Quick run (~15 seconds)
npx tsx tools/scripts/simulate.ts           # Real-time pacing (~60 seconds)
```

The simulation creates a session with:
- 10 worker agents + 1 manager ("The Boss")
- Agents work across Dev Area, QA Lab, Planning, and Review zones
- Random coffee breaks (agents visit the Coffee Shop)
- Inter-agent communication (messages, PR reviews, pair requests)
- The Boss fires the lowest-performing agent (they float to the sky with a halo)
- Token usage and cost tracking with realistic Anthropic pricing

## Dashboard Features

### Views

Toggle between views using the buttons in the header:

| View | Description |
|------|-------------|
| **3D** | Full-screen pixel art office visualization |
| **Dashboard** | Agent cards, token charts, cost dashboard, event log |
| **Split** | Both views stacked |

### Pixel Office Interactions

- **Click an agent** to see their tooltip: name, status, zone, tokens, recent activity
- **Replay button** (top-right) appears for ended sessions — replays events progressively
- **Bottom HUD** shows total agent count, token total, and cumulative cost
- **Room labels** identify each zone (Dev Area, Coffee Shop, QA Lab, Planning, Review)

### Session Sidebar

- Sessions auto-detected and auto-selected when they appear
- Green pulsing dot = LIVE session
- Gray dot = ended session
- Project path shown below session name

## API Reference

The telemetry bridge exposes a REST API:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server status and uptime |
| `/api/sessions` | GET | List all sessions |
| `/api/sessions/:id` | GET | Get a single session |
| `/api/agents?session_id=X` | GET | Agents for a session |
| `/api/events?session_id=X&type=Y&limit=N` | GET | Query events with filters |
| `/api/collect/claude-code` | POST | Ingest hook data |
| `/ws` | WebSocket | Real-time event stream |

## Configuration

Environment variables for the telemetry bridge:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4700` | HTTP server port |
| `DB_PATH` | `./amc.db` | SQLite database file path |
| `WS_PATH` | `/ws` | WebSocket endpoint path |

## Team / Multi-Developer Setup

For a shared team dashboard:

1. **Deploy the bridge** to a shared server accessible to all developers
2. **Update hook URLs** in each developer's `~/.claude/settings.json` to point to the shared server (e.g., `http://amc.internal:4700/api/collect/claude-code`)
3. **Deploy the web dashboard** — either on the same server or separately, configured to connect to the bridge
4. Each developer's sessions appear automatically with their project path visible

For user identification, you can wrap the hook with a script that adds a `user_id` field, or identify developers by their session metadata (project path, machine name).

## Project Structure

```
agent-mission-control/
  apps/
    web/                    # Next.js dashboard (port 3700)
      src/
        app/                # Pages
        components/         # UI components
          visualization/    # Pixel office, 3D scene
          dashboard/        # Cards, session list, status bar
          graphs/           # Charts and analytics
          inspectors/       # Agent inspector, event log
          timeline/         # Replay controls
        hooks/              # useWebSocket, useSimulation
        stores/             # Zustand state management
        lib/                # API client, WebSocket client
  packages/
    shared/                 # Event types, Zod schemas, protocol
    simulation-engine/      # World state, reducers, zones, replay
    telemetry-bridge/       # Fastify server, SQLite, WebSocket
  tools/
    hooks-config.json       # Reference hook configuration
    scripts/
      dev.sh                # Start both services
      simulate.ts           # Demo simulation script
```

## Troubleshooting

**No sessions appearing?**
- Check the bridge is running: `curl http://localhost:4700/api/health`
- Verify hooks are in `~/.claude/settings.json`
- Start a **new** Claude Code session (hooks load at startup)

**Events not showing in dashboard?**
- Check browser console for WebSocket connection errors
- Ensure both bridge (4700) and web (3700) are running
- Try selecting the session in the sidebar

**Build errors?**
- Run `npm install` from the root
- Make sure Node.js 18+ is installed
- Run `npm run build` to build all packages

**Database issues?**
- Delete `amc.db`, `amc.db-wal`, `amc.db-shm` and restart the bridge (creates fresh DB)

## License

MIT
