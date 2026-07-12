import { randomBytes, timingSafeEqual } from "node:crypto";
import type { ArtifactRecord, ArtifactStore } from "./artifactStore.js";

// Tunnel-signed artifact publishing. Twilio needs a public HTTPS URL to fetch
// WhatsApp media, so each delivery mints a single-use 256-bit token served
// once at GET /api/artifacts/<token> on the EXISTING tunnel. No bucket, no
// static route, no listing; tokens are never logged and are revoked after the
// first successful stream or on expiry.

const DEFAULT_TTL_S = 600;
const MIN_TTL_S = 300;
const MAX_TTL_S = 900;

interface PublishedArtifact {
  token: string;
  artifactId: string;
  sessionId: string;
  expiresAt: number;
  consumed: boolean;
}

export interface PublishResult {
  signedUrl: string;
  expiresAt: string;
  objectKey: string;
}

export class ArtifactPublisher {
  private readonly published = new Map<string, PublishedArtifact>();

  constructor(
    private readonly store: ArtifactStore,
    private readonly publicBaseUrl: string,
  ) {}

  async publishArtifact(input: { sessionId: string; artifactId: string; expiresInSeconds?: number }): Promise<PublishResult> {
    const base = new URL(this.publicBaseUrl);
    if (base.protocol !== "https:") throw new Error("Artifact publishing requires an https KYLIAN_PUBLIC_BASE_URL (the tunnel)");
    // Validates ownership/expiry/unchanged-file before minting any URL.
    await this.store.resolveForDelivery(input.sessionId, input.artifactId);
    const ttl = Math.min(MAX_TTL_S, Math.max(MIN_TTL_S, input.expiresInSeconds ?? DEFAULT_TTL_S));
    const token = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + ttl * 1000;
    this.published.set(token, { token, artifactId: input.artifactId, sessionId: input.sessionId, expiresAt, consumed: false });
    this.prune();
    return {
      signedUrl: new URL(`/api/artifacts/${token}`, base).toString(),
      expiresAt: new Date(expiresAt).toISOString(),
      objectKey: token,
    };
  }

  /**
   * Redeem a token for delivery: constant-time match, unexpired, unconsumed.
   * Marks the token consumed and returns the re-validated artifact record.
   * Returns null (never details) on any failure.
   */
  async redeem(token: string): Promise<ArtifactRecord | null> {
    const entry = this.lookup(token);
    if (!entry || entry.consumed || Date.now() > entry.expiresAt) return null;
    let record: ArtifactRecord;
    try {
      record = await this.store.resolveForDelivery(entry.sessionId, entry.artifactId);
    } catch {
      this.published.delete(entry.token);
      return null;
    }
    entry.consumed = true;
    return record;
  }

  /** Revoke all outstanding tokens for an artifact (after successful delivery). */
  revokeArtifact(artifactId: string): void {
    for (const [token, entry] of this.published) {
      if (entry.artifactId === artifactId) this.published.delete(token);
    }
  }

  private lookup(candidate: string): PublishedArtifact | undefined {
    const candidateBuffer = Buffer.from(candidate);
    for (const [token, entry] of this.published) {
      const tokenBuffer = Buffer.from(token);
      if (tokenBuffer.length === candidateBuffer.length && timingSafeEqual(tokenBuffer, candidateBuffer)) return entry;
    }
    return undefined;
  }

  private prune(): void {
    const now = Date.now();
    for (const [token, entry] of this.published) {
      if (entry.consumed || entry.expiresAt < now) this.published.delete(token);
    }
  }
}
