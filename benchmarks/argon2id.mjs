import argon2 from "argon2";

const startedAt = performance.now();
await argon2.hash("sentinel-argon2id-benchmark", { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
console.log(`argon2id_ms=${(performance.now() - startedAt).toFixed(1)}`);
