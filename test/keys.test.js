import { describe, it, expect } from 'vitest';
import { keyAction } from '../src/keys.js';

const k = (key, mods = {}) => ({ key, metaKey: false, ctrlKey: false, ...mods });

describe('keyAction while not typing', () => {
  const hidden = { revealed: false, typing: false };
  const shown = { revealed: true, typing: false };

  it('reveals on space', () => {
    expect(keyAction(k(' '), hidden)).toBe('reveal');
  });

  it('reveals on enter', () => {
    expect(keyAction(k('Enter'), hidden)).toBe('reveal');
  });

  it('does nothing on space once already revealed', () => {
    expect(keyAction(k(' '), shown)).toBeNull();
  });

  it('grades one to four after reveal', () => {
    expect(keyAction(k('1'), shown)).toBe('again');
    expect(keyAction(k('2'), shown)).toBe('hard');
    expect(keyAction(k('3'), shown)).toBe('good');
    expect(keyAction(k('4'), shown)).toBe('easy');
  });

  it('ignores digits before reveal, so a stray key cannot mark a card easy and push it a week out', () => {
    expect(keyAction(k('1'), hidden)).toBeNull();
    expect(keyAction(k('4'), hidden)).toBeNull();
  });

  it('ignores digits outside one to four', () => {
    expect(keyAction(k('5'), shown)).toBeNull();
    expect(keyAction(k('0'), shown)).toBeNull();
  });

  it('closes on escape', () => {
    expect(keyAction(k('Escape'), hidden)).toBe('close');
    expect(keyAction(k('Escape'), shown)).toBe('close');
  });

  it('ignores unrelated keys', () => {
    expect(keyAction(k('a'), shown)).toBeNull();
    expect(keyAction(k('Tab'), shown)).toBeNull();
  });
});

describe('keyAction while typing', () => {
  const typing = { revealed: false, typing: true };

  it('lets a space through as a character, which is why any of this is careful', () => {
    expect(keyAction(k(' '), typing)).toBeNull();
  });

  it('lets digits through as characters', () => {
    expect(keyAction(k('1'), typing)).toBeNull();
    expect(keyAction(k('4'), { revealed: true, typing: true })).toBeNull();
  });

  it('lets a plain enter through, so the recall box can hold more than one line', () => {
    expect(keyAction(k('Enter'), typing)).toBeNull();
  });

  it('reveals on cmd or ctrl enter without leaving the box', () => {
    expect(keyAction(k('Enter', { metaKey: true }), typing)).toBe('reveal');
    expect(keyAction(k('Enter', { ctrlKey: true }), typing)).toBe('reveal');
  });

  it('blurs rather than closing on escape, so a half-typed recall is not lost to a reflex', () => {
    expect(keyAction(k('Escape'), typing)).toBe('blur');
  });
});
