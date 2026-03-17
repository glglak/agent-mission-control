import type { CanonicalEvent } from '@amc/shared';
import { parseEvent } from '@amc/shared';
import { transformToCanonical, enrichWithEventId } from './transforms.js';
import type { RawHookData } from './transforms.js';

/**
 * Validate that the raw data has minimum required fields.
 */
function validate(raw: unknown): RawHookData {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Payload must be a non-null object');
  }

  const data = raw as Record<string, unknown>;

  if (typeof data['session_id'] !== 'string' || !data['session_id']) {
    throw new Error('Missing required field: session_id');
  }

  // Must have one of: hook_event_name (Claude Code hooks), event_type, or hook_type
  if (!data['event_type'] && !data['hook_type'] && !data['hook_event_name']) {
    throw new Error('Missing required field: event_type, hook_type, or hook_event_name');
  }

  return data as unknown as RawHookData;
}

/**
 * Full normalization pipeline:
 * 1. Validate raw input
 * 2. Transform to canonical shape (may produce multiple events)
 * 3. Enrich with event_id
 * 4. Parse/validate with shared schema
 */
export function normalizePipeline(raw: unknown): CanonicalEvent[] {
  // Step 1: Validate minimum fields
  const validated = validate(raw);

  // Step 2: Transform to canonical shape
  const result = transformToCanonical(validated);
  const events = Array.isArray(result) ? result : [result];

  // Step 3 & 4: Enrich and validate each event
  return events.map((event) => {
    const enriched = enrichWithEventId(event);
    return parseEvent(enriched);
  });
}
