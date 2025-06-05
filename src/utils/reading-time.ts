export function calculateReadingTime(content: string): number {
  // Remove HTML tags and code blocks
  const text = content
    .replace(/<[^>]*>/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '');
  
  // Count words
  const words = text.trim().split(/\s+/).length;
  
  // Calculate reading time (200 words per minute)
  const readingTime = Math.ceil(words / 200);
  
  return readingTime;
}