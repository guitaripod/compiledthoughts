export function transformToBionicText(text: string): string {
  const words = text.split(/(\s+)/);

  return words
    .map((word) => {
      if (word.trim() === '') return word;

      // Calculate 40% of word length
      const boldLength = Math.max(1, Math.ceil(word.length * 0.4));
      const boldPart = word.slice(0, boldLength);
      const normalPart = word.slice(boldLength);

      return `<b>${boldPart}</b>${normalPart}`;
    })
    .join('');
}
