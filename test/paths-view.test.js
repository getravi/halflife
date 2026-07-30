import { describe, it, expect } from 'vitest';
import { pathCardsHtml } from '../src/paths-view.js';

const catalogue = { paths: [{
  id: 'mm', title: 'Mission Masters Degree', tagline: 'Apply well.',
  weeks: 30, tasks: 28,
  phases: [{ id: 'mm-p0', title: 'August' }, { id: 'mm-p1', title: 'September' }],
  url: '/paths/mm-x.json'
}] };

describe('pathCardsHtml', () => {
  it('shows title, tagline, stats and phase titles', () => {
    const html = pathCardsHtml(catalogue, new Set(), true);
    expect(html).toContain('Mission Masters Degree');
    expect(html).toContain('Apply well.');
    expect(html).toContain('30 weeks');
    expect(html).toContain('2 phases');
    expect(html).toContain('28 tasks');
    expect(html).toContain('August');
  });

  it('offers Continue for an enrolled path, linking into it', () => {
    const html = pathCardsHtml(catalogue, new Set(['mm']), true);
    expect(html).toContain('Continue');
    expect(html).toContain('/?path=mm#today');
    expect(html).not.toContain('path-enrol');
  });

  it('offers Enrol when signed in but not enrolled', () => {
    const html = pathCardsHtml(catalogue, new Set(), true);
    expect(html).toContain('Enrol');
    expect(html).toContain('data-path-id="mm"');
  });

  it('also offers a view link when signed in but not enrolled, because browsing must not require enrolment', () => {
    const html = pathCardsHtml(catalogue, new Set(), true);
    expect(html).toContain('View path');
    expect(html).toContain('/?path=mm#mm-p0');
  });

  it('offers a read-only view link when signed out', () => {
    const html = pathCardsHtml(catalogue, new Set(), false);
    expect(html).toContain('View path');
    expect(html).toContain('/?path=mm#mm-p0');
    expect(html).not.toContain('path-enrol');
  });
});
