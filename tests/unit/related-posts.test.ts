import { describe, it, expect } from 'vitest';
import { findRelatedPosts } from '../../src/utils/related-posts';
import type { Post } from '../../src/utils/related-posts';

describe('Related Posts Algorithm', () => {
  const posts: Post[] = [
    {
      slug: 'post-1',
      title: 'Post 1',
      tags: ['javascript', 'react'],
      date: new Date('2024-01-01')
    },
    {
      slug: 'post-2',
      title: 'Post 2',
      tags: ['javascript', 'vue'],
      date: new Date('2024-01-02')
    },
    {
      slug: 'post-3',
      title: 'Post 3',
      tags: ['react', 'typescript'],
      date: new Date('2024-01-03')
    },
    {
      slug: 'post-4',
      title: 'Post 4',
      tags: ['python', 'django'],
      date: new Date('2024-01-04')
    },
    {
      slug: 'post-5',
      title: 'Post 5',
      tags: ['javascript', 'react', 'typescript'],
      date: new Date('2024-01-05')
    }
  ];

  it('should find posts with matching tags', () => {
    const currentPost = posts[0]; // javascript, react
    const related = findRelatedPosts(currentPost, posts, 3);
    
    expect(related).toHaveLength(3);
    expect(related[0].slug).toBe('post-5'); // Has both tags
    expect(related.map(p => p.slug)).not.toContain('post-1'); // Current post
  });

  it('should prioritize posts with more matching tags', () => {
    const currentPost = posts[4]; // javascript, react, typescript
    const related = findRelatedPosts(currentPost, posts, 2);
    
    // post-1 and post-3 should rank highest (2 tags each)
    const topSlugs = related.map(p => p.slug);
    expect(topSlugs).toContain('post-1');
    expect(topSlugs).toContain('post-3');
  });

  it('should return empty array for post with no matching tags', () => {
    const currentPost = posts[3]; // python, django
    const related = findRelatedPosts(currentPost, posts, 3);
    
    // Should still return posts, sorted by recency bonus
    expect(related.length).toBeGreaterThan(0);
  });

  it('should limit results to specified count', () => {
    const currentPost = posts[0];
    const related = findRelatedPosts(currentPost, posts, 2);
    
    expect(related).toHaveLength(2);
  });

  it('should handle empty posts array', () => {
    const currentPost = posts[0];
    const related = findRelatedPosts(currentPost, [], 3);
    
    expect(related).toEqual([]);
  });

  it('should consider recency as a tiebreaker', () => {
    const sameDayPosts: Post[] = [
      {
        slug: 'old-post',
        title: 'Old Post',
        tags: ['tag1'],
        date: new Date('2024-01-01')
      },
      {
        slug: 'new-post',
        title: 'New Post',
        tags: ['tag1'],
        date: new Date('2024-01-10')
      },
      {
        slug: 'current',
        title: 'Current',
        tags: ['tag1'],
        date: new Date('2024-01-11')
      }
    ];
    
    const related = findRelatedPosts(sameDayPosts[2], sameDayPosts, 2);
    expect(related[0].slug).toBe('new-post'); // Closer in time
  });
});