import { describe, expect, it } from 'vitest';

import { splitAtFirstDifference } from '../../../src/features/lab/diffText';

describe('splitAtFirstDifference', () => {
  it('marks nothing when the texts are equal', () => {
    expect(splitAtFirstDifference('[1, 2]', '[1, 2]')).toEqual({ same: '[1, 2]', rest: '' });
  });

  it('marks from the first differing item', () => {
    expect(splitAtFirstDifference('[1, 2, 4]', '[1, 2, 3]')).toEqual({ same: '[1, 2, ', rest: '4]' });
  });

  it('marks the whole number, not just its last digit', () => {
    expect(splitAtFirstDifference('[12]', '[13]')).toEqual({ same: '[', rest: '12]' });
  });

  it('marks the extra tail when one text is a prefix of the other', () => {
    expect(splitAtFirstDifference('[1, 2, 3]', '[1, 2]')).toEqual({ same: '[1, 2', rest: ', 3]' });
  });
});
