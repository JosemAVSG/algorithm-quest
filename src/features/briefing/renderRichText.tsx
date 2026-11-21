/**
 * Minimal, dependency-free renderer for mission prose. Supports paragraphs,
 * **bold**, ordered lists ("1. ") and unordered lists ("- " / "* ").
 * It builds React nodes only, so any other markup stays inert text.
 */

import type { ReactNode } from 'react';

const ORDERED = /^\s*\d+\.\s+(.*)$/;
const UNORDERED = /^\s*[-*]\s+(.*)$/;

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  text.split(/(\*\*[^*]+\*\*)/).forEach((part, index) => {
    if (part === '') return;
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      out.push(<strong key={index}>{part.slice(2, -2)}</strong>);
    } else {
      out.push(part);
    }
  });
  return out;
}

export function renderRichText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];

  text
    .split(/\n{2,}/)
    .filter((block) => block.trim() !== '')
    .forEach((block, blockIndex) => {
      let paragraph: string[] = [];
      let list: { ordered: boolean; items: string[] } | null = null;

      const flushParagraph = () => {
        if (paragraph.length === 0) return;
        nodes.push(<p key={`${blockIndex}-p${nodes.length}`}>{renderInline(paragraph.join(' '))}</p>);
        paragraph = [];
      };
      const flushList = () => {
        if (list === null) return;
        const items = list.items.map((item, i) => <li key={i}>{renderInline(item)}</li>);
        nodes.push(
          list.ordered ? (
            <ol key={`${blockIndex}-l${nodes.length}`}>{items}</ol>
          ) : (
            <ul key={`${blockIndex}-l${nodes.length}`}>{items}</ul>
          ),
        );
        list = null;
      };

      for (const line of block.split('\n')) {
        const ordered = ORDERED.exec(line);
        const unordered = ordered === null ? UNORDERED.exec(line) : null;
        const match = ordered ?? unordered;
        if (match === null) {
          flushList();
          if (line.trim() !== '') paragraph.push(line.trim());
          continue;
        }
        flushParagraph();
        const isOrdered = ordered !== null;
        if (list !== null && list.ordered !== isOrdered) flushList();
        if (list === null) list = { ordered: isOrdered, items: [] };
        list.items.push(match[1] ?? '');
      }
      flushParagraph();
      flushList();
    });

  return nodes;
}
