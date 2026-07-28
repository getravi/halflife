/**
 * The term index. Not a glossary in the usual sense: it carries no
 * definitions, because inventing explanations of material somebody is still
 * learning is how you end up confidently wrong in an interview.
 *
 * It answers where a term appears in your plan, and where somebody who knows
 * has explained it.
 */
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const EMPTY = `<p class="signed-out-note">No terms match.</p>`;

export function glossaryHtml(terms, ctx, filter) {
  const needle = String(filter ?? '').trim().toLowerCase();
  const shown = (terms ?? []).filter(t =>
    !needle || t.term.toLowerCase().includes(needle));

  if (!shown.length) return EMPTY;

  return shown.map(t => {
    // Buttons, for the same reason as the prerequisite list: a subtask has no
    // hash of its own, and nav.js would read one as a panel that is not there.
    const where = (t.mentionedIn ?? [])
      .filter(id => ctx.index.subtasks.has(id))
      .map(id => `<button class="glossary-ref" data-subtask-id="${esc(id)}"
                    >${esc(ctx.index.subtasks.get(id).title)}</button>`)
      .join(', ');

    const read = (t.seeAlso ?? [])
      .map(l => `<a class="glossary-ref" href="${esc(l.url)}"
                    target="_blank" rel="noopener">${esc(l.label)}</a>`)
      .join(', ');

    return `<div class="glossary-row">
      <div class="glossary-term">${esc(t.term)}</div>
      ${where ? `<div class="glossary-meta">appears in ${where}</div>` : ''}
      ${read ? `<div class="glossary-meta">read: ${read}</div>` : ''}
    </div>`;
  }).join('');
}

export function renderGlossary(ctx) {
  const list = document.getElementById('glossary-list');
  const box = document.getElementById('glossary-filter');
  if (!list || !box) return;

  const paint = () => { list.innerHTML = glossaryHtml(ctx.path.terms, ctx, box.value); };
  box.addEventListener('input', paint);
  paint();
}
