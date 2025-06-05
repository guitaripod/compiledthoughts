import { describe, it, expect } from 'vitest';
import { generateTableOfContents } from '../../src/utils/toc';

describe('Table of Contents Generation', () => {
  it('should extract h2 and h3 headings', () => {
    const content = `
# Title (should be ignored)
## First Section
Some content
### Subsection
## Second Section
#### Deep heading (should be ignored)
### Another Subsection
`;
    const toc = generateTableOfContents(content);
    
    expect(toc).toHaveLength(4);
    expect(toc[0]).toEqual({
      depth: 2,
      text: 'First Section',
      slug: 'first-section'
    });
    expect(toc[1]).toEqual({
      depth: 3,
      text: 'Subsection',
      slug: 'subsection'
    });
  });

  it('should generate proper slugs', () => {
    const content = `
## Hello World!
## This & That
## 123 Numbers
## Special-Characters_Here
`;
    const toc = generateTableOfContents(content);
    
    expect(toc[0].slug).toBe('hello-world');
    expect(toc[1].slug).toBe('this-that');
    expect(toc[2].slug).toBe('123-numbers');
    expect(toc[3].slug).toBe('special-characters_here');
  });

  it('should handle empty content', () => {
    expect(generateTableOfContents('')).toEqual([]);
  });

  it('should handle content with no headings', () => {
    const content = 'Just some regular text without any headings.';
    expect(generateTableOfContents(content)).toEqual([]);
  });

  it('should preserve heading order', () => {
    const content = `
## A
### B
## C
### D
`;
    const toc = generateTableOfContents(content);
    expect(toc.map(item => item.text)).toEqual(['A', 'B', 'C', 'D']);
  });
});