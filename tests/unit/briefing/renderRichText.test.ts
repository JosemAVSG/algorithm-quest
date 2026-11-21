import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { renderRichText } from '../../../src/features/briefing/renderRichText';

const html = (text: string) => renderToStaticMarkup(createElement(Fragment, null, ...renderRichText(text)));

describe('renderRichText', () => {
  it('splits paragraphs on blank lines', () => {
    expect(html('uno\n\ndos')).toBe('<p>uno</p><p>dos</p>');
  });

  it('renders **bold** as strong', () => {
    expect(html('Hay **tres** sensores')).toBe('<p>Hay <strong>tres</strong> sensores</p>');
  });

  it('renders ordered lists written on single newlines', () => {
    expect(html('Pasos:\n1. abrir\n2. cerrar')).toBe(
      '<p>Pasos:</p><ol><li>abrir</li><li>cerrar</li></ol>',
    );
  });

  it('renders unordered lists with - and *', () => {
    expect(html('- a\n* **b**')).toBe('<ul><li>a</li><li><strong>b</strong></li></ul>');
  });

  it('keeps markup inert as text', () => {
    const out = html('<script>alert(1)</script> **x**');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('leaves an unmatched ** literal', () => {
    expect(html('a ** b')).toBe('<p>a ** b</p>');
  });
});
