export interface Post {
  slug: string;
  title: string;
  tags: string[];
  date: Date;
}

export function findRelatedPosts(currentPost: Post, allPosts: Post[], limit: number = 3): Post[] {
  // Filter out the current post
  const otherPosts = allPosts.filter(post => post.slug !== currentPost.slug);
  
  // Calculate relevance score for each post
  const postsWithScores = otherPosts.map(post => {
    let score = 0;
    
    // Add points for each matching tag
    currentPost.tags.forEach(tag => {
      if (post.tags.includes(tag)) {
        score += 2;
      }
    });
    
    // Add a small bonus for recency
    const daysDifference = Math.abs(
      (currentPost.date.getTime() - post.date.getTime()) / (1000 * 60 * 60 * 24)
    );
    score += 1 / (daysDifference + 1);
    
    return { post, score };
  });
  
  // Sort by score and return top matches
  return postsWithScores
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.post);
}