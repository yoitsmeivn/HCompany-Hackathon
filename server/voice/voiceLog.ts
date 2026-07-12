const PHONE_PATTERN = /\+[1-9]\d{7,14}/g;

export function logVoice(event: string, fields?: Record<string, string | number | boolean | undefined>): void {
  console.log(`[voice] ${event}`, fields ?? {});
}

export function maskPhone(value: string): string {
  return value.replace(PHONE_PATTERN, (match) => `${match.slice(0, 2)}***${match.slice(-2)}`);
}

export function sanitizeProviderError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown provider error";
  return maskPhone(message);
}
