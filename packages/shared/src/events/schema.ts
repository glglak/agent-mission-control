import { z } from 'zod';
import { EventType } from './constants.js';

// --- Payload schemas ---

export const SessionStartedPayload = z.object({
  workspace: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const SessionEndedPayload = z.object({
  reason: z.string().optional(),
});

export const AgentRegisteredPayload = z.object({
  name: z.string(),
  type: z.string().optional(),
  parent_agent_id: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const AgentStartedPayload = z.object({
  task: z.string().optional(),
});

export const AgentIdlePayload = z.object({
  reason: z.string().optional(),
});

export const AgentBlockedPayload = z.object({
  reason: z.string(),
  blocked_by: z.string().optional(),
});

export const AgentCompletedPayload = z.object({
  result: z.string().optional(),
  success: z.boolean().optional(),
});

export const TaskAssignedPayload = z.object({
  task_id: z.string(),
  description: z.string(),
  assigned_to: z.string(),
});

export const TaskCompletedPayload = z.object({
  task_id: z.string(),
  result: z.string().optional(),
  success: z.boolean(),
});

export const ToolCalledPayload = z.object({
  tool_name: z.string(),
  arguments: z.record(z.unknown()).optional(),
  file_path: z.string().optional(),
});

export const ToolResultPayload = z.object({
  tool_name: z.string(),
  success: z.boolean(),
  result: z.unknown().optional(),
  duration_ms: z.number().optional(),
});

export const FileOpenedPayload = z.object({
  file_path: z.string(),
});

export const FileEditedPayload = z.object({
  file_path: z.string(),
  lines_added: z.number().optional(),
  lines_removed: z.number().optional(),
});

export const FileSavedPayload = z.object({
  file_path: z.string(),
});

export const AgentMessageSentPayload = z.object({
  to_agent_id: z.string(),
  content: z.string(),
  message_type: z.string().optional(),
});

export const AgentMessageReceivedPayload = z.object({
  from_agent_id: z.string(),
  content: z.string(),
  message_type: z.string().optional(),
});

export const TokenUsageUpdatedPayload = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
  model: z.string().optional(),
});

export const CostEstimateUpdatedPayload = z.object({
  cost_usd: z.number(),
  cumulative_cost_usd: z.number(),
  model: z.string().optional(),
});

// --- Payload map ---

export const PayloadSchemaMap = {
  [EventType.SessionStarted]: SessionStartedPayload,
  [EventType.SessionEnded]: SessionEndedPayload,
  [EventType.AgentRegistered]: AgentRegisteredPayload,
  [EventType.AgentStarted]: AgentStartedPayload,
  [EventType.AgentIdle]: AgentIdlePayload,
  [EventType.AgentBlocked]: AgentBlockedPayload,
  [EventType.AgentCompleted]: AgentCompletedPayload,
  [EventType.TaskAssigned]: TaskAssignedPayload,
  [EventType.TaskCompleted]: TaskCompletedPayload,
  [EventType.ToolCalled]: ToolCalledPayload,
  [EventType.ToolResult]: ToolResultPayload,
  [EventType.FileOpened]: FileOpenedPayload,
  [EventType.FileEdited]: FileEditedPayload,
  [EventType.FileSaved]: FileSavedPayload,
  [EventType.AgentMessageSent]: AgentMessageSentPayload,
  [EventType.AgentMessageReceived]: AgentMessageReceivedPayload,
  [EventType.TokenUsageUpdated]: TokenUsageUpdatedPayload,
  [EventType.CostEstimateUpdated]: CostEstimateUpdatedPayload,
} as const;

// --- Base event schema ---

export const BaseEventSchema = z.object({
  event_id: z.string(),
  timestamp: z.string(),
  session_id: z.string(),
  agent_id: z.string().optional(),
  event_type: z.nativeEnum(EventType),
  payload: z.record(z.unknown()).optional(),
});

// --- Validated parse ---

export function parseEvent(raw: unknown) {
  const base = BaseEventSchema.parse(raw);
  const payloadSchema = PayloadSchemaMap[base.event_type];
  if (payloadSchema && base.payload) {
    base.payload = payloadSchema.parse(base.payload) as Record<string, unknown>;
  }
  return base;
}
