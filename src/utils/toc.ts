export interface TocItem {
  depth: number;
  text: string;
  slug: string;
}

export function generateTableOfContents(content: string): TocItem[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const toc: TocItem[] = [];
  let match;
  
  while ((match = headingRegex.exec(content)) !== null) {
    const depth = match[1].length;
    const text = match[2];
    const slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
    
    toc.push({ depth, text, slug });
  }
  
  return toc;
}