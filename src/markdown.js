/**
 * Note rendering. Pure: body in, HTML string out, so it tests without a
 * browser like every other builder here.
 *
 * markdown-it runs on its defaults deliberately. Two of those defaults are
 * security properties rather than preferences: raw HTML in the source is
 * escaped rather than passed through, and javascript: URLs are refused. That
 * is the entire reason this library was chosen over the smaller one, and it
 * is why there is no sanitiser in this project. Do not set html: true, and do
 * not replace validateLink. Tests assert both.
 */
import MarkdownIt from 'markdown-it';

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Subtasks win ties: a name you typed is far more likely to be a title. */
export function resolveName(name, ctx) {
  const needle = String(name ?? '').trim().toLowerCase();
  if (!needle) return null;

  for (const [id, s] of ctx.index.subtasks) {
    if (String(s.title).toLowerCase() === needle) return { kind: 'subtask', id };
  }
  for (const t of ctx.path.terms ?? []) {
    if (String(t.term).toLowerCase() === needle) return { kind: 'term', term: t.term };
  }
  return null;
}

function wikilinkRule(state, silent) {
  const start = state.pos;
  if (state.src.charCodeAt(start) !== 0x5B) return false;      // [
  if (state.src.charCodeAt(start + 1) !== 0x5B) return false;  // [

  const close = state.src.indexOf(']]', start + 2);
  // An unterminated bracket is ordinary text. Returning true here would eat
  // the rest of the note.
  if (close < 0) return false;

  if (!silent) {
    const token = state.push('wikilink', '', 0);
    token.content = state.src.slice(start + 2, close);
  }
  state.pos = close + 2;
  return true;
}

const cache = new WeakMap();

function rendererFor(ctx) {
  if (cache.has(ctx)) return cache.get(ctx);

  const md = new MarkdownIt();
  md.inline.ruler.before('link', 'wikilink', wikilinkRule);

  md.renderer.rules.wikilink = (tokens, idx) => {
    const name = tokens[idx].content;
    const hit = resolveName(name, ctx);

    // Unresolved renders as what you typed. Titles get reworded, and a link
    // that has quietly rotted is worse than text showing you named something
    // that is not there.
    if (!hit) return `[[${esc(name)}]]`;

    if (hit.kind === 'subtask') {
      // sidebar.js already delegates on button[data-subtask-id]; this needs
      // no handler of its own.
      return `<button class="note-link" data-subtask-id="${esc(hit.id)}"`
        + `>${esc(name)}</button>`;
    }
    return `<button class="note-link" data-term="${esc(hit.term)}"`
      + `>${esc(name)}</button>`;
  };

  cache.set(ctx, md);
  return md;
}

export function renderNote(body, ctx) {
  return rendererFor(ctx).render(String(body ?? ''));
}
