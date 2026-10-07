type TrayStory = { author_id: string; viewed?: boolean; created_at: string };

/** One avatar per author; opening an unseen ring starts at their first unseen story. */
export function groupStoriesForTray<T extends TrayStory>(stories: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const story of stories) {
    const group = groups.get(story.author_id);
    if (group) group.push(story);
    else groups.set(story.author_id, [story]);
  }
  return [...groups.values()].map((group) => {
    const ordered = group.slice().sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    return ordered.find((story) => !story.viewed) || ordered[0];
  });
}
