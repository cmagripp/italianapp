// Built from the pinned MIT-licensed @noble/hashes2.0.1 package.
import { sha256 } from '@noble/hashes/sha2.js';
export function createSHA256() {
  const state = sha256.create();
  return { update: bytes => state.update(bytes), hex: () => [...state.digest()].map(b => b.toString(16).padStart(2, '0')).join('') };
}
