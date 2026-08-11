const encoder = new TextEncoder();
const ITERATIONS = 120_000;
export type LocalVerifier = { salt: string; digest: string };

export function createOpaqueId(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return `${prefix}_${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
}
function bytesToHex(bytes: Uint8Array) { return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(""); }

export async function deriveLocalVerifier(secret: string, saltHex?: string): Promise<LocalVerifier> {
  const salt = saltHex ? Uint8Array.from(saltHex.match(/.{2}/g) || [], (value) => parseInt(value, 16)) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveBits"]);
  const digest = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256);
  return { salt: bytesToHex(salt), digest: bytesToHex(new Uint8Array(digest)) };
}

export async function matchesLocalVerifier(secret: string, verifier: LocalVerifier) {
  const candidate = await deriveLocalVerifier(secret, verifier.salt);
  if (candidate.digest.length !== verifier.digest.length) return false;
  let difference = 0;
  for (let index = 0; index < candidate.digest.length; index += 1) difference |= candidate.digest.charCodeAt(index) ^ verifier.digest.charCodeAt(index);
  return difference === 0;
}

export function createOneTimeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  return Array.from(bytes, (value) => value.toString(36).padStart(2, "0")).join("").slice(0, 24).toUpperCase();
}
