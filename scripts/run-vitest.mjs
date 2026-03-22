import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const vitestCli = require.resolve("vitest/vitest.mjs");

const rawArgs = process.argv.slice(2);
const command = rawArgs[0] && !rawArgs[0].startsWith("-") ? rawArgs[0] : "run";
const forwardedArgs = rawArgs[0] === command ? rawArgs.slice(1) : rawArgs;

const normalizedArgs = [...forwardedArgs];
const runInBandIndex = normalizedArgs.indexOf("--runInBand");

if (runInBandIndex >= 0) {
  normalizedArgs.splice(runInBandIndex, 1);

  if (!normalizedArgs.includes("--no-file-parallelism")) {
    normalizedArgs.push("--no-file-parallelism");
  }

  if (!normalizedArgs.includes("--maxWorkers")) {
    normalizedArgs.push("--maxWorkers", "1");
  }
}

const child = spawn(process.execPath, [vitestCli, command, ...normalizedArgs], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
