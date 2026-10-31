import { describe, expect, it } from 'vitest';

import {
  CYCLE_TICKS,
  GAUGE_LIMIT,
  SENSOR_COUNT,
  STOP_INDEX,
  cellState,
  gaugeFrame,
  scanFrame,
} from '../../../src/features/briefing/visualModel';

describe('early-exit scan model', () => {
  it('has 40 sensors and stops at cell #7 (index 6)', () => {
    expect(SENSOR_COUNT).toBe(40);
    expect(STOP_INDEX).toBe(6);
  });

  it('starts scanning at the first cell with nothing checked', () => {
    const frame = scanFrame(0);
    expect(frame.scannerIndex).toBe(0);
    expect(frame.stopped).toBe(false);
    expect(cellState(0, frame)).toBe('scanning');
    expect(cellState(1, frame)).toBe('idle');
  });

  it('marks checked cells ok while the scanner advances', () => {
    const frame = scanFrame(3);
    expect(cellState(0, frame)).toBe('ok');
    expect(cellState(2, frame)).toBe('ok');
    expect(cellState(3, frame)).toBe('scanning');
  });

  it('stops on the over-limit cell and leaves the rest unchecked', () => {
    const frame = scanFrame(STOP_INDEX);
    expect(frame.stopped).toBe(true);
    expect(cellState(STOP_INDEX, frame)).toBe('over');
    expect(cellState(STOP_INDEX - 1, frame)).toBe('ok');
    expect(cellState(STOP_INDEX + 1, frame)).toBe('idle');
    expect(cellState(SENSOR_COUNT - 1, frame)).toBe('idle');
  });

  it('holds the stopped frame, then loops back to the start', () => {
    expect(scanFrame(CYCLE_TICKS - 1)).toEqual(scanFrame(STOP_INDEX));
    expect(scanFrame(CYCLE_TICKS)).toEqual(scanFrame(0));
    expect(scanFrame(CYCLE_TICKS * 3 + 2)).toEqual(scanFrame(2));
  });
});

describe('gauge model', () => {
  it('shows below, equal and above the limit; only above raises the alarm', () => {
    const frames = [0, 1, 2].map(gaugeFrame);
    expect(frames.map((frame) => frame.alarm)).toEqual([false, false, true]);
    expect(frames[1].reading).toBe(GAUGE_LIMIT);
    expect(frames[2].reading).toBeGreaterThan(GAUGE_LIMIT);
    expect(frames[0].reading).toBeLessThan(GAUGE_LIMIT);
  });

  it('loops', () => {
    expect(gaugeFrame(3)).toEqual(gaugeFrame(0));
  });
});
