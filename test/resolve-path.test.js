import { describe, it, expect } from 'vitest';
import { resolvePathId } from '../src/content.js';

const catalogue = { paths: [{ id: 'frontier-lab' }, { id: 'mission-masters-degree' }] };

describe('resolvePathId', () => {
  it('honors a ?path= value that exists in the catalogue', () => {
    expect(resolvePathId('?path=mission-masters-degree', catalogue, []))
      .toBe('mission-masters-degree');
  });

  it('falls back to the first enrolment when ?path= is unknown', () => {
    expect(resolvePathId('?path=nope', catalogue,
      [{ pathId: 'mission-masters-degree' }]))
      .toBe('mission-masters-degree');
  });

  it('falls back to the first enrolment when there is no query', () => {
    expect(resolvePathId('', catalogue, [{ pathId: 'mission-masters-degree' }]))
      .toBe('mission-masters-degree');
  });

  it('defaults to frontier-lab with no query and no enrolments', () => {
    expect(resolvePathId('', catalogue, [])).toBe('frontier-lab');
  });
});
