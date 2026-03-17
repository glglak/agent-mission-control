export enum EventType {
  SessionStarted = 'session_started',
  SessionEnded = 'session_ended',

  AgentRegistered = 'agent_registered',
  AgentStarted = 'agent_started',
  AgentIdle = 'agent_idle',
  AgentBlocked = 'agent_blocked',
  AgentCompleted = 'agent_completed',

  TaskAssigned = 'task_assigned',
  TaskCompleted = 'task_completed',

  ToolCalled = 'tool_called',
  ToolResult = 'tool_result',

  FileOpened = 'file_opened',
  FileEdited = 'file_edited',
  FileSaved = 'file_saved',

  AgentMessageSent = 'agent_message_sent',
  AgentMessageReceived = 'agent_message_received',

  TokenUsageUpdated = 'token_usage_updated',
  CostEstimateUpdated = 'cost_estimate_updated',
}

export enum AgentZone {
  Planning = 'planning',
  Coding = 'coding',
  Testing = 'testing',
  Review = 'review',
  Idle = 'idle',
}

export enum AgentVisualState {
  Working = 'working',
  Thinking = 'thinking',
  Blocked = 'blocked',
  Communicating = 'communicating',
  Idle = 'idle',
}
