export function groupBy<T, K>(
  items: readonly T[],
  keyOf: (item: T) => K
): Map<K, T[]> {
  const grouped = new Map<K, T[]>();

  for (const item of items) {
    const key = keyOf(item);
    const existing = grouped.get(key);

    if (existing) {
      existing.push(item);
    } else {
      grouped.set(key, [item]);
    }
  }

  return grouped;
}

export function countBy<T, K>(
  items: readonly T[],
  keyOf: (item: T) => K
): Map<K, number> {
  const counts = new Map<K, number>();

  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return counts;
}
