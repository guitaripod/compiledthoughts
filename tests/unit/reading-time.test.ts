import { describe, it, expect } from 'vitest';
import { calculateReadingTime } from '../../src/utils/reading-time';

describe('Reading Time Calculation', () => {
  it('should calculate 1 minute for 200 words', () => {
    const content = 'word '.repeat(200);
    expect(calculateReadingTime(content)).toBe(1);
  });

  it('should calculate 2 minutes for 400 words', () => {
    const content = 'word '.repeat(400);
    expect(calculateReadingTime(content)).toBe(2);
  });

  it('should round up for partial minutes', () => {
    const content = 'word '.repeat(250); // 1.25 minutes
    expect(calculateReadingTime(content)).toBe(2);
  });

  it('should ignore HTML tags', () => {
    const content = '<p>hello</p> <div>world</div> test';
    expect(calculateReadingTime(content)).toBe(1);
  });

  it('should ignore code blocks', () => {
    const content = 'hello ```const x = 1; console.log(x);``` world test';
    expect(calculateReadingTime(content)).toBe(1);
  });

  it('should ignore inline code', () => {
    const content = 'hello `const x = 1` world test';
    expect(calculateReadingTime(content)).toBe(1);
  });

  it('should handle empty content', () => {
    expect(calculateReadingTime('')).toBe(0);
  });

  it('should handle content with only code blocks', () => {
    const content = '```javascript\nconst x = 1;\n```';
    expect(calculateReadingTime(content)).toBe(0);
  });
});