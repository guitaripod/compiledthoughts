import { describe, it, expect } from 'vitest';
import { transformToBionicText } from '../../src/utils/bionic-reading';

describe('Bionic Reading', () => {
  it('should bold the first 40% of each word', () => {
    const input = 'hello world';
    const expected = '<b>he</b>llo <b>wo</b>rld';
    expect(transformToBionicText(input)).toBe(expected);
  });

  it('should handle single character words', () => {
    const input = 'I am a developer';
    const expected = '<b>I</b> <b>a</b>m <b>a</b> <b>deve</b>loper';
    expect(transformToBionicText(input)).toBe(expected);
  });

  it('should preserve whitespace', () => {
    const input = 'hello  world   test';
    const expected = '<b>he</b>llo  <b>wo</b>rld   <b>te</b>st';
    expect(transformToBionicText(input)).toBe(expected);
  });

  it('should handle empty strings', () => {
    expect(transformToBionicText('')).toBe('');
  });

  it('should handle strings with only whitespace', () => {
    expect(transformToBionicText('   ')).toBe('   ');
  });

  it('should round up for odd length words', () => {
    const input = 'cat'; // 3 letters, 40% = 1.2, should round to 2
    const expected = '<b>ca</b>t';
    expect(transformToBionicText(input)).toBe(expected);
  });
});