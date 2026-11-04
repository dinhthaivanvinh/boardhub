/** Fixed-window limiter: at most `limit` events per `windowMs` (NFR-07: 10 messages/second per socket). */
export class RateLimiter {
  private windowStart = 0;
  private count = 0;

  constructor(
    private readonly limit = 10,
    private readonly windowMs = 1_000,
    private readonly now: () => number = Date.now,
  ) {}

  allow(): boolean {
    const t = this.now();
    if (t - this.windowStart >= this.windowMs) {
      this.windowStart = t;
      this.count = 0;
    }
    this.count++;
    return this.count <= this.limit;
  }
}
