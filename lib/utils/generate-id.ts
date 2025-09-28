/**
 * Generate a unique transaction ID for client-side tracking
 * Format: timestamp-random to ensure uniqueness and sortability
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomPart}`;
}