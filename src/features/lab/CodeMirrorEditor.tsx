/**
 * CodeMirror 6 editor. Imported lazily by `Editor.tsx`, so it lands in its own
 * chunk. Same props contract as the plain textarea.
 *
 * Keyboard accessibility: Tab indents (code editing), so keyboard-only users
 * would be trapped. Pressing Escape arms an escape hatch: the next Tab or
 * Shift+Tab moves focus out of the editor instead of indenting.
 */

import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentLess, indentMore } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import {
  HighlightStyle,
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { Compartment, EditorState, Prec, StateEffect, StateField } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { useEffect, useRef } from 'react';

import type { EditorProps } from './Editor';

/** The line the trace is on. Set from outside, never edited by the player. */
const setTraceLine = StateEffect.define<number | null>();
const traceLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    for (const effect of transaction.effects) {
      if (!effect.is(setTraceLine)) continue;
      const line = effect.value;
      if (line === null || line < 1 || line > transaction.state.doc.lines) return Decoration.none;
      const from = transaction.state.doc.line(line).from;
      return Decoration.set([Decoration.line({ class: 'cm-trace-line' }).range(from)]);
    }
    return decorations.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const theme = EditorView.theme(
  {
    '&': {
      height: '100%',
      color: 'var(--text)',
      backgroundColor: 'var(--surface-sunken)',
      fontSize: '0.8125rem',
    },
    '&.cm-focused': { outline: '2px solid var(--structure)', outlineOffset: '-2px' },
    '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6', overflow: 'auto' },
    '.cm-content': {
      padding: '1rem 0',
      caretColor: 'var(--text)',
      fontVariantLigatures: 'none',
      fontFeatureSettings: '"liga" 0, "calt" 0',
    },
    '.cm-cursor': { borderLeftColor: 'var(--text)' },
    '.cm-gutters': {
      backgroundColor: 'var(--surface-sunken)',
      color: '#55606c',
      border: 'none',
      borderRight: '1px solid var(--border)',
    },
    '.cm-trace-line': {
      backgroundColor: 'rgba(210, 153, 34, 0.2)',
      boxShadow: 'inset 3px 0 0 var(--attention)',
    },
    '.cm-activeLine': { backgroundColor: 'rgba(88, 166, 255, 0.07)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(88, 166, 255, 0.07)', color: 'var(--text-muted)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(88, 166, 255, 0.28)',
    },
    '&.cm-focused .cm-matchingBracket': {
      backgroundColor: 'rgba(63, 185, 80, 0.25)',
      outline: '1px solid rgba(63, 185, 80, 0.6)',
    },
    '&.cm-focused .cm-nonmatchingBracket': { backgroundColor: 'rgba(210, 153, 34, 0.3)' },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword], color: '#ff7b72' },
  { tag: [tags.string, tags.special(tags.string)], color: '#a5d6ff' },
  { tag: [tags.number, tags.bool, tags.null], color: '#d29922' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: '#6e7b88', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#d2a8ff' },
  { tag: [tags.definition(tags.variableName), tags.definition(tags.function(tags.variableName))], color: '#79c0ff' },
  { tag: tags.propertyName, color: '#e6edf3' },
  { tag: [tags.operator, tags.punctuation], color: '#8b98a5' },
]);

export default function CodeMirrorEditor({
  value,
  onChange,
  onRun,
  disabled,
  highlightLine = null,
}: EditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const latest = useRef({ onChange, onRun, disabled });
  latest.current = { onChange, onRun, disabled };
  const lock = useRef(new Compartment());

  useEffect(() => {
    if (host.current === null) return;
    let escapeArmed = false;

    // Returning false lets the browser move focus; true keeps the editor in charge.
    const tab = (command: (target: EditorView) => boolean) => (target: EditorView) => {
      if (escapeArmed) {
        escapeArmed = false;
        return false;
      }
      return command(target);
    };

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        traceLineField,
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        javascript(),
        syntaxHighlighting(highlight),
        theme,
        EditorView.contentAttributes.of({
          'aria-label': 'Código',
          spellcheck: 'false',
          autocapitalize: 'off',
          autocorrect: 'off',
        }),
        EditorView.domEventHandlers({
          blur: () => {
            escapeArmed = false;
            return false;
          },
        }),
        Prec.highest(
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                if (!latest.current.disabled) latest.current.onRun();
                return true;
              },
            },
            {
              key: 'Escape',
              run: () => {
                escapeArmed = true;
                return true;
              },
            },
            { key: 'Tab', run: tab(indentMore), shift: tab(indentLess) },
          ]),
        ),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
        lock.current.of([
          EditorState.readOnly.of(latest.current.disabled),
          EditorView.editable.of(!latest.current.disabled),
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) latest.current.onChange(update.state.doc.toString());
        }),
      ],
    });

    const instance = new EditorView({ state, parent: host.current });
    view.current = instance;
    return () => {
      instance.destroy();
      view.current = null;
    };
    // The view is created once; value/disabled are synced by the effects below.
  }, []);

  useEffect(() => {
    const instance = view.current;
    if (instance === null) return;
    if (instance.state.doc.toString() !== value) {
      instance.dispatch({ changes: { from: 0, to: instance.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({
      effects: lock.current.reconfigure([
        EditorState.readOnly.of(disabled),
        EditorView.editable.of(!disabled),
      ]),
    });
  }, [disabled]);

  // Mark the trace's current line and bring it into view.
  useEffect(() => {
    const instance = view.current;
    if (instance === null) return;
    const effects: StateEffect<unknown>[] = [setTraceLine.of(highlightLine)];
    if (highlightLine !== null && highlightLine >= 1 && highlightLine <= instance.state.doc.lines) {
      effects.push(EditorView.scrollIntoView(instance.state.doc.line(highlightLine).from, { y: 'nearest' }));
    }
    instance.dispatch({ effects });
  }, [highlightLine]);

  return <div className="editor editor--cm" ref={host} />;
}
