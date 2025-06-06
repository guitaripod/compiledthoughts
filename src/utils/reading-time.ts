export function calculateReadingTime(content: string): number {
  // Remove HTML tags and code blocks
  const text = content
    .replace(/<[^>]*>/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '');
  
  // Handle empty content
  const trimmedText = text.trim();
  if (trimmedText === '') return 0;
  
  // Count words
  const words = trimmedText.split(/\s+/).length;
  
  // Calculate reading time (200 words per minute)
  const readingTime = Math.ceil(words / 200);
  
  return readingTime;
}