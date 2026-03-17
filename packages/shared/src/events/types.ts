import { z } from 'zod';
import type { EventType } from './constants.js';
import type {
  BaseEventSchema,
  SessionStartedPayload,
  SessionEndedPayload,
  AgentRegisteredPayload,
  AgentStartedPayload,
  AgentIdlePayload,
  AgentBlockedPayload,
  AgentCompletedPayload,
  TaskAssignedPayload,
  TaskCompletedPayload,
  ToolCalledPayload,
  ToolResultPayload,
  FileOpenedPayload,
  FileEditedPayload,
  FileSavedPayload,
  AgentMessageSentPayload,
  AgentMessageReceivedPayload,
  TokenUsageUpdatedPayload,
  CostEstimateUpdatedPayload,
} from './schema.js';

// Base event
export type CanonicalEvent = z.infer<typeof BaseEventSchema>;

// Payloads
export type SessionStartedData = z.infer<typeof SessionStartedPayload>;
export type SessionEndedData = z.infer<typeof SessionEndedPayload>;
export type AgentRegisteredData = z.infer<typeof AgentRegisteredPayload>;
export type AgentStartedData = z.infer<typeof AgentStartedPayload>;
export type AgentIdleData = z.infer<typeof AgentIdlePayload>;
export type AgentBlockedData = z.infer<typeof AgentBlockedPayload>;
export type AgentCompletedData = z.infer<typeof AgentCompletedPayload>;
export type TaskAssignedData = z.infer<typeof TaskAssignedPayload>;
export type TaskCompletedData = z.infer<typeof TaskCompletedPayload>;
export type ToolCalledData = z.infer<typeof ToolCalledPayload>;
export type ToolResultData = z.infer<typeof ToolResultPayload>;
export type FileOpenedData = z.infer<typeof FileOpenedPayload>;
export type FileEditedData = z.infer<typeof FileEditedPayload>;
export type FileSavedData = z.infer<typeof FileSavedPayload>;
export type AgentMessageSentData = z.infer<typeof AgentMessageSentPayload>;
export type AgentMessageReceivedData = z.infer<typeof AgentMessageReceivedPayload>;
export type TokenUsageUpdatedData = z.infer<typeof TokenUsageUpdatedPayload>;
export type CostEstimateUpdatedData = z.infer<typeof CostEstimateUpdatedPayload>;

// Typed event helper
export interface TypedEvent<T extends EventType, P> {
  event_id: string;
  timestamp: string;
  session_id: string;
  agent_id?: string;
  event_type: T;
  payload: P;
}
