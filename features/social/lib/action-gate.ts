/** Prevent overlapping writes to the same action without blocking other posts. */
export function createActionGate() {
  const pending = new Set<string>();
  return {
    async run(key: string, task: () => Promise<void>): Promise<void> {
      if (pending.has(key)) return;
      pending.add(key);
      try {
        await task();
      } finally {
        pending.delete(key);
      }
    },
  };
}
