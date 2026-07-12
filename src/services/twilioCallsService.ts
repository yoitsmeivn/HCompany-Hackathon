export interface TestCallResult { callSid: string; status: string }

export function normalizePhoneForCall(value: string): string {
  const normalized = value.trim().replace(/[\s().-]/g, "");
  if (normalized.startsWith("+")) return normalized;
  return /^\d{10}$/.test(normalized) ? `+1${normalized}` : normalized;
}

export function isValidTestCallPhone(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(normalizePhoneForCall(value));
}

export async function startTwilioTestCall(input: { to: string }): Promise<TestCallResult> {
  const response = await fetch(`/api/twilio/calls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: normalizePhoneForCall(input.to) }),
  });
  const body = await response.json() as TestCallResult | { error?: { message?: string } };
  if (!response.ok) throw new Error("error" in body ? body.error?.message ?? "Could not start the test call" : "Could not start the test call");
  return body as TestCallResult;
}
