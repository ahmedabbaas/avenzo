"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import UserMediaImage from "./user-media-image";

type Collection = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type CollectionItem = {
  collection_id: string;
  post_id: string | null;
  reel_id: string | null;
  created_at: string;
};

type SavedEntry = {
  key: string;
  id: string;
  type: "post" | "reel";
  caption: string;
  mediaPath: string | null;
  coverPath: string | null;
  createdAt: string;
};

export default function SavedCollectionsPanel({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [entries, setEntries] = useState<SavedEntry[]>([]);
  const [activeCollection, setActiveCollection] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [status, setStatus] = useState("");

  const mediaUrl = useCallback(
    (path: string) =>
      supabase.storage.from("media").getPublicUrl(path).data.publicUrl,
    [supabase]
  );

  const load = useCallback(async () => {
    setLoading(true);

    const [savedPosts, savedReels, collectionResult] = await Promise.all([
      supabase
        .from("saved_posts")
        .select("post_id,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("saved_reels")
        .select("reel_id,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("saved_collections")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false }),
    ]);

    if (
      savedPosts.error ||
      savedReels.error ||
      collectionResult.error
    ) {
      setStatus("Saved content could not be loaded.");
      setLoading(false);
      return;
    }

    const nextCollections = (collectionResult.data || []) as Collection[];
    const collectionIds = nextCollections.map((collection) => collection.id);

    const itemResult = collectionIds.length
      ? await supabase
          .from("saved_collection_items")
          .select("*")
          .in("collection_id", collectionIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };

    if (itemResult.error) {
      setStatus("Collections could not be loaded.");
      setLoading(false);
      return;
    }

    const postIds = (savedPosts.data || []).map((row) => row.post_id);
    const reelIds = (savedReels.data || []).map((row) => row.reel_id);

    const [postsResult, reelsResult] = await Promise.all([
      postIds.length
        ? supabase
            .from("posts")
            .select("id,caption,media_path,cover_path,created_at")
            .in("id", postIds)
        : Promise.resolve({ data: [], error: null }),
      reelIds.length
        ? supabase
            .from("reels")
            .select("id,caption,media_path,cover_path,created_at")
            .in("id", reelIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (postsResult.error || reelsResult.error) {
      setStatus("Some saved media could not be loaded.");
      setLoading(false);
      return;
    }

    const savedPostTime = new Map(
      (savedPosts.data || []).map((row) => [row.post_id, row.created_at])
    );
    const savedReelTime = new Map(
      (savedReels.data || []).map((row) => [row.reel_id, row.created_at])
    );

    const nextEntries: SavedEntry[] = [
      ...(postsResult.data || []).map((post) => ({
        key: "post:" + post.id,
        id: post.id,
        type: "post" as const,
        caption: post.caption || "",
        mediaPath: post.media_path,
        coverPath: post.cover_path,
        createdAt: savedPostTime.get(post.id) || post.created_at,
      })),
      ...(reelsResult.data || []).map((reel) => ({
        key: "reel:" + reel.id,
        id: reel.id,
        type: "reel" as const,
        caption: reel.caption || "",
        mediaPath: reel.media_path,
        coverPath: reel.cover_path,
        createdAt: savedReelTime.get(reel.id) || reel.created_at,
      })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    setCollections(nextCollections);
    setItems((itemResult.data || []) as CollectionItem[]);
    setEntries(nextEntries);
    setStatus("");
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  async function createCollection() {
    const raw = window.prompt("Collection name");
    const name = raw?.trim().slice(0, 60);
    if (!name) return;

    const { error } = await supabase.from("saved_collections").insert({
      user_id: userId,
      name,
    });

    if (error) {
      setStatus(
        error.code === "23505"
          ? "You already have a collection with that name."
          : "Collection could not be created."
      );
      return;
    }

    await load();
    setStatus("Collection created.");
  }

  async function renameCollection(collection: Collection) {
    const raw = window.prompt("Rename collection", collection.name);
    const name = raw?.trim().slice(0, 60);
    if (!name || name === collection.name) return;

    const { error } = await supabase
      .from("saved_collections")
      .update({
        name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", collection.id)
      .eq("user_id", userId);

    if (error) {
      setStatus("Collection could not be renamed.");
      return;
    }

    await load();
    setStatus("Collection renamed.");
  }

  async function deleteCollection(collection: Collection) {
    if (!window.confirm('Delete "' + collection.name + '"? Saved content itself will stay saved.')) {
      return;
    }

    const { error } = await supabase
      .from("saved_collections")
      .delete()
      .eq("id", collection.id)
      .eq("user_id", userId);

    if (error) {
      setStatus("Collection could not be deleted.");
      return;
    }

    if (activeCollection === collection.id) {
      setActiveCollection("");
    }
    await load();
    setStatus("Collection deleted.");
  }

  function isInCollection(entry: SavedEntry, collectionId: string) {
    return items.some(
      (item) =>
        item.collection_id === collectionId &&
        (entry.type === "post"
          ? item.post_id === entry.id
          : item.reel_id === entry.id)
    );
  }

  async function toggleCollection(
    entry: SavedEntry,
    collectionId: string
  ) {
    if (!collectionId) return;
    const membership = items.find(
      (item) =>
        item.collection_id === collectionId &&
        (entry.type === "post"
          ? item.post_id === entry.id
          : item.reel_id === entry.id)
    );

    const key = collectionId + ":" + entry.key;
    setBusyKey(key);

    const result = membership
      ? await supabase
          .from("saved_collection_items")
          .delete()
          .eq("collection_id", collectionId)
          .eq(entry.type === "post" ? "post_id" : "reel_id", entry.id)
      : await supabase.from("saved_collection_items").insert({
          collection_id: collectionId,
          post_id: entry.type === "post" ? entry.id : null,
          reel_id: entry.type === "reel" ? entry.id : null,
        });

    setBusyKey("");

    if (result.error) {
      setStatus("Could not update this collection.");
      return;
    }

    await load();
  }

  const visibleEntries = useMemo(() => {
    if (!activeCollection) return entries;

    const allowed = new Set(
      items
        .filter((item) => item.collection_id === activeCollection)
        .map((item) =>
          item.post_id ? "post:" + item.post_id : "reel:" + item.reel_id
        )
    );

    return entries.filter((entry) => allowed.has(entry.key));
  }, [activeCollection, entries, items]);

  return (
    <section className="saved-collections-panel">
      <div className="saved-collections-head">
        <div>
          <div className="eyebrow">PRIVATE</div>
          <h2>Saved & Collections</h2>
          <p>Only you can see your saved content and collections.</p>
        </div>
        <button className="btn small" onClick={() => void createCollection()}>
          + New collection
        </button>
      </div>

      <div className="saved-collection-tabs">
        <button
          className={!activeCollection ? "active" : ""}
          onClick={() => setActiveCollection("")}
        >
          <b>All saved</b>
          <small>{entries.length}</small>
        </button>

        {collections.map((collection) => {
          const count = items.filter(
            (item) => item.collection_id === collection.id
          ).length;

          return (
            <button
              key={collection.id}
              className={activeCollection === collection.id ? "active" : ""}
              onClick={() => setActiveCollection(collection.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                void renameCollection(collection);
              }}
            >
              <b>{collection.name}</b>
              <small>{count}</small>
            </button>
          );
        })}
      </div>

      {activeCollection && (
        <div className="saved-collection-actions">
          {collections
            .filter((collection) => collection.id === activeCollection)
            .map((collection) => (
              <div key={collection.id}>
                <b>{collection.name}</b>
                <span>Long-press/right-click its tab to rename.</span>
                <button
                  className="btn secondary small"
                  onClick={() => void renameCollection(collection)}
                >
                  Rename
                </button>
                <button
                  className="btn secondary small"
                  onClick={() => void deleteCollection(collection)}
                >
                  Delete
                </button>
              </div>
            ))}
        </div>
      )}

      {loading ? (
        <div className="saved-collections-empty">
          <b>Loading saved content…</b>
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="saved-collections-empty">
          <b>
            {activeCollection
              ? "This collection is empty."
              : "Nothing saved yet."}
          </b>
          <p>
            {activeCollection
              ? "Add one of your saved posts or Reels to this collection."
              : "Save real posts and Reels to keep them here privately."}
          </p>
        </div>
      ) : (
        <div className="saved-content-grid">
          {visibleEntries.map((entry) => {
            const previewPath = entry.coverPath || entry.mediaPath;
            return (
              <article className="saved-content-tile" key={entry.key}>
                <Link
                  href={
                    entry.type === "post"
                      ? "/p/" + entry.id
                      : "/r/" + entry.id
                  }
                  className="saved-content-preview"
                >
                  {previewPath ? (
                    <UserMediaImage
                      src={mediaUrl(previewPath)}
                      alt={entry.caption || "Saved AVENZO content"}
                      loading="lazy"
                    />
                  ) : (
                    <span>A</span>
                  )}
                  <i>{entry.type === "reel" ? "REEL" : "POST"}</i>
                </Link>

                <div className="saved-content-copy">
                  <span>{entry.caption || "Saved AVENZO content"}</span>

                  {collections.length > 0 && (
                    <div className="saved-content-collections">
                      {collections.map((collection) => {
                        const included = isInCollection(
                          entry,
                          collection.id
                        );
                        const key = collection.id + ":" + entry.key;
                        return (
                          <button
                            key={collection.id}
                            disabled={busyKey === key}
                            className={included ? "active" : ""}
                            onClick={() =>
                              void toggleCollection(entry, collection.id)
                            }
                          >
                            {included ? "✓ " : "+ "}
                            {collection.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {status && (
        <p className="settings-status" role="status" aria-live="polite">
          {status}
        </p>
      )}
    </section>
  );
}
