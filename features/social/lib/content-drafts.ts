"use client";

import type { MediaDimensions } from "./media";

export type ContentDraftMode = "post" | "reel" | "story";

export type ContentDraftMedia = {
  file: File;
  dimensions: MediaDimensions | null;
  altText: string;
};

export type ContentDraft = {
  id: string;
  userId: string;
  mode: ContentDraftMode;
  title: string;
  caption: string;
  hashtags: string;
  mentions: string;
  location: string;
  collaboratorIds: string[];
  postMedia: ContentDraftMedia[];
  file: File | null;
  coverFile: File | null;
  dimensions: MediaDimensions | null;
  pollQuestion: string;
  pollOptions: string[];
  pollDurationHours: number | null;
  createdAt: string;
  updatedAt: string;
};

type DraftInput = Omit<ContentDraft, "id" | "createdAt" | "updatedAt"> & {
  id?: string | null;
};

const DB_NAME = "avenzo-content-drafts";
const DB_VERSION = 1;
const STORE = "drafts";
const MAX_DRAFTS_PER_USER = 12;

function openDraftDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("DRAFT_DB_FAILED"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
) {
  const db = await openDraftDb();

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      // A request can succeed before the transaction is committed to storage.
      // Resolve only after commit so quota/abort errors never show 'Draft saved'.
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () =>
        reject(transaction.error || new Error("DRAFT_TRANSACTION_ABORTED"));
      request.onerror = () =>
        reject(request.error || new Error("DRAFT_OPERATION_FAILED"));
      transaction.onerror = () =>
        reject(transaction.error || new Error("DRAFT_TRANSACTION_FAILED"));
    });
  } finally {
    db.close();
  }
}

export async function listContentDrafts(userId: string) {
  if (typeof indexedDB === "undefined") return [] as ContentDraft[];

  const rows = await withStore<ContentDraft[]>("readonly", (store) =>
    store.index("userId").getAll(userId)
  );

  return (rows || [])
    .filter((row) => row.userId === userId)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

export async function saveContentDraft(input: DraftInput) {
  if (typeof indexedDB === "undefined") {
    throw new Error("Drafts are not available in this browser.");
  }

  const now = new Date().toISOString();
  const existing =
    input.id
      ? await withStore<ContentDraft | undefined>("readonly", (store) =>
          store.get(input.id || "")
        )
      : undefined;

  if (existing && existing.userId !== input.userId) {
    throw new Error("This draft belongs to another account on this device.");
  }

  const draft: ContentDraft = {
    ...input,
    id: input.id || crypto.randomUUID(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await withStore<IDBValidKey>("readwrite", (store) => store.put(draft));

  const userDrafts = await listContentDrafts(input.userId);
  for (const stale of userDrafts.slice(MAX_DRAFTS_PER_USER)) {
    await deleteContentDraft(stale.id);
  }

  return draft;
}

export async function deleteContentDraft(id: string) {
  if (typeof indexedDB === "undefined") return;
  await withStore<undefined>("readwrite", (store) => store.delete(id));
}
