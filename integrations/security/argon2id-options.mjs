import argon2 from "argon2";

export const ARGON2ID_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});

export const ARGON2ID_BENCHMARK = Object.freeze({
  password: "sentinel-benchmark-password",
  warmupRuns: 1,
  measuredRuns: 3,
});
