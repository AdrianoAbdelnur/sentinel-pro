import argon2 from "argon2";
import { ARGON2ID_BENCHMARK, ARGON2ID_OPTIONS } from "../integrations/security/argon2id-options.mjs";

for (let index = 0; index < ARGON2ID_BENCHMARK.warmupRuns; index += 1) await argon2.hash(ARGON2ID_BENCHMARK.password, ARGON2ID_OPTIONS);
const startedAt = performance.now();
for (let index = 0; index < ARGON2ID_BENCHMARK.measuredRuns; index += 1) await argon2.hash(ARGON2ID_BENCHMARK.password, ARGON2ID_OPTIONS);
const averageMilliseconds = (performance.now() - startedAt) / ARGON2ID_BENCHMARK.measuredRuns;
console.log(`argon2id_memory_cost=${ARGON2ID_OPTIONS.memoryCost}`);
console.log(`argon2id_time_cost=${ARGON2ID_OPTIONS.timeCost}`);
console.log(`argon2id_parallelism=${ARGON2ID_OPTIONS.parallelism}`);
console.log(`argon2id_warmup_runs=${ARGON2ID_BENCHMARK.warmupRuns}`);
console.log(`argon2id_measured_runs=${ARGON2ID_BENCHMARK.measuredRuns}`);
console.log(`argon2id_ms=${averageMilliseconds.toFixed(1)}`);
