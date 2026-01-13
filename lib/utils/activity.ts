import { ActivityEvent } from '@/lib/types';

/**
 * Safely filters activities to return only visible/valid ones.
 * Filters out:
 * - Deleted activities
 * - Invalid/malformed activities
 * - Activities missing required fields
 *
 * Sorts by createdAt descending (newest first)
 *
 * @param activities - Array of activity events to filter
 * @returns Filtered and sorted array of valid activity events
 */
export function getVisibleActivities(activities: ActivityEvent[]): ActivityEvent[] {
  if (!Array.isArray(activities)) {
    return [];
  }

  return activities
    .filter(activity => {
      // Guard against undefined/null
      if (!activity || typeof activity !== 'object') {
        return false;
      }

      // Filter out deleted activities
      if (activity.deleted) {
        return false;
      }

      // Ensure required fields exist
      if (!activity.clientTxId || !activity.type || !activity.status) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Sort by timestamp descending (newest first)
      // Guard against invalid timestamps
      const timestampA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timestampB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      
      // Handle NaN cases (invalid date strings)
      const dateA = isNaN(timestampA) ? 0 : timestampA;
      const dateB = isNaN(timestampB) ? 0 : timestampB;
      
      return dateB - dateA;
    });
}

/**
 * Convert activities from a Record<string, ActivityEvent[]> to a flat array
 * and filter for visibility.
 *
 * @param eventsRecord - Record mapping userId to their activity events
 * @param userId - Optional userId to filter events for a specific user
 * @returns Filtered and sorted array of valid activity events
 */
export function getVisibleActivitiesFromRecord(
  eventsRecord: Record<string, ActivityEvent[]>,
  userId?: string,
): ActivityEvent[] {
  if (!eventsRecord || typeof eventsRecord !== 'object') {
    return [];
  }

  if (userId) {
    const userEvents = eventsRecord[userId] || [];
    return getVisibleActivities(userEvents);
  }

  // If no userId specified, get all events from all users
  const allEvents = Object.values(eventsRecord).flat();
  return getVisibleActivities(allEvents);
}
