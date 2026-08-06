import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { ARGON2ID_BENCHMARK, ARGON2ID_OPTIONS, Argon2idPasswordHasher, SHA256TokenHasher, SecureOpaqueTokenGenerator, ReadableTemporaryPasswordGenerator } from "./index";

const execFileAsync = promisify(execFile);

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
  it("runs the benchmark with the shared configuration contract", async () => {
    const { stdout } = await execFileAsync(process.execPath, ["benchmarks/argon2id.mjs"], { cwd: process.cwd() });
    expect(stdout.trim().split("\n")).toEqual([
      `argon2id_memory_cost=${ARGON2ID_OPTIONS.memoryCost}`,
      `argon2id_time_cost=${ARGON2ID_OPTIONS.timeCost}`,
      `argon2id_parallelism=${ARGON2ID_OPTIONS.parallelism}`,
      `argon2id_warmup_runs=${ARGON2ID_BENCHMARK.warmupRuns}`,
      `argon2id_measured_runs=${ARGON2ID_BENCHMARK.measuredRuns}`,
      expect.stringMatching(/^argon2id_ms=\d+\.\d$/),
    ]);
  }, 15_000);
  it("creates a 256-bit base64url token and deterministic SHA-256 hash", async () => {
    const tokens = new SecureOpaqueTokenGenerator(); const hashes = new SHA256TokenHasher();
    const token = await tokens.create();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(await hashes.hash(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashes.hash(token)).toBe(await hashes.hash(token));
    expect(await hashes.hash("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("creates readable varied temporary passwords", () => {
    const generator = new ReadableTemporaryPasswordGenerator(); const passwords = Array.from({ length: 10 }, () => generator.create());
    expect(passwords.every((value) => /^[A-Z][a-z]+-[A-Z][a-z]+-\d{4}$/.test(value))).toBe(true); expect(new Set(passwords).size).toBeGreaterThan(1);
  });
});
