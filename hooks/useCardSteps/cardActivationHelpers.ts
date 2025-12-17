/**
 * Extract a user-friendly error message from card activation errors
 */
export async function extractCardActivationErrorMessage(error: unknown): Promise<string> {
  if (error instanceof Response) {
    try {
      const data = await error.json();
      const serverMessage =
        (typeof data === 'string' && data) ||
        (Array.isArray((data as any)?.message)
          ? (data as any).message.join(' ')
          : (data as any)?.message || (data as any)?.error);

      if (serverMessage && typeof serverMessage === 'string') {
        return serverMessage;
      }
    } catch {
      // Fall through to default message
    }
  } else if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Please try again';
}
