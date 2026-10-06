"use client";

import { createPortal } from "react-dom";
import Icon, { type IconName } from "../features/social/components/icon";
import { useComposerLifecycle } from "../features/social/lib/use-composer-lifecycle";

export type CreateDestination = "post" | "story" | "reel" | "drafts";

const OPTIONS: Array<{ id: CreateDestination; title: string; description: string; icon: IconName }> = [
  { id: "post", title: "Post", description: "Photos, a carousel or a thought", icon: "grid" },
  { id: "story", title: "Moment", description: "A glimpse that lasts 24 hours", icon: "clock" },
  { id: "reel", title: "Clip", description: "A short video, your way", icon: "play" },
  { id: "drafts", title: "Drafts", description: "Continue something you started", icon: "edit" },
];

export default function CreateLauncher({ onClose, onSelect }: {
  onClose: () => void;
  onSelect: (destination: CreateDestination) => void;
}) {
  const dialogRef = useComposerLifecycle(onClose, false);

  return createPortal(
    <div className="modal create-launcher-overlay" ref={dialogRef} tabIndex={-1}
      role="dialog" aria-modal="true" aria-labelledby="create-launcher-title"
      aria-describedby="create-launcher-description"
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="create-launcher-sheet">
        <header>
          <div><h2 id="create-launcher-title">Create</h2>
            <p id="create-launcher-description">Make something worth sharing.</p></div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={22} />
          </button>
        </header>
        <div className="create-launcher-options">
          {OPTIONS.map(option => <button type="button" key={option.id}
            onClick={() => onSelect(option.id)}>
            <span className="create-launcher-icon" aria-hidden="true"><Icon name={option.icon} size={23} /></span>
            <span className="create-launcher-copy"><strong>{option.title}</strong><small>{option.description}</small></span>
            <span className="create-launcher-chevron" aria-hidden="true"><Icon name="back" size={18} /></span>
          </button>)}
        </div>
        <footer>Drafts are saved on this device.</footer>
      </section>
    </div>, document.body
  );
}
