import { ulid } from 'ulid';

export function generateEventId(): string {
  return ulid();
}
