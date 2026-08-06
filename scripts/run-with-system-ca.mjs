import { spawn } from "node:child_process";

const [command, ...args] = process.argv.slice(2);

if (!command) {
  process.exitCode = 1;
} else {
  const child = spawn(command, args, {
    env: { ...process.env, NODE_OPTIONS: [process.env.NODE_OPTIONS, "--use-system-ca"].filter(Boolean).join(" ") },
    stdio: "inherit",
  });

  child.on("error", () => {
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}
