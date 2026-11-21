/** Padlock for locked nodes. Decorative: the node's text and aria-label carry the meaning. */
export function LockIcon() {
  return (
    <svg className="lock-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
