/** Serialize SDP mutations shared by realtime, polling and manual recovery.
 * Reset invalidates queued work from an ended call; a failure must not poison
 * the queue and prevent subsequent signals from being handled.
 */
export function createCallTaskQueue() {
  let tail: Promise<void> = Promise.resolve();
  let generation = 0;

  return {
    run(task: () => Promise<void>): Promise<void> {
      const scheduledGeneration = generation;
      const next = tail.then(async () => {
        if (scheduledGeneration === generation) await task();
      });
      tail = next.catch(() => undefined);
      return next;
    },
    reset() {
      generation += 1;
      // Keep the tail: already running tasks still need to finish before a
      // new call touches media. Call ID checks cancel their side effects.
    },
  };
}
