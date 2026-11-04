/** A business error sent back to the client as { ok: false, code } (never thrown for bugs). */
export class HubError extends Error {
  constructor(
    readonly code: string,
    readonly params?: Record<string, unknown>,
  ) {
    super(code);
    this.name = 'HubError';
  }
}
