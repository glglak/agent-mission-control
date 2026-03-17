import type { CanonicalEvent } from '@amc/shared';
import { EventType } from '@amc/shared';
import { generateEventId, nowISO } from '@amc/shared';

/**
 * Raw hook data shape from any collector source.
 */
export interface RawHookData {
  session_id: string;
  agent_id?: string;
  agent_type?: string;
  timestamp?: string;
  event_type?: string;
  hook_type?: string;
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: Record<string, unknown>;
  tool_use_id?: string;
  prompt?: string;
  source?: string;
  model?: string;
  agent_transcript_path?: string;
  last_assistant_message?: string;
  message?: string;
  cwd?: string;
  permission_mode?: string;
  transcript_path?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Map hook_type values to canonical EventType when event_type is not provided.
 */
const HOOK_TYPE_MAP: Record<string, EventType> = {
  'session.start': EventType.SessionStarted,
  'session.end': EventType.SessionEnded,
  'agent.register': EventType.AgentRegistered,
  'agent.start': EventType.AgentStarted,
  'agent.idle': EventType.AgentIdle,
  'agent.blocked': EventType.AgentBlocked,
  'agent.complete': EventType.AgentCompleted,
  'tool.call': EventType.ToolCalled,
  'tool.result': EventType.ToolResult,
  'file.open': EventType.FileOpened,
  'file.edit': EventType.FileEdited,
  'file.save': EventType.FileSaved,
  'message.sent': EventType.AgentMessageSent,
  'message.received': EventType.AgentMessageReceived,
  'token.usage': EventType.TokenUsageUpdated,
  'cost.update': EventType.CostEstimateUpdated,
};

/**
 * Map Claude Code hook_event_name to canonical event(s).
 * Claude Code fires hooks like "SessionStart", "PostToolUse", "SubagentStart", etc.
 * We map these to our canonical event types and build the appropriate payload.
 */
function transformClaudeCodeHook(raw: RawHookData): CanonicalEvent | CanonicalEvent[] {
  const hookName = raw.hook_event_name!;
  const ts = raw.timestamp ?? nowISO();
  const sessionId = raw.session_id;
  const agentId = raw.agent_id ?? 'main';

  switch (hookName) {
    case 'SessionStart': {
      return {
        event_id: '',
        timestamp: ts,
        session_id: sessionId,
        agent_id: agentId,
        event_type: EventType.SessionStarted,
        payload: {
          workspace: raw.cwd,
          metadata: {
            source: raw.source,
            model: raw.model,
            permission_mode: raw.permission_mode,
            agent_type: raw.agent_type,
          },
        },
      };
    }

    case 'SessionEnd': {
      return {
        event_id: '',
        timestamp: ts,
        session_id: sessionId,
        agent_id: agentId,
        event_type: EventType.SessionEnded,
        payload: { reason: raw.reason ?? raw.source ?? 'ended' },
      };
    }

    case 'SubagentStart': {
      // A subagent was spawned — register it as a new agent
      const subAgentId = raw.agent_id ?? `sub-${Date.now()}`;
      return {
        event_id: '',
        timestamp: ts,
        session_id: sessionId,
        agent_id: subAgentId,
        event_type: EventType.AgentRegistered,
        payload: {
          name: raw.agent_type ?? 'subagent',
          type: raw.agent_type,
          parent_agent_id: 'main',
          metadata: { transcript_path: raw.agent_transcript_path },
        },
      };
    }

    case 'SubagentStop': {
      const subAgentId = raw.agent_id ?? 'unknown';
      return {
        event_id: '',
        timestamp: ts,
        session_id: sessionId,
        agent_id: subAgentId,
        event_type: EventType.AgentCompleted,
        payload: {
          result: raw.last_assistant_message?.slice(0, 200),
          success: true,
        },
      };
    }

    case 'PreToolUse': {
      const toolName = raw.tool_name ?? 'unknown';
      const filePath = raw.tool_input?.['file_path'] as string | undefined;

      const events: CanonicalEvent[] = [
        {
          event_id: '',
          timestamp: ts,
          session_id: sessionId,
          agent_id: agentId,
          event_type: EventType.ToolCalled,
          payload: {
            tool_name: toolName,
            arguments: raw.tool_input,
            file_path: filePath,
          },
        },
      ];

      // If it's a file tool, also emit a file event
      if (filePath) {
        const fileEventType = toolName === 'Write'
          ? EventType.FileEdited
          : toolName === 'Edit'
            ? EventType.FileEdited
            : toolName === 'Read'
              ? EventType.FileOpened
              : null;

        if (fileEventType) {
          events.push({
            event_id: '',
            timestamp: ts,
            session_id: sessionId,
            agent_id: agentId,
            event_type: fileEventType,
            payload: {
              file_path: filePath,
              ...(fileEventType === EventType.FileEdited ? { lines_added: 0, lines_removed: 0 } : {}),
            },
          });
        }
      }

      // If it's an Agent tool, emit a message event
      if (toolName === 'Agent') {
        events.push({
          event_id: '',
          timestamp: ts,
          session_id: sessionId,
          agent_id: agentId,
          event_type: EventType.AgentMessageSent,
          payload: {
            to_agent_id: raw.tool_input?.['subagent_type'] as string ?? 'subagent',
            content: (raw.tool_input?.['prompt'] as string ?? '').slice(0, 200),
            message_type: 'task_delegation',
          },
        });
      }

      return events;
    }

    case 'PostToolUse': {
      const toolName = raw.tool_name ?? 'unknown';

      return {
        event_id: '',
        timestamp: ts,
        session_id: sessionId,
        agent_id: agentId,
        event_type: EventType.ToolResult,
        payload: {
          tool_name: toolName,
          success: true,
          result: raw.tool_response,
        },
      };
    }

    case 'PostToolUseFailure': {
      return {
        event_id: '',
        timestamp: ts,
        session_id: sessionId,
        agent_id: agentId,
        event_type: EventType.ToolResult,
        payload: {
          tool_name: raw.tool_name ?? 'unknown',
          success: false,
          result: raw.error ?? raw.tool_response,
        },
      };
    }

    case 'Notification': {
      // Notifications don't map directly — emit as a message to self
      return {
        event_id: '',
        timestamp: ts,
        session_id: sessionId,
        agent_id: agentId,
        event_type: EventType.AgentMessageSent,
        payload: {
          to_agent_id: 'user',
          content: raw.message ?? raw.title ?? 'notification',
          message_type: 'notification',
        },
      };
    }

    case 'Stop': {
      return {
        event_id: '',
        timestamp: ts,
        session_id: sessionId,
        agent_id: agentId,
        event_type: EventType.AgentIdle,
        payload: { reason: 'stop' },
      };
    }

    case 'TaskCompleted': {
      return {
        event_id: '',
        timestamp: ts,
        session_id: sessionId,
        agent_id: (raw.teammate_name as string | undefined) ?? agentId,
        event_type: EventType.TaskCompleted,
        payload: {
          task_id: raw.task_id as string ?? 'unknown',
          result: raw.task_description as string ?? '',
          success: true,
        },
      };
    }

    default: {
      // Unknown hook — emit as a generic tool call for visibility
      return {
        event_id: '',
        timestamp: ts,
        session_id: sessionId,
        agent_id: agentId,
        event_type: EventType.ToolCalled,
        payload: {
          tool_name: `hook:${hookName}`,
          arguments: raw.payload ?? {},
        },
      };
    }
  }
}

/**
 * Resolve event type from raw data using event_type or hook_type fields.
 */
function resolveEventType(raw: RawHookData): EventType {
  if (raw.event_type) {
    const values = Object.values(EventType) as string[];
    if (values.includes(raw.event_type)) {
      return raw.event_type as EventType;
    }
  }

  if (raw.hook_type && HOOK_TYPE_MAP[raw.hook_type]) {
    return HOOK_TYPE_MAP[raw.hook_type];
  }

  throw new Error(`Cannot resolve event type: event_type=${raw.event_type}, hook_type=${raw.hook_type}`);
}

/**
 * Transform raw hook data into CanonicalEvent(s).
 *
 * Supports three input styles:
 * 1. Claude Code hooks (hook_event_name field)
 * 2. Direct canonical format (event_type field)
 * 3. Legacy hook_type format
 */
export function transformToCanonical(raw: RawHookData): CanonicalEvent | CanonicalEvent[] {
  // If it has hook_event_name, it's a real Claude Code hook
  if (raw.hook_event_name) {
    return transformClaudeCodeHook(raw);
  }

  // Otherwise use event_type or hook_type
  const eventType = resolveEventType(raw);

  return {
    event_id: '',
    timestamp: raw.timestamp ?? nowISO(),
    session_id: raw.session_id,
    agent_id: raw.agent_id,
    event_type: eventType,
    payload: raw.payload as Record<string, unknown> | undefined,
  };
}

/**
 * Enrich a canonical event with a generated event_id if not already present.
 */
export function enrichWithEventId(event: CanonicalEvent): CanonicalEvent {
  if (!event.event_id) {
    return { ...event, event_id: generateEventId() };
  }
  return event;
}
