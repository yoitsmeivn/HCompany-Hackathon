const MU_LAW_BIAS = 0x84;
const MU_LAW_CLIP = 32635;

export function pcm24kToMulaw8k(pcm: Uint8Array): Uint8Array {
  if (pcm.byteLength % 2 !== 0) throw new Error("PCM audio must contain complete 16-bit samples");
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const output = new Uint8Array(Math.floor(pcm.byteLength / 6));
  for (let inputOffset = 0, outputOffset = 0; inputOffset + 1 < pcm.byteLength && outputOffset < output.length; inputOffset += 6, outputOffset += 1) {
    output[outputOffset] = linearToMulaw(view.getInt16(inputOffset, true));
  }
  return output;
}

function linearToMulaw(sample: number): number {
  const sign = sample < 0 ? 0x80 : 0;
  const magnitude = Math.min(Math.abs(sample), MU_LAW_CLIP) + MU_LAW_BIAS;
  let exponent = 7;
  for (let mask = 0x4000; exponent > 0 && (magnitude & mask) === 0; mask >>= 1) exponent -= 1;
  const mantissa = (magnitude >> (exponent + 3)) & 0x0f;
  return (~(sign | (exponent << 4) | mantissa)) & 0xff;
}
