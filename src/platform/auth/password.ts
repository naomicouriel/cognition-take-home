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

function parse(stored: string) {
  if (stored.includes(":") && !stored.includes("$")) {
    // Legacy hashes with implicit defaults, kept verifiable.
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return null;
    return { salt, hash, params: { ...PARAMS, keylen: hash.length / 2 } };
  }
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [, n, r, p, salt, hash] = parts;
  if (!salt || !hash) return null;
  return {
    salt,
    hash,
    params: {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      keylen: hash.length / 2,
    },
  };
}
