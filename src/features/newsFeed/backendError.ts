/** Pulls a human-readable message out of dock-helper-api's `{ message, error, statusCode }` error body. */
export async function backendErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    const message = (body as { message?: unknown } | null)?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('; ');
  } catch {
    // Response body wasn't JSON — fall through to the generic fallback.
  }
  return fallback;
}
