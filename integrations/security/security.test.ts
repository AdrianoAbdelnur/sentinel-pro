import { describe, expect, it } from "vitest";
import { ARGON2ID_BENCHMARK, ARGON2ID_OPTIONS, Argon2idPasswordHasher, SHA256TokenHasher, SecureOpaqueTokenGenerator, ReadableTemporaryPasswordGenerator } from "./index";

describe("security adapters", () => {
  it("uses Argon2id with independently salted hashes", async () => {
    const hasher = new Argon2idPasswordHasher();
    const [first, second] = await Promise.all([hasher.hash("password1"), hasher.hash("password1")]);
    expect(first).toContain("$argon2id$"); expect(second).toContain("$argon2id$"); expect(first).not.toBe(second);
    expect(first).toContain("m=19456,t=2,p=1");
    await expect(hasher.verify("password1", first)).resolves.toBe(true);
    await expect(hasher.verify("wrong-pass", first)).resolves.toBe(false);
    expect(await hasher.needsRehash(first)).toBe(false);
    expect(first).toContain("m=19456,t=2,p=1");
    expect(ARGON2ID_OPTIONS).toMatchObject({ memoryCost: 19456, timeCost: 2, parallelism: 1 });
  });
  it("publishes a reproducible Argon2id benchmark workload without timing assertions", () => {
    expect(ARGON2ID_BENCHMARK).toEqual({ password: "sentinel-benchmark-password", warmupRuns: 1, measuredRuns: 3 });
  });
  it("creates a 256-bit base64url token and deterministic SHA-256 hash", async () => {
    const tokens = new SecureOpaqueTokenGenerator(); const hashes = new SHA256TokenHasher();
    const token = await tokens.create();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(await hashes.hash(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashes.hash(token)).toBe(await hashes.hash(token));
  });
  it("creates readable varied temporary passwords", () => {
    const generator = new ReadableTemporaryPasswordGenerator(); const passwords = Array.from({ length: 10 }, () => generator.create());
    expect(passwords.every((value) => /^[A-Z][a-z]+-[A-Z][a-z]+-\d{4}$/.test(value))).toBe(true); expect(new Set(passwords).size).toBeGreaterThan(1);
  });
});
