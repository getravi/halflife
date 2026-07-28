import { describe, it, expect } from 'vitest';
import { glossaryHtml } from '../src/glossary-view.js';
import { indexPath } from '../src/weights.js';

const path = {
  id: 'p',
  phases: [{
    id: 'ph1', weight: 1,
    tasks: [{
      id: 't1', weight: 1,
      subtasks: [
        { id: 's1', title: 'Stand up vLLM', desc: 'd', steps: [], resources: {} },
        { id: 's2', title: 'Continuous batching', desc: 'd', steps: [], resources: {} }
      ]
    }]
  }]
};
const ctx = { path, index: indexPath(path) };

const terms = [
  { term: 'KV cache', mentionedIn: ['s1', 's2'],
    seeAlso: [{ label: 'vLLM docs', url: 'https://docs.vllm.ai/' }] },
  { term: 'GRPO', mentionedIn: ['s2'], seeAlso: [] }
];

describe('glossaryHtml', () => {
  it('lists every term', () => {
    const html = glossaryHtml(terms, ctx, '');
    expect(html).toContain('KV cache');
    expect(html).toContain('GRPO');
  });

  it('names the subtasks a term appears in, by title', () => {
    const html = glossaryHtml(terms, ctx, '');
    expect(html).toContain('Stand up vLLM');
    expect(html).toContain('Continuous batching');
  });

  it('links out to where it is explained', () => {
    expect(glossaryHtml(terms, ctx, '')).toContain('https://docs.vllm.ai/');
  });

  it('opens a subtask through the sidebar rather than the hash router', () => {
    const html = glossaryHtml(terms, ctx, '');
    expect(html).toContain('data-subtask-id="s1"');
    // Only the outbound resource link may carry an href. A hash of `#s1` would
    // be read by nav.js as the panel `view-s1`, blanking the page.
    expect([...html.matchAll(/href="([^"]*)"/g)].map(m => m[1]))
      .toEqual(['https://docs.vllm.ai/']);
  });

  it('writes no definition, because that was the whole agreement', () => {
    const html = glossaryHtml(terms, ctx, '');
    expect(html).not.toMatch(/means|refers to|is a /i);
  });

  it('filters case-insensitively on the term', () => {
    const html = glossaryHtml(terms, ctx, 'kv');
    expect(html).toContain('KV cache');
    expect(html).not.toContain('GRPO');
  });

  it('says so when a filter matches nothing, rather than rendering blank', () => {
    expect(glossaryHtml(terms, ctx, 'zzzz')).toMatch(/no terms/i);
  });

  it('has an honest empty state with no terms at all', () => {
    expect(glossaryHtml([], ctx, '')).toMatch(/no terms/i);
  });

  it('escapes markup in a term', () => {
    const evil = [{ term: '<img src=x onerror=alert(1)>', mentionedIn: ['s1'], seeAlso: [] }];
    expect(glossaryHtml(evil, ctx, '')).not.toContain('<img src=x');
  });

  it('skips a mention whose subtask no longer resolves rather than throwing', () => {
    const stale = [{ term: 'Ghost', mentionedIn: ['gone'], seeAlso: [] }];
    expect(() => glossaryHtml(stale, ctx, '')).not.toThrow();
  });
});
