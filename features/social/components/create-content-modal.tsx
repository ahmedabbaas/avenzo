"use client";

import {
  useMemo,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { useComposerLifecycle } from "../lib/use-composer-lifecycle";
import NativePhotoStudio from "./native-photo-studio";
import ImageTextScan from "./image-text-scan";
import AvatarImage from "./avatar-image";
import UserMediaImage from "./user-media-image";
import Icon from "./icon";
import VerifiedBadge from "./verified-badge";
import { avatarFor } from "../lib/profile";
import {
  editPostImage,
  type MediaDimensions,
  type PostImageCrop,
  type PostImageEditOptions,
  type PostImageFilter,
} from "../lib/media";
import type { Profile } from "../types";
import type { ContentDraft } from "../lib/content-drafts";
import {
  analyzeImageForAltText,
  hasNativeMediaSense,
  nativeImpact,
} from "../lib/native-social";

export type CreateContentMode = "post" | "reel" | "story";

const FILTERS: Array<{ id: PostImageFilter; label: string }> = [
  { id: "none", label: "Original" },
  { id: "vivid", label: "Vivid" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "mono", label: "Mono" },
];

const CROPS: Array<{ id: PostImageCrop; label: string }> = [
  { id: "original", label: "Original" },
  { id: "square", label: "1:1" },
  { id: "portrait", label: "4:5" },
  { id: "landscape", label: "16:9" },
];

function parseMentions(value: string) {
  return [...new Set(
    value
      .split(/[\s,]+/)
      .map((item) => item.trim().replace(/^@+/, "").toLowerCase())
      .filter(Boolean)
  )];
}

export default function CreateContentModal({
  profile,
  mode,
  title,
  caption,
  hashtags,
  mentions,
  location,
  file,
  preview,
  postFiles = [],
  postPreviews = [],
  postDimensions = [],
  postAltTexts = [],
  coverFile,
  coverPreview,
  dimensions,
  posting,
  uploadProgress,
  people,
  collaboratorIds,
  pollQuestion,
  pollOptions,
  pollDurationHours,
  drafts,
  activeDraftId,
  initialShowDrafts = false,
  onSaveDraft,
  onRestoreDraft,
  onDeleteDraft,
  onPollQuestionChange,
  onPollOptionsChange,
  onPollDurationHoursChange,
  onToggleCollaborator,
  onModeChange,
  onTitleChange,
  onCaptionChange,
  onHashtagsChange,
  onMentionsChange,
  onLocationChange,
  onPostAltTextChange,
  onReplacePostFile,
  onFileSelect,
  onPostFilesSelect,
  onCoverSelect,
  onClose,
  onSubmit,
}: {
  profile: Profile;
  mode: CreateContentMode;
  title: string;
  caption: string;
  hashtags: string;
  mentions: string;
  location: string;
  file: File | null;
  preview: string;
  postFiles?: File[];
  postPreviews?: string[];
  postDimensions?: Array<MediaDimensions | null>;
  postAltTexts?: string[];
  coverFile: File | null;
  coverPreview: string;
  dimensions: MediaDimensions | null;
  posting: boolean;
  uploadProgress: number;
  people: Profile[];
  collaboratorIds: string[];
  pollQuestion: string;
  pollOptions: string[];
  pollDurationHours: number | null;
  drafts: ContentDraft[];
  activeDraftId: string | null;
  initialShowDrafts?: boolean;
  onSaveDraft: () => Promise<void> | void;
  onRestoreDraft: (draft: ContentDraft) => Promise<void> | void;
  onDeleteDraft: (draftId: string) => Promise<void> | void;
  onPollQuestionChange: (value: string) => void;
  onPollOptionsChange: (value: string[]) => void;
  onPollDurationHoursChange: (value: number | null) => void;
  onToggleCollaborator: (userId: string) => void;
  onModeChange: (mode: CreateContentMode) => void;
  onTitleChange: (value: string) => void;
  onCaptionChange: (value: string) => void;
  onHashtagsChange: (value: string) => void;
  onMentionsChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onPostAltTextChange?: (index: number, value: string) => void;
  onReplacePostFile?: (index: number, file: File) => Promise<void> | void;
  onFileSelect: (file: File | null) => void;
  onPostFilesSelect?: (files: File[]) => void;
  onCoverSelect: (file: File | null) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {

  const galleryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const genericInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [showDrafts, setShowDrafts] = useState(initialShowDrafts);
  const [postStep, setPostStep] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const dialogRef = useComposerLifecycle(onClose, posting || editing);
  const [crop, setCrop] = useState<PostImageCrop>("original");
  const [rotation, setRotation] =
    useState<PostImageEditOptions["rotation"]>(0);
  const [filter, setFilter] = useState<PostImageFilter>("none");
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [analyzingAlt, setAnalyzingAlt] = useState(false);
  const [smartAltNote, setSmartAltNote] = useState("");

  const isVideo = Boolean(file?.type.startsWith("video/"));
  const tagged = useMemo(() => parseMentions(mentions), [mentions]);
  const safeActiveIndex = Math.min(
    activeIndex,
    Math.max(0, postPreviews.length - 1)
  );
  const activePreview = postPreviews[safeActiveIndex] || "";
  const activeFile = postFiles[safeActiveIndex] || null;
  const [nativeMediaSense, setNativeMediaSense] = useState(false);
  const altGeneration = useRef(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setNativeMediaSense(hasNativeMediaSense()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    altGeneration.current += 1;
    const timer = window.setTimeout(() => { setSmartAltNote(""); setAnalyzingAlt(false); }, 0);
    return () => { altGeneration.current += 1; window.clearTimeout(timer); };
  }, [activeFile]);

  function resetEditControls() {
    setCrop("original");
    setRotation(0);
    setFilter("none");
    setBrightness(100);
    setContrast(100);
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (posting) return;

    const files = Array.from(event.dataTransfer.files || []);
    if (mode === "post" && onPostFilesSelect) {
      onPostFilesSelect(files);
    } else {
      onFileSelect(files[0] || null);
    }
  }

  function pickPostFiles(files: File[]) {
    if (!onPostFilesSelect || posting) return;
    onPostFilesSelect(files);
  }

  function toggleTaggedPerson(person: Profile) {
    const username = person.username.toLowerCase();
    const next = new Set(tagged);
    if (next.has(username)) next.delete(username);
    else next.add(username);
    onMentionsChange([...next].map((item) => "@" + item).join(" "));
  }

  async function generateSmartAlt() {
    if (!activeFile || !onPostAltTextChange || analyzingAlt) return;

    const request = ++altGeneration.current;
    setAnalyzingAlt(true);
    setSmartAltNote("");
    nativeImpact("medium");

    try {
      const suggestion = await analyzeImageForAltText(activeFile);
      if (request !== altGeneration.current) return;
      if (!suggestion) {
        setSmartAltNote(
          "Smart Alt runs on-device in the AVENZO Android app. You can still write alt text manually."
        );
        return;
      }
      onPostAltTextChange(safeActiveIndex, suggestion.slice(0, 1000));
      setSmartAltNote("Suggested on-device. Review before publishing.");
    } catch {
      if (request === altGeneration.current) setSmartAltNote("Media Sense could not analyze this image.");
    } finally {
      if (request === altGeneration.current) setAnalyzingAlt(false);
    }
  }

  async function applyImageEdits() {
    if (!activeFile || !onReplacePostFile || editing) return;

    setEditing(true);
    try {
      const result = await editPostImage(activeFile, {
        crop,
        rotation,
        filter,
        brightness,
        contrast,
      });
      await onReplacePostFile(safeActiveIndex, result.file);
      resetEditControls();
    } finally {
      setEditing(false);
    }
  }

  const editorFilter = [
    `brightness(${brightness}%)`,
    `contrast(${contrast}%)`,
    filter === "vivid" ? "saturate(135%)" : "",
    filter === "mono" ? "grayscale(100%)" : "",
    filter === "warm" ? "sepia(10%) saturate(112%)" : "",
    filter === "cool" ? "saturate(105%) contrast(103%)" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const cropClass =
    crop === "square"
      ? "crop-square"
      : crop === "portrait"
        ? "crop-portrait"
        : crop === "landscape"
          ? "crop-landscape"
          : "crop-original";

  function handleFormSubmit(event: FormEvent) {
    if (posting || editing) { event.preventDefault(); return; }
    if (mode === "post" && postStep < 4) {
      event.preventDefault();
      if (postStep === 1 && postPreviews.length === 0) return;
      setPostStep((current) => Math.min(4, current + 1));
      return;
    }

    onSubmit(event);
  }

  function renderPostStep() {
    if (postStep === 1) {
      return (
        <section className="create-step-panel">
          <div className="create-step-copy">
            <span>STEP 1</span>
            <h3>Choose your media</h3>
            <p>Select from your gallery or capture a new photo.</p>
          </div>

          <div
            className={"upload-dropzone create-post-source " + (dragging ? "dragging" : "")}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
          >
            <Icon name="camera" size={30} />
            <b>{postPreviews.length ? postPreviews.length + " image(s) selected" : "Add photos"}</b>
            <span>Up to 10 images · JPEG, PNG, WebP or GIF · 25 MB each</span>

            <div className="create-source-actions">
              <button
                type="button"
                className="btn"
                disabled={posting}
                onClick={() => galleryInput.current?.click()}
              >
                Gallery
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={posting}
                onClick={() => cameraInput.current?.click()}
              >
                Camera
              </button>
            </div>
          </div>

          <input
            ref={galleryInput}
            type="file"
            hidden
            multiple
            accept="image/*"
            onChange={(event) => {
              pickPostFiles(Array.from(event.target.files || []));
              event.target.value = "";
            }}
          />
          <input
            ref={cameraInput}
            type="file"
            hidden
            accept="image/*"
            capture="environment"
            onChange={(event) => {
              const picked = event.target.files?.[0];
              if (picked) pickPostFiles([picked]);
              event.target.value = "";
            }}
          />

          {postPreviews.length > 0 && (
            <div className="create-carousel-preview create-step-thumbnails">
              {postPreviews.map((itemPreview, index) => (
                <button
                  type="button"
                  className={index === safeActiveIndex ? "active" : ""}
                  key={itemPreview}
                  onClick={() => setActiveIndex(index)}
                >
                  <UserMediaImage
                    src={itemPreview}
                    alt={"Selected image " + (index + 1)}
                    width={postDimensions[index]?.width}
                    height={postDimensions[index]?.height}
                    loading="eager"
                  />
                  <span>{index + 1}</span>
                </button>
              ))}
            </div>
          )}
          {postPreviews.length === 0 && <button type="button" className="btn secondary create-text-post-entry"
            disabled={posting || editing} onClick={() => setPostStep(3)}>
            <Icon name="edit" size={18} /> Write a text post instead
          </button>}
        </section>
      );
    }

    if (postStep === 2) {
      return (
        <section className="create-step-panel">
          <div className="create-step-copy">
            <span>STEP 2</span>
            <h3>Edit photo</h3>
            <p>Crop, rotate and tune the active image before publishing.</p>
          </div>

          <div className="create-editor-layout">
            <div className={"create-editor-preview " + cropClass}>
              {activePreview && (
                <UserMediaImage
                  src={activePreview}
                  alt={"Editing image " + (safeActiveIndex + 1)}
                  width={postDimensions[safeActiveIndex]?.width}
                  height={postDimensions[safeActiveIndex]?.height}
                  loading="eager"
                  className="create-editor-image"
                />
              )}
              <style>{`
                .create-editor-preview .create-editor-image {
                  transform: rotate(${rotation}deg);
                  filter: ${editorFilter};
                }
              `}</style>
            </div>

            {postPreviews.length > 1 && (
              <div className="create-editor-image-tabs">
                {postPreviews.map((itemPreview, index) => (
                  <button
                    type="button"
                    key={itemPreview}
                    className={index === safeActiveIndex ? "active" : ""}
                    disabled={editing || posting}
                    onClick={() => {
                      setActiveIndex(index);
                      resetEditControls();
                    }}
                  >
                    <UserMediaImage
                      src={itemPreview}
                      alt={"Image " + (index + 1)}
                      width={postDimensions[index]?.width}
                      height={postDimensions[index]?.height}
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="create-edit-tools">
              {onReplacePostFile && <NativePhotoStudio key={safeActiveIndex} file={activeFile} busy={editing || posting}
                onBusyChange={setEditing} onReplace={async (file) => {
                  await onReplacePostFile(safeActiveIndex, file); resetEditControls();
                }} />}

              <div className="create-edit-group">
                <b>Crop</b>
                <div className="create-edit-options">
                  {CROPS.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={crop === item.id ? "active" : ""}
                      onClick={() => setCrop(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="create-edit-group">
                <b>Rotate</b>
                <div className="create-edit-options">
                  <button
                    type="button"
                    onClick={() =>
                      setRotation((current) =>
                        ((current + 270) % 360) as PostImageEditOptions["rotation"]
                      )
                    }
                  >
                    ↺ Left
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setRotation((current) =>
                        ((current + 90) % 360) as PostImageEditOptions["rotation"]
                      )
                    }
                  >
                    Right ↻
                  </button>
                </div>
              </div>

              <div className="create-edit-group">
                <b>Filters</b>
                <div className="create-edit-options">
                  {FILTERS.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={filter === item.id ? "active" : ""}
                      onClick={() => setFilter(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="create-adjustment">
                <span>Brightness <b>{brightness}%</b></span>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={brightness}
                  onChange={(event) => setBrightness(Number(event.target.value))}
                />
              </label>

              <label className="create-adjustment">
                <span>Contrast <b>{contrast}%</b></span>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={contrast}
                  onChange={(event) => setContrast(Number(event.target.value))}
                />
              </label>

              <button
                type="button"
                className="btn create-apply-edits"
                disabled={!activeFile || editing}
                onClick={() => void applyImageEdits()}
              >
                {editing ? "Applying…" : "Apply edits to this image"}
              </button>
            </div>
          </div>
        </section>
      );
    }

    if (postStep === 3) {
      return (
        <section className="create-step-panel">
          <div className="create-step-copy">
            <span>STEP {postPreviews.length ? 3 : 2}</span>
            <h3>Add details</h3>
            <p>Caption, people, location and accessibility details.</p>
          </div>

          <label className="create-field">
            <span>Caption</span>
            <textarea
              value={caption}
              onChange={(event) => onCaptionChange(event.target.value.slice(0, 2200))}
              placeholder="Write a caption…"
              maxLength={2200}
            />
            <small>{caption.length}/2200</small>
          </label>

          <div className="create-meta-grid">
            <label className="create-field">
              <span>Hashtags</span>
              <input
                value={hashtags}
                onChange={(event) => onHashtagsChange(event.target.value.slice(0, 500))}
                placeholder="#avenzo"
              />
            </label>
            <label className="create-field create-location-field">
              <span>Location</span>
              <input
                value={location}
                onChange={(event) => onLocationChange(event.target.value.slice(0, 160))}
                placeholder="Add location"
                maxLength={160}
              />
            </label>
          </div>

          <div className="create-poll-section">
            <div className="create-collab-head">
              <div>
                <b>Poll</b>
                <span>Optional. Ask your AVENZO audience a question.</span>
              </div>
              {pollQuestion.trim() ? <small>Live poll</small> : <small>Optional</small>}
            </div>

            <label className="create-field">
              <span>Question</span>
              <input
                value={pollQuestion}
                onChange={(event) =>
                  onPollQuestionChange(event.target.value.slice(0, 180))
                }
                placeholder="Ask something…"
                maxLength={180}
              />
              <small>{pollQuestion.length}/180</small>
            </label>

            {pollQuestion.trim() && (
              <>
                <div className="create-poll-options">
                  {pollOptions.map((option, index) => (
                    <div key={"poll-option-" + index}>
                      <input
                        value={option}
                        maxLength={80}
                        placeholder={"Option " + (index + 1)}
                        onChange={(event) =>
                          onPollOptionsChange(
                            pollOptions.map((item, itemIndex) =>
                              itemIndex === index
                                ? event.target.value.slice(0, 80)
                                : item
                            )
                          )
                        }
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          aria-label={"Remove option " + (index + 1)}
                          onClick={() =>
                            onPollOptionsChange(
                              pollOptions.filter((_, itemIndex) => itemIndex !== index)
                            )
                          }
                        >
                          <Icon name="close" size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {pollOptions.length < 4 && (
                  <button
                    type="button"
                    className="create-poll-add"
                    onClick={() => onPollOptionsChange([...pollOptions, ""])}
                  >
                    <Icon name="plus" size={14} />
                    Add option
                  </button>
                )}

                <label className="create-field create-poll-duration">
                  <span>Poll duration</span>
                  <select
                    value={pollDurationHours === null ? "0" : String(pollDurationHours)}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      onPollDurationHoursChange(value > 0 ? value : null);
                    }}
                  >
                    <option value="1">1 hour</option>
                    <option value="6">6 hours</option>
                    <option value="24">24 hours</option>
                    <option value="72">3 days</option>
                    <option value="168">7 days</option>
                    <option value="0">No expiry</option>
                  </select>
                </label>
              </>
            )}
          </div>

          <div className="create-tag-section">
            <div className="create-collab-head">
              <div>
                <b>Tag people</b>
                <span>Tagged users are stored with the post and become searchable.</span>
              </div>
              <small>{tagged.length} tagged</small>
            </div>

            <div className="create-collab-list">
              {people.slice(0, 40).map((person) => {
                const selected = tagged.includes(person.username.toLowerCase());
                return (
                  <button
                    type="button"
                    key={person.id}
                    className={selected ? "selected" : ""}
                    onClick={() => toggleTaggedPerson(person)}
                  >
                    <AvatarImage
                      src={avatarFor(person)}
                      alt={person.display_name}
                      size={64}
                    />
                    <span>
                      <b className="verified-line">
                        {person.display_name}
                        <VerifiedBadge verified={person.verified} />
                      </b>
                      <small>@{person.username}</small>
                    </span>
                    <i>{selected ? "✓" : "+"}</i>
                  </button>
                );
              })}
            </div>
          </div>

          <ImageTextScan file={activeFile} busy={posting} caption={caption} onCaptionChange={onCaptionChange} />

          {postPreviews.length > 0 && (
            <div className="create-alt-section">
              <div className="create-collab-head">
                <div>
                  <b>Alt text</b>
                  <span>Optional description for people using screen readers.</span>
                </div>
                <div className="create-alt-head-actions">
                  <small>Image {safeActiveIndex + 1}/{postPreviews.length}</small>
                  {nativeMediaSense && <button
                    type="button"
                    className="create-smart-alt"
                    disabled={!activeFile || analyzingAlt}
                    onClick={() => void generateSmartAlt()}
                    title="On-device in the AVENZO Android app"
                  >
                    <Icon name="eye" size={15} />
                    {analyzingAlt ? "Scanning…" : "Smart Alt"}
                  </button>}
                </div>
              </div>

              <div className="create-alt-layout">
                <div className="create-alt-thumbnails">
                  {postPreviews.map((itemPreview, index) => (
                    <button
                      type="button"
                      key={itemPreview}
                      className={index === safeActiveIndex ? "active" : ""}
                      onClick={() => setActiveIndex(index)}
                    >
                      <UserMediaImage
                        src={itemPreview}
                        alt={"Image " + (index + 1)}
                        width={postDimensions[index]?.width}
                        height={postDimensions[index]?.height}
                      />
                    </button>
                  ))}
                </div>
                <label className="create-field">
                  <span>Alt text for image {safeActiveIndex + 1}</span>
                  <textarea
                    value={postAltTexts[safeActiveIndex] || ""}
                    onChange={(event) =>
                      onPostAltTextChange?.(
                        safeActiveIndex,
                        event.target.value.slice(0, 1000)
                      )
                    }
                    placeholder="Describe what is visible in this image."
                    maxLength={1000}
                  />
                  <small>{(postAltTexts[safeActiveIndex] || "").length}/1000</small>
                  {smartAltNote && <em className="create-smart-alt-note">{smartAltNote}</em>}
                </label>
              </div>
            </div>
          )}

          <div className="create-collab-section">
            <div className="create-collab-head">
              <div>
                <b>Collaborators</b>
                <span>Optional. Invite up to 3 AVENZO users to collaborate.</span>
              </div>
              <small>{collaboratorIds.length}/3</small>
            </div>

            <div className="create-collab-list">
              {people.slice(0, 30).map((person) => {
                const selected = collaboratorIds.includes(person.id);
                return (
                  <button
                    type="button"
                    key={person.id}
                    className={selected ? "selected" : ""}
                    disabled={!selected && collaboratorIds.length >= 3}
                    onClick={() => onToggleCollaborator(person.id)}
                  >
                    <AvatarImage
                      src={avatarFor(person)}
                      alt={person.display_name}
                      size={64}
                    />
                    <span>
                      <b>{person.display_name}</b>
                      <small>@{person.username}</small>
                    </span>
                    <i>{selected ? "✓" : "+"}</i>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="create-step-panel">
        <div className="create-step-copy">
          <span>STEP {postPreviews.length ? 4 : 3}</span>
          <h3>Review & publish</h3>
          <p>Check your post before it goes live.</p>
        </div>

        <div className="create-review-card">
          <div className="composer-author">
            <AvatarImage
              src={avatarFor(profile)}
              alt={profile.display_name}
              size={72}
            />
            <div>
              <b>{profile.display_name}</b>
              <small>@{profile.username}</small>
            </div>
          </div>

          <div className="create-review-grid">
            {postPreviews.map((itemPreview, index) => (
              <UserMediaImage
                key={itemPreview}
                src={itemPreview}
                alt={postAltTexts[index] || "Post image " + (index + 1)}
                width={postDimensions[index]?.width}
                height={postDimensions[index]?.height}
                loading="eager"
              />
            ))}
          </div>

          {caption && <p className="create-review-caption">{caption}</p>}

          {pollQuestion.trim() && (
            <div className="create-review-poll">
              <b>{pollQuestion}</b>
              {pollOptions.filter((option) => option.trim()).map((option) => (
                <span key={option}>{option}</span>
              ))}
            </div>
          )}

          <div className="create-review-meta">
            {tagged.length > 0 && <span>{tagged.length} tagged</span>}
            {location && <span>{location}</span>}
            {hashtags.trim() && <span>{hashtags}</span>}
          </div>
        </div>
      </section>
    );
  }

  function renderVideoOrStoryComposer() {
    return (
      <>
        <div
          className={"upload-dropzone " + (dragging ? "dragging" : "")}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          onClick={() => !posting && genericInput.current?.click()}
          role="button"
          tabIndex={0}
        >
          <Icon name={mode === "reel" ? "reels" : "camera"} size={26} />
          <b>
            {file
              ? file.name
              : mode === "reel"
                ? "Choose a vertical video"
                : "Choose an image or video"}
          </b>
          <span>
            {mode === "reel"
              ? "Portrait video only · up to 25 MB"
              : "JPEG, PNG, WebP, GIF, MP4, WebM or MOV · up to 25 MB"}
          </span>
          <button type="button" className="btn secondary small" disabled={posting}>
            Choose file
          </button>
          <input
            ref={genericInput}
            type="file"
            hidden
            accept={mode === "reel" ? "video/*" : "image/*,video/*"}
            onChange={(event) => {
              onFileSelect(event.target.files?.[0] || null);
              event.target.value = "";
            }}
          />
        </div>

        {preview &&
          (isVideo ? (
            <div className={"upload-preview-frame " + (mode === "reel" ? "vertical" : "")}>
              <video
                src={preview}
                controls
                muted
                playsInline
                preload="metadata"
                className="upload-preview"
              />
            </div>
          ) : (
            <UserMediaImage
              src={preview}
              className="upload-preview"
              alt={mode === "story" ? "Story preview" : "Preview"}
              width={dimensions?.width}
              height={dimensions?.height}
              loading="eager"
            />
          ))}

        {dimensions && (
          <div className="upload-dimensions">
            {dimensions.width} × {dimensions.height}
            {mode === "reel" && (
              <span>
                {dimensions.height > dimensions.width
                  ? " · Vertical ✓"
                  : " · Needs portrait orientation"}
              </span>
            )}
          </div>
        )}

        {mode === "reel" && (
          <label className="create-field">
            <span>Title</span>
            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value.slice(0, 120))}
              placeholder="Give your reel a title"
              maxLength={120}
            />
          </label>
        )}

        <label className="create-field">
          <span>Caption</span>
          <textarea
            value={caption}
            onChange={(event) => onCaptionChange(event.target.value.slice(0, 2200))}
            placeholder={mode === "reel" ? "Tell people about this reel…" : "Add a story caption…"}
            maxLength={2200}
          />
          <small>{caption.length}/2200</small>
        </label>

        <div className="create-meta-grid">
          <label className="create-field">
            <span>Hashtags</span>
            <input
              value={hashtags}
              onChange={(event) => onHashtagsChange(event.target.value.slice(0, 500))}
              placeholder="#avenzo #video"
            />
          </label>
          <label className="create-field">
            <span>Mentions</span>
            <input
              value={mentions}
              onChange={(event) => onMentionsChange(event.target.value.slice(0, 500))}
              placeholder="@username"
            />
          </label>
          <label className="create-field create-location-field">
            <span>Location</span>
            <input
              value={location}
              onChange={(event) => onLocationChange(event.target.value.slice(0, 160))}
              placeholder="Add location"
              maxLength={160}
            />
          </label>
        </div>

        {isVideo && (
          <div className="cover-picker">
            <div>
              <b>Cover image</b>
              <span>Optional thumbnail shown before the video is ready.</span>
            </div>
            <button
              type="button"
              className="btn secondary small"
              onClick={() => coverInput.current?.click()}
              disabled={posting}
            >
              {coverFile ? "Change cover" : "Choose cover"}
            </button>
            <input
              ref={coverInput}
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                onCoverSelect(event.target.files?.[0] || null);
                event.target.value = "";
              }}
            />
            {coverPreview && (
              <UserMediaImage
                className="cover-preview"
                src={coverPreview}
                alt="Video cover preview"
                loading="eager"
              />
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <div ref={dialogRef} tabIndex={-1} className="modal" role="dialog" aria-modal="true" aria-label={"Create " + mode}>
      <form
        className="modal-box create-modal create-upload-panel"
        onSubmit={handleFormSubmit}
      >
        <div className="modal-header">
          <div>
            <div className="eyebrow">CREATE SOMETHING</div>
            <h2>
              {mode === "post"
                ? "Create post"
                : mode === "reel"
                  ? "New Clip"
                  : "New Moment"}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
            disabled={posting || editing}
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="create-scroll-area">
        <div className="create-draft-toolbar">
          <button
            type="button"
            className="create-save-draft"
            disabled={posting}
            onClick={() => void onSaveDraft()}
          >
            <Icon name="saved" size={16} />
            {activeDraftId ? "Update draft" : "Save draft"}
          </button>
          <button
            type="button"
            className={showDrafts ? "active" : ""}
            onClick={() => setShowDrafts((current) => !current)}
          >
            Drafts
            {drafts.length > 0 && <b>{drafts.length}</b>}
          </button>
        </div>

        {showDrafts && (
          <div className="create-drafts-panel">
            {drafts.length === 0 ? (
              <p>No saved drafts on this device yet.</p>
            ) : (
              drafts.map((draft) => (
                <article
                  key={draft.id}
                  className={draft.id === activeDraftId ? "active" : ""}
                >
                  <button
                    type="button"
                    className="create-draft-open"
                    onClick={() => {
                      void onRestoreDraft(draft);
                      setShowDrafts(false);
                      setPostStep(draft.mode === "post" && !(draft.postMedia?.length || draft.file) ? 3 : 1);
                    }}
                  >
                    <span>{draft.mode === "story" ? "Moment" : draft.mode === "reel" ? "Clip" : "Post"}</span>
                    <b>{draft.title || draft.caption || "Untitled draft"}</b>
                    <small>{new Date(draft.updatedAt).toLocaleString()}</small>
                  </button>
                  <button
                    type="button"
                    className="create-draft-delete"
                    aria-label="Delete draft"
                    onClick={() => void onDeleteDraft(draft.id)}
                  >
                    <Icon name="close" size={15} />
                  </button>
                </article>
              ))
            )}
          </div>
        )}

        <div className="create-type-tabs" role="tablist" aria-label="Content type">
          {(["post", "reel", "story"] as const).map((nextMode) => (
            <button
              key={nextMode}
              type="button"
              className={mode === nextMode ? "active" : ""}
              onClick={() => {
                setPostStep(1);
                setActiveIndex(0);
                resetEditControls();
                onModeChange(nextMode);
              }}
              disabled={posting || editing}
            >
              {nextMode === "post" ? "Post" : nextMode === "reel" ? "Reel" : "Story"}
            </button>
          ))}
        </div>

        {mode === "post" && (
          <div className="create-stepper" aria-label="Post creation progress">
            {(postPreviews.length === 0 && postStep >= 3
              ? [{ label:"Format", number:1 }, { label:"Details", number:3 }, { label:"Publish", number:4 }]
              : [{ label:"Media", number:1 }, { label:"Edit", number:2 }, { label:"Details", number:3 }, { label:"Publish", number:4 }]).map(({ label, number }, index) => {
              return (
                <button
                  type="button"
                  key={label}
                  className={
                    number === postStep
                      ? "active"
                      : number < postStep
                        ? "complete"
                        : ""
                  }
                  disabled={posting || editing || number > postStep + 1}
                  onClick={() => {
                    if (number <= postStep || (number === postStep + 1 && (postPreviews.length || caption.trim()))) {
                      setPostStep(number);
                    }
                  }}
                >
                  <i>{number < postStep ? "✓" : index + 1}</i>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        )}

        {mode === "post" ? renderPostStep() : renderVideoOrStoryComposer()}

        {posting && (
          <div className="upload-progress" aria-live="polite">
            <div>
              <b>{uploadProgress < 90 ? "Uploading media" : "Finishing publish"}</b>
              <span>{Math.max(0, Math.min(100, uploadProgress))}%</span>
            </div>
            <progress
              max={100}
              value={Math.max(0, Math.min(100, uploadProgress))}
            />
            <small>Keep AVENZO open until publishing finishes.</small>
          </div>
        )}
        </div>

        <div className="modal-actions create-wizard-actions">
          {mode === "post" ? (
            <>
              {postStep > 1 ? (
                <button
                  type="button"
                  className="btn secondary"
                  disabled={posting || editing}
                  onClick={() => setPostStep((current) => current === 3 && !postPreviews.length ? 1 : Math.max(1, current - 1))}
                >
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={onClose}
                  disabled={posting}
                >
                  Cancel
                </button>
              )}

              <button
                className="btn"
                disabled={
                  posting ||
                  editing ||
                  (postPreviews.length === 0 && (postStep < 3 || !caption.trim()))
                }
              >
                {posting
                  ? "Publishing…"
                  : postStep < 4
                    ? "Continue"
                    : "Publish Post"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn secondary"
                onClick={onClose}
                disabled={posting}
              >
                Cancel
              </button>
              <button
                className="btn"
                disabled={
                  posting ||
                  (mode === "reel" &&
                    (!file || !dimensions || dimensions.height <= dimensions.width)) ||
                  (mode === "story" && !file)
                }
              >
                {posting
                  ? "Publishing…"
                  : mode === "reel"
                    ? "Publish Reel"
                    : "Publish Story"}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
