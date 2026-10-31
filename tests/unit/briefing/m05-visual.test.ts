import { describe, expect, it } from 'vitest';

import {
  COPY_CYCLE_TICKS,
  COPY_RECORDS,
  copyFrame,
  panelRow,
} from '../../../src/features/briefing/visuals/m05-model';

describe('M05 copy-rows model', () => {
  it('derives status and priority per record, 8 hours being normal', () => {
    expect(panelRow(COPY_RECORDS[0])).toEqual({ id: 'R1', status: 'closed', priority: 'high' });
    expect(panelRow(COPY_RECORDS[1])).toEqual({ id: 'R2', status: 'open', priority: 'normal' });
    expect(panelRow(COPY_RECORDS[2]).priority).toBe('normal');
    expect(panelRow(COPY_RECORDS[3])).toEqual({ id: 'R4', status: 'open', priority: 'high' });
  });

  it('adds one copy per record, in order, with none dropped', () => {
    expect(copyFrame(0).panel.map((row) => row.id)).toEqual(['R1']);
    expect(copyFrame(2).panel.map((row) => row.id)).toEqual(['R1', 'R2', 'R3']);
    const last = copyFrame(COPY_RECORDS.length);
    expect(last.panel).toHaveLength(COPY_RECORDS.length);
    expect(last.done).toBe(true);
  });

  it('holds the final frame and loops', () => {
    expect(copyFrame(COPY_CYCLE_TICKS - 1)).toEqual(copyFrame(COPY_RECORDS.length));
    expect(copyFrame(COPY_CYCLE_TICKS)).toEqual(copyFrame(0));
  });
});
