/** Runs a task at a given time. One task per key: setting a key again replaces it. */
export interface Scheduler {
  set(key: string, atMs: number, task: () => Promise<void> | void): void;
  clear(key: string): void;
  clearAll(): void;
}

export class TimerScheduler implements Scheduler {
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly onError: (err: unknown) => void = console.error,
  ) {}

  set(key: string, atMs: number, task: () => Promise<void> | void) {
    this.clear(key);
    const timer = setTimeout(
      () => {
        this.timers.delete(key);
        Promise.resolve()
          .then(task)
          .catch((err: unknown) => this.onError(err));
      },
      Math.max(0, atMs - this.now()),
    );
    timer.unref();
    this.timers.set(key, timer);
  }

  clear(key: string) {
    const timer = this.timers.get(key);
    if (timer) clearTimeout(timer);
    this.timers.delete(key);
  }

  clearAll() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}

/** Manual scheduler for tests: tasks run only when advanceTo() passes their time. */
export class ManualScheduler implements Scheduler {
  readonly tasks = new Map<string, { at: number; task: () => Promise<void> | void }>();

  set(key: string, atMs: number, task: () => Promise<void> | void) {
    this.tasks.set(key, { at: atMs, task });
  }

  clear(key: string) {
    this.tasks.delete(key);
  }

  clearAll() {
    this.tasks.clear();
  }

  has(prefix: string): boolean {
    return [...this.tasks.keys()].some((k) => k.startsWith(prefix));
  }

  /** Runs every task due at or before `now`, earliest first, including tasks they schedule. */
  async advanceTo(now: number) {
    for (;;) {
      const due = [...this.tasks.entries()]
        .filter(([, t]) => t.at <= now)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) return;
      this.tasks.delete(due[0]);
      await due[1].task();
    }
  }
}
