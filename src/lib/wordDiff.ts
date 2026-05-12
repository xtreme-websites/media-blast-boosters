/**
 * Produces an HTML string showing word-level differences between two HTML strings.
 * Removed words are wrapped in <del> (red), added words in <ins> (green).
 */
export function wordDiff(original: string, modified: string): string {
  // Strip tags for word tokenization, work on text content
  const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const origWords = stripTags(original).split(" ");
  const modWords  = stripTags(modified).split(" ");

  // LCS table
  const m = origWords.length, n = modWords.length;
  const dp: number[][] = Array.from({length: m+1}, () => new Array(n+1).fill(0));
  for (let i = m-1; i >= 0; i--)
    for (let j = n-1; j >= 0; j--)
      dp[i][j] = origWords[i] === modWords[j] ? 1 + dp[i+1][j+1] : Math.max(dp[i+1][j], dp[i][j+1]);

  // Trace back
  const parts: string[] = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && origWords[i] === modWords[j]) {
      parts.push(origWords[i]); i++; j++;
    } else if (j < n && (i >= m || dp[i][j+1] >= dp[i+1][j])) {
      parts.push(`<ins style="background:#dcfce7;color:#166534;text-decoration:none;padding:0 2px;border-radius:2px">${modWords[j]}</ins>`); j++;
    } else {
      parts.push(`<del style="background:#fee2e2;color:#991b1b;padding:0 2px;border-radius:2px">${origWords[i]}</del>`); i++;
    }
  }
  return parts.join(" ");
}
