// Entry point of a bot worker when the server runs from TypeScript (tsx).
// The tsx loader must be registered inside the worker before the TypeScript worker is imported:
// loaders passed with --import are not active yet for a worker's entry module.
import { register } from 'tsx/esm/api';

register();
await import('./bot-worker.ts');
