import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Local dev credentials only; a real deployment uses the OIDC provider. */
const PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };

/** `scrypt$N$r$p$salt$hash`: the cost is stored so it can be raised later. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = derive(password, salt, PARAMS).toString("hex");
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parsed = parse(stored);
  if (!parsed) return false;
  const candidate = derive(password, parsed.salt, parsed.params);
  const expected = Buffer.from(parsed.hash, "hex");
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

type Params = typeof PARAMS;

function derive(password: string, salt: string, params: Params): Buffer {
  return scryptSync(password, salt, params.keylen, {
    N: params.N,
    r: params.r,
    p: params.p,
    // scrypt needs memory proportional to N*r*128 above Node's default cap.
    maxmem: 256 * params.N * params.r,
  });
}

/**
 * Parsing is defensive: the stored string is data, so a malformed one must
 * make verification return false rather than throw, and a tampered one must
 * not be able to weaken the KDF below the parameters we hash with today.
 */
function parse(stored: string) {
  if (stored.includes(":") && !stored.includes("$")) {
    // Legacy hashes with implicit defaults, kept verifiable.
    const [salt, hash] = stored.split(":");
    if (!isHex(salt) || !isHex(hash)) return null;
    return { salt, hash, params: { ...PARAMS, keylen: hash.length / 2 } };
  }

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const [, n, r, p, salt, hash] = parts;
  if (!isHex(salt) || !isHex(hash)) return null;

  const params = {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    keylen: hash.length / 2,
  };
  if (
    !isPowerOfTwo(params.N) ||
    params.N < PARAMS.N ||
    params.N > 1 << 20 ||
    !isCount(params.r) ||
    !isCount(params.p) ||
    // Bounds the memory scryptSync is allowed to ask for (N*r*128 bytes).
    params.N * params.r > 1 << 22 ||
    params.keylen < 16 ||
    params.keylen > 128
  ) {
    return null;
  }
  return { salt, hash, params };
}

function isHex(value: string | undefined): value is string {
  return !!value && value.length % 2 === 0 && /^[0-9a-f]+$/i.test(value);
}

function isPowerOfTwo(value: number): boolean {
  return Number.isInteger(value) && value > 1 && (value & (value - 1)) === 0;
}

function isCount(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 32;
}
