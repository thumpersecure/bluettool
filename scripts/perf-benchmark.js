#!/usr/bin/env node

/**
 * Synthetic performance benchmark for command-dispatch strategy.
 * Compares sequential vs parallel dispatch used by all-device light actions.
 */

const { performance: perf } = require('perf_hooks');

const RUNS = 6;
const DEVICE_COUNT = 20;
const STEP_LATENCY_MS = 18;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sequentialDispatch(deviceCount, latencyMs) {
  for (let i = 0; i < deviceCount; i++) {
    await wait(latencyMs);
  }
}

async function parallelDispatch(deviceCount, latencyMs) {
  await Promise.all(Array.from({ length: deviceCount }, () => wait(latencyMs)));
}

async function averageRuntime(fn) {
  const samples = [];
  for (let i = 0; i < RUNS; i++) {
    const start = perf.now();
    await fn(DEVICE_COUNT, STEP_LATENCY_MS);
    samples.push(perf.now() - start);
  }
  const avg = samples.reduce((sum, n) => sum + n, 0) / samples.length;
  return { avg, samples };
}

async function main() {
  const sequential = await averageRuntime(sequentialDispatch);
  const parallel = await averageRuntime(parallelDispatch);
  const improvement = ((sequential.avg - parallel.avg) / sequential.avg) * 100;

  console.log('BlueTTool synthetic dispatch benchmark');
  console.log(
    `Runs: ${RUNS}, devices/run: ${DEVICE_COUNT}, per-device latency: ${STEP_LATENCY_MS}ms`,
  );
  console.log('');
  console.log(`Sequential avg: ${sequential.avg.toFixed(2)} ms`);
  console.log(`Parallel avg:   ${parallel.avg.toFixed(2)} ms`);
  console.log(`Improvement:    ${improvement.toFixed(2)}% faster`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
