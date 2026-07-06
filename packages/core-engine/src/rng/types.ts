/**
 * The engine's only source of randomness. Always injected, never chosen by
 * the engine: the simulator/tests inject a seeded PRNG, the live server
 * injects a CSPRNG (plan §6 decision 14).
 */
export interface RandomSource {
  /** Uniform float in [0, 1). */
  next(): number;
}
