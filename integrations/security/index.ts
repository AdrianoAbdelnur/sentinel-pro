import argon2 from "argon2";
import { createHash, randomBytes, randomInt } from "node:crypto";

export const ARGON2ID_OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
export const ARGON2ID_BENCHMARK = { password: "sentinel-benchmark-password", warmupRuns: 1, measuredRuns: 3 } as const;

export class Argon2idPasswordHasher {
  hash(password: string) { return argon2.hash(password, ARGON2ID_OPTIONS); }
  verify(password: string, hash: string) { return argon2.verify(hash, password); }
  needsRehash(hash: string) { return argon2.needsRehash(hash, ARGON2ID_OPTIONS); }
}

export class SecureOpaqueTokenGenerator { async create() { return randomBytes(32).toString("base64url"); } }
export class SHA256TokenHasher { async hash(token: string) { return createHash("sha256").update(token).digest("hex"); } }

const words = ["Luna", "Rio", "Sol", "Nube", "Monte", "Campo", "Brisa", "Bosque", "Cobre", "Jade", "Roca", "Norte", "Sur", "Delta", "Viento", "Fuego"];
export class ReadableTemporaryPasswordGenerator { create() { return `${words[randomInt(words.length)]}-${words[randomInt(words.length)]}-${randomInt(10_000).toString().padStart(4, "0")}`; } }
export async function createDummyPasswordHash() { return new Argon2idPasswordHasher().hash("sentinel-invalid-credential"); }
