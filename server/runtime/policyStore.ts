// In-memory owner policy per computer, set from the onboarding form and read
// by the voice pipeline when a call lands. Deliberately not persisted — the
// desktop app re-pushes its policy on launch. No provider claims here.

export interface ComputerPolicy {
  ownerName: string;
  authorizedPhone: string;
  allowedFolders: string[];
  allowedApplications: string[];
}

/** Compares phone numbers by their last 10 significant digits (format-agnostic). */
export function phoneMatches(a: string, b: string): boolean {
  const normalize = (value: string) => value.replace(/\D/g, "").slice(-10);
  const left = normalize(a);
  const right = normalize(b);
  return left.length >= 7 && left === right;
}

export class PolicyStore {
  private readonly policies = new Map<string, ComputerPolicy>();

  set(computerId: string, policy: ComputerPolicy): void {
    this.policies.set(computerId, policy);
  }

  get(computerId: string): ComputerPolicy | undefined {
    return this.policies.get(computerId);
  }

  /** True when no policy restricts the caller, or the caller's number is authorized. */
  authorizes(computerId: string, from: string | undefined): boolean {
    const policy = this.policies.get(computerId);
    if (!policy || !policy.authorizedPhone) return true;
    return from ? phoneMatches(policy.authorizedPhone, from) : false;
  }
}
