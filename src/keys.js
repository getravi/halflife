/**
 * The runner keymap, as one pure function. No DOM access and no side effects,
 * so the whole decision surface is a test table rather than logic buried in an
 * event handler.
 */
const GRADES = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };

export function keyAction(event, { revealed, typing }) {
  const { key } = event;

  if (typing) {
    // Cmd/Ctrl+Enter reveals without leaving the box.
    if (key === 'Enter' && (event.metaKey || event.ctrlKey)) return 'reveal';
    // Escape leaves the box. It does not close the runner: losing a
    // half-typed recall to a reflex Escape is a bad trade.
    if (key === 'Escape') return 'blur';
    // Everything else is a character the user is trying to type.
    return null;
  }

  if (key === 'Escape') return 'close';

  if (!revealed) {
    if (key === ' ' || key === 'Enter') return 'reveal';
    // Digits do nothing before reveal — you cannot grade a card you have not
    // looked at, and a stray keypress must not push one a week away.
    return null;
  }

  return GRADES[key] ?? null;
}
