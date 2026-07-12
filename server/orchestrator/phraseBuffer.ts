export interface PhraseBufferOptions {
  minSentenceChars?: number;
  minCommaChars?: number;
  maxChars?: number;
}

// Groups streamed text deltas into speakable phrases so TTS never receives
// individual tokens, but the first complete sentence goes out immediately.
export class PhraseBuffer {
  private buffer = "";
  private readonly minSentenceChars: number;
  private readonly minCommaChars: number;
  private readonly maxChars: number;

  constructor(options: PhraseBufferOptions = {}) {
    this.minSentenceChars = options.minSentenceChars ?? 12;
    this.minCommaChars = options.minCommaChars ?? 40;
    this.maxChars = options.maxChars ?? 140;
  }

  append(delta: string): string[] {
    this.buffer += delta;
    const phrases: string[] = [];
    for (let phrase = this.extract(); phrase !== null; phrase = this.extract()) phrases.push(phrase);
    return phrases;
  }

  flush(): string | null {
    const remainder = this.buffer.trim();
    this.buffer = "";
    return remainder ? remainder : null;
  }

  private extract(): string | null {
    const sentenceEnd = this.boundary(/[.!?…](?=["')\]]?\s|["')\]]?$)/g, this.minSentenceChars);
    if (sentenceEnd !== null) return this.take(sentenceEnd);
    const commaEnd = this.boundary(/[,;:](?=\s|$)/g, this.minCommaChars);
    if (commaEnd !== null) return this.take(commaEnd);
    if (this.buffer.length > this.maxChars) {
      const cut = this.buffer.lastIndexOf(" ", this.maxChars);
      if (cut > 0) return this.take(cut);
    }
    return null;
  }

  private boundary(pattern: RegExp, minChars: number): number | null {
    for (const match of this.buffer.matchAll(pattern)) {
      const end = (match.index ?? 0) + match[0].length;
      if (end >= minChars) return end;
    }
    return null;
  }

  private take(end: number): string | null {
    const phrase = this.buffer.slice(0, end).trim();
    this.buffer = this.buffer.slice(end).trimStart();
    return phrase ? phrase : null;
  }
}
