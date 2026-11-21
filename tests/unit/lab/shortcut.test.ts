import { describe, expect, it } from 'vitest';

import { runShortcutLabel } from '../../../src/features/lab/shortcut';

describe('runShortcutLabel', () => {
  it('shows the command symbols on Apple platforms', () => {
    expect(runShortcutLabel('MacIntel')).toBe('⌘↵');
    expect(runShortcutLabel('iPad')).toBe('⌘↵');
  });

  it('shows Ctrl+Enter everywhere else', () => {
    expect(runShortcutLabel('Win32')).toBe('Ctrl+Enter');
    expect(runShortcutLabel('Linux x86_64')).toBe('Ctrl+Enter');
    expect(runShortcutLabel('')).toBe('Ctrl+Enter');
  });
});
