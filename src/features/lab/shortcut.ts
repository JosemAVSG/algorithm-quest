/** The label of the run shortcut for this platform (Cmd+Enter on Apple, Ctrl+Enter elsewhere). */
export function runShortcutLabel(platform: string): string {
  return /mac|iphone|ipad|ipod/i.test(platform) ? '⌘↵' : 'Ctrl+Enter';
}

export function currentRunShortcut(): string {
  return runShortcutLabel(typeof navigator === 'undefined' ? '' : navigator.platform);
}
