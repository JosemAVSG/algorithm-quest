/**
 * The editor shell (docs/07-architecture.md §8).
 *
 * CodeMirror 6 is loaded on demand so the main bundle does not pay for it. While
 * it loads, or if the chunk fails to load, a plain textarea with the same
 * accessible name and the same props contract keeps the lab fully usable.
 */

import { Component, lazy, Suspense, useState, type ReactNode } from 'react';

export interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  disabled: boolean;
}

const INDENT = '  ';

export function PlainEditor({ value, onChange, onRun, disabled }: EditorProps) {
  return (
    <div className="editor editor--plain">
      <textarea
        className="editor__area"
        aria-label="Código"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            if (!disabled) onRun();
            return;
          }
          if (event.key === 'Tab' && !event.shiftKey) {
            event.preventDefault();
            const target = event.currentTarget;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            onChange(`${value.slice(0, start)}${INDENT}${value.slice(end)}`);
            requestAnimationFrame(() => {
              target.selectionStart = start + INDENT.length;
              target.selectionEnd = start + INDENT.length;
            });
          }
        }}
      />
    </div>
  );
}

/** A failed chunk import rejects the lazy component, which the boundary catches. */
const RichEditorLazy = lazy(() => import('./CodeMirrorEditor'));

class RichEditorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    this.props.onError();
  }

  override render() {
    // The parent swaps to the plain editor on error; render nothing meanwhile.
    return this.state.failed ? null : this.props.children;
  }
}

export function Editor(props: EditorProps) {
  const [failed, setFailed] = useState(false);

  if (failed) return <PlainEditor {...props} />;

  return (
    <RichEditorBoundary onError={() => setFailed(true)}>
      <Suspense fallback={<PlainEditor {...props} />}>
        <RichEditorLazy {...props} />
      </Suspense>
    </RichEditorBoundary>
  );
}
