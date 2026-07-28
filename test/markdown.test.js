import { describe, it, expect } from 'vitest';
import { renderNote, resolveName } from '../src/markdown.js';
import { indexPath } from '../src/weights.js';

const path = {
  id: 'p',
  terms: [{ term: 'KV', mentionedIn: ['s1'], seeAlso: [] }],
  phases: [{
    id: 'ph1', weight: 1,
    tasks: [{
      id: 't1', weight: 1,
      subtasks: [
        { id: 's1', title: 'Stand up vLLM', desc: 'd', steps: [], resources: {} }
      ]
    }]
  }]
};
const ctx = { path, index: indexPath(path) };

describe('renderNote', () => {
  it('renders ordinary markdown', () => {
    const html = renderNote('**bold** and `code`', ctx);
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<code>code</code>');
  });

  it('renders a fenced block, which is why markdown was chosen at all', () => {
    expect(renderNote('```\nValueError: no memory\n```', ctx)).toContain('<pre>');
  });

  it('escapes raw HTML rather than trusting it', () => {
    const html = renderNote('<img src=x onerror=alert(1)>', ctx);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  it('escapes a script tag', () => {
    expect(renderNote('<script>alert(1)</script>', ctx)).not.toContain('<script>');
  });

  it('refuses a javascript: link', () => {
    const html = renderNote('[click](javascript:alert(1))', ctx);
    expect(html).not.toContain('href="javascript:');
  });

  it('refuses a javascript: image', () => {
    expect(renderNote('![x](javascript:alert(1))', ctx)).not.toContain('src="javascript:');
  });

  it('keeps an ordinary link', () => {
    expect(renderNote('[docs](https://docs.vllm.ai/)', ctx))
      .toContain('href="https://docs.vllm.ai/"');
  });

  it('resolves a subtask name to a button the sidebar handler already reads', () => {
    const html = renderNote('see [[Stand up vLLM]]', ctx);
    expect(html).toContain('data-subtask-id="s1"');
    expect(html).toContain('Stand up vLLM');
  });

  it('resolves a term name to a term jump', () => {
    expect(renderNote('the [[KV]] cache', ctx)).toContain('data-term="KV"');
  });

  it('leaves an unresolved name as literal text, never a dead link', () => {
    const html = renderNote('see [[No Such Subtask]]', ctx);
    expect(html).not.toContain('<button');
    expect(html).toContain('[[No Such Subtask]]');
  });

  it('matches a name case-insensitively, because you are typing from memory', () => {
    expect(renderNote('[[stand up vllm]]', ctx)).toContain('data-subtask-id="s1"');
  });

  it('escapes markup inside a bracketed name', () => {
    expect(renderNote('[[<img src=x>]]', ctx)).not.toContain('<img src=x');
  });

  it('leaves an unterminated bracket alone rather than eating the rest', () => {
    expect(renderNote('a [[b and more text', ctx)).toContain('more text');
  });

  it('handles an empty body without throwing', () => {
    expect(() => renderNote('', ctx)).not.toThrow();
  });
});

describe('resolveName', () => {
  it('prefers a subtask over a term of the same name', () => {
    const both = JSON.parse(JSON.stringify(path));
    both.terms.push({ term: 'Stand up vLLM', mentionedIn: ['s1'], seeAlso: [] });
    const c = { path: both, index: indexPath(both) };
    expect(resolveName('Stand up vLLM', c)).toEqual({ kind: 'subtask', id: 's1' });
  });

  it('returns null for a name that is neither', () => {
    expect(resolveName('nothing at all', ctx)).toBeNull();
  });

  it('returns null for an empty name', () => {
    expect(resolveName('   ', ctx)).toBeNull();
  });
});
