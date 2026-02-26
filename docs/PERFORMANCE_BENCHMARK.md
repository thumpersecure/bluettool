# Performance Benchmark Summary

## Scope

Measured command-dispatch strategy used by "all devices" light actions after refactor from sequential to parallel dispatch.

## Method

Synthetic benchmark (`npm run benchmark:perf`) with:

- 6 runs
- 20 simulated devices per run
- 18ms simulated per-device operation latency

## Results

- Sequential average: **362.93 ms**
- Parallel average: **18.22 ms**
- Improvement: **94.98% faster**

## Interpretation

The benchmark is intentionally synthetic (no physical BLE devices) but demonstrates the expected upper-bound benefit of parallel command dispatch for independent device actions.

## Caveat

Real-world BLE performance depends on platform stack limits, radio conditions, and device firmware behavior; parallel dispatch may be internally serialized by the OS for some adapters.
