import assert from "node:assert/strict";
import test from "node:test";
import { PhraseBuffer } from "./phraseBuffer.js";

test("tiny token fragments are buffered until a sentence completes", () => {
  const buffer = new PhraseBuffer();
  assert.deepEqual(buffer.append("Your"), []);
  assert.deepEqual(buffer.append(" file"), []);
  assert.deepEqual(buffer.append(" is"), []);
  assert.deepEqual(buffer.append(" here"), []);
  assert.deepEqual(buffer.append(". Next"), ["Your file is here."]);
  assert.equal(buffer.flush(), "Next");
});

test("the first complete sentence is emitted immediately", () => {
  const buffer = new PhraseBuffer();
  const phrases = buffer.append("Sure, it is in your Documents folder. Do you want me to open it now? I can");
  assert.deepEqual(phrases, ["Sure, it is in your Documents folder.", "Do you want me to open it now?"]);
  assert.equal(buffer.flush(), "I can");
});

test("commas split only after a meaningful minimum length", () => {
  const short = new PhraseBuffer();
  assert.deepEqual(short.append("Well, sure"), []);
  const long = new PhraseBuffer();
  const phrases = long.append("I looked through the folders you mentioned earlier today, and here is");
  assert.deepEqual(phrases, ["I looked through the folders you mentioned earlier today,"]);
});

test("run-on text without punctuation is hard-cut near the maximum chunk size", () => {
  const buffer = new PhraseBuffer({ maxChars: 60 });
  const words = Array.from({ length: 30 }, (_, index) => `word${index}`).join(" ");
  const phrases = buffer.append(words);
  assert.ok(phrases.length >= 1);
  for (const phrase of phrases) assert.ok(phrase.length <= 60, `phrase too long: ${phrase.length}`);
});

test("flush returns the remainder once and then nothing", () => {
  const buffer = new PhraseBuffer();
  buffer.append("Almost done");
  assert.equal(buffer.flush(), "Almost done");
  assert.equal(buffer.flush(), null);
});
