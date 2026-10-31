/**
 * The editor: a textarea with a synchronized line-number gutter.
 *
 * Deliberately not CodeMirror or Monaco (docs/07-architecture.md §8). The
 * decision is revisited at M3 with a trigger: only if playtesting shows editor
 * mechanics causing avoidable errors. `Cmd/Ctrl+Enter` runs.
 */

import { useRef } from 'react';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  disabled: boolean;
}

const INDENT = '  ';

export function Editor({ value, onChange, onRun, disabled }: EditorProps) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const lines = value.split('\n').length;

  return (
    <div className="editor">
      <div className="editor__gutter" aria-hidden="true" ref={gutterRef}>
        {Array.from({ length: lines }, (_, index) => (
          <span key={index}>{index + 1}</span>
        ))}
      </div>
      <textarea
        className="editor__area"
        aria-label="Código"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (gutterRef.current !== null) {
            gutterRef.current.scrollTop = event.currentTarget.scrollTop;
          }
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            if (!disabled) onRun();
            return;
          }
          if (event.key === 'Tab') {
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
