import { describe, expect, it, vi } from 'vitest';

import { createMissionLoader } from '../../../src/domain/content/mission-loader';
import { loadMission } from '../../support/content';

describe('createMissionLoader', () => {
  it('fetches a mission through its importer and validates its shape', async () => {
    const m01 = await loadMission('M01');
    const importer = vi.fn(() => Promise.resolve(m01));
    const loader = createMissionLoader({ M01: importer });

    const loaded = await loader.load('M01');

    expect(loaded.id).toBe('M01');
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it('caches a successful load', async () => {
    const m01 = await loadMission('M01');
    const importer = vi.fn(() => Promise.resolve(m01));
    const loader = createMissionLoader({ M01: importer });

    await loader.load('M01');
    await loader.load('M01');

    expect(importer).toHaveBeenCalledTimes(1);
    expect(loader.peek('M01')?.id).toBe('M01');
  });

  it('does not cache a failed load, so retry hits the network again', async () => {
    const m01 = await loadMission('M01');
    const importer = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValueOnce(m01);
    const loader = createMissionLoader({ M01: importer });

    await expect(loader.load('M01')).rejects.toThrow('chunk failed');
    expect(loader.peek('M01')).toBeNull();
    await expect(loader.load('M01')).resolves.toMatchObject({ id: 'M01' });
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('rejects an id with no importer', async () => {
    const loader = createMissionLoader({});
    await expect(loader.load('M99')).rejects.toThrow(/M99/);
  });

  it('rejects a payload that is not a valid mission', async () => {
    const loader = createMissionLoader({ M01: () => Promise.resolve({ id: 'M01' }) });
    await expect(loader.load('M01')).rejects.toThrow(/M01/);
  });

  it('rejects a payload whose id differs from the requested one', async () => {
    const m01 = await loadMission('M01');
    const loader = createMissionLoader({ M02: () => Promise.resolve(m01) });
    await expect(loader.load('M02')).rejects.toThrow(/M02/);
  });
});
