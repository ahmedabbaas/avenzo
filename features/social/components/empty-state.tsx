export default function EmptyState({
  title,
  text,
  action,
  actionLabel,
  secondaryAction,
  secondaryActionLabel,
}: {
  title: string;
  text: string;
  action?: () => void;
  actionLabel?: string;
  secondaryAction?: () => void;
  secondaryActionLabel?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">A</span>
      <b>{title}</b>
      <p>{text}</p>
      {(action && actionLabel) || (secondaryAction && secondaryActionLabel) ? (
        <div className="empty-actions">
          {action && actionLabel && (
            <button className="btn" onClick={action}>
              {actionLabel}
            </button>
          )}
          {secondaryAction && secondaryActionLabel && (
            <button className="btn secondary" onClick={secondaryAction}>
              {secondaryActionLabel}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

