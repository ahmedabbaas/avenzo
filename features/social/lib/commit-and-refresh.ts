/** A failed reload must never turn a committed write into a retryable failure. */
export async function commitAndRefresh(
  commit: () => Promise<unknown>,
  refresh: () => Promise<unknown>,
): Promise<{ saved: boolean; refreshed: boolean }> {
  try {
    await commit();
  } catch {
    return { saved: false, refreshed: false };
  }
  try {
    await refresh();
    return { saved: true, refreshed: true };
  } catch {
    return { saved: true, refreshed: false };
  }
}
