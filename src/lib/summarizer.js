/**
 * Lightweight summarization utilities for research links.
 * No paid AI APIs — uses text cleaning and extractive methods only.
 */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare',
  'ought', 'used', 'it', 'its', 'this', 'that', 'these', 'those',
  'i', 'me', 'my', 'mine', 'we', 'us', 'our', 'ours', 'you', 'your',
  'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'they', 'them',
  'their', 'theirs', 'what', 'which', 'who', 'whom', 'whose',
  'not', 'no', 'nor', 'as', 'if', 'then', 'so', 'than', 'too',
  'very', 'just', 'about', 'above', 'after', 'again', 'all', 'also',
  'am', 'any', 'because', 'before', 'between', 'both', 'each',
  'few', 'more', 'most', 'other', 'over', 'same', 'some', 'such',
  'into', 'through', 'during', 'out', 'up', 'down', 'here', 'there',
  'when', 'where', 'how', 'why', 'while', 'only',
]);

/**
 * Tweet summarizer — clean text, remove URLs and mentions.
 * Tweets are already short, so just clean and return.
 */
export function summarizeTweet(text) {
  if (!text || !text.trim()) {
    return { summary: '', method: 'tweet_clean', status: 'needs_review' };
  }

  let cleaned = text
    .replace(/https?:\/\/\S+/gi, '')   // Remove URLs
    .replace(/@\w+/g, '')              // Remove @ mentions
    .replace(/#(\w+)/g, '$1')          // Keep hashtag text, remove #
    .replace(/\s+/g, ' ')             // Normalize whitespace
    .trim();

  if (!cleaned) {
    return { summary: '', method: 'tweet_clean', status: 'needs_review' };
  }

  // If short enough, use as-is
  if (cleaned.length <= 300) {
    return { summary: cleaned, method: 'tweet_clean', status: 'summarized' };
  }

  // Truncate at sentence boundary
  const truncated = cleaned.substring(0, 300);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastQuestion = truncated.lastIndexOf('?');
  const lastExclaim = truncated.lastIndexOf('!');
  const lastBreak = Math.max(lastPeriod, lastQuestion, lastExclaim);

  if (lastBreak > 80) {
    return { summary: cleaned.substring(0, lastBreak + 1), method: 'tweet_clean', status: 'summarized' };
  }

  return { summary: truncated.trim() + '...', method: 'tweet_clean', status: 'summarized' };
}

/**
 * Extractive summarizer for long-form content.
 * Picks the top 2–4 most relevant sentences based on word frequency,
 * title overlap, position, and sentence length.
 */
export function summarizeExtractive(text, title = '') {
  if (!text || !text.trim()) {
    return { summary: '', method: 'extractive', status: 'needs_review' };
  }

  // Normalize whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();

  // Split into sentences (must be > 20 chars and < 500 chars to be useful)
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 20 && s.trim().length < 500)
    .map((s, i) => ({ text: s.trim(), index: i }));

  if (sentences.length === 0) {
    return { summary: normalized.substring(0, 500), method: 'extractive', status: 'needs_review' };
  }

  if (sentences.length <= 3) {
    return { summary: sentences.map(s => s.text).join(' '), method: 'extractive', status: 'summarized' };
  }

  // Count word frequency across all sentences (excluding stop words)
  const wordFreq = {};
  sentences.forEach(s => {
    const words = s.text.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
    words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
  });

  // Title words for boosting
  const titleWords = new Set(
    (title || '').toLowerCase().split(/\W+/).filter(w => w.length > 2 && !STOP_WORDS.has(w))
  );

  // Score each sentence
  const scored = sentences.map(s => {
    const words = s.text.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
    if (words.length === 0) return { ...s, score: 0 };

    // Base score: average word frequency
    let score = words.reduce((sum, w) => sum + (wordFreq[w] || 0), 0) / words.length;

    // Boost words that also appear in the title
    const titleOverlap = words.filter(w => titleWords.has(w)).length;
    score += titleOverlap * 2;

    // Slightly boost earlier sentences (position bonus up to 30%)
    const positionBoost = 1 - (s.index / sentences.length) * 0.3;
    score *= positionBoost;

    // Slightly boost sentences with reasonable length (15–40 words)
    if (words.length >= 15 && words.length <= 40) score *= 1.2;

    return { ...s, score };
  });

  // Pick top 2–4 sentences depending on content length
  const numSentences = sentences.length > 10 ? 4 : sentences.length > 5 ? 3 : 2;

  const topSentences = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, numSentences)
    .sort((a, b) => a.index - b.index); // Return in original order

  const summary = topSentences.map(s => s.text).join(' ');
  return { summary, method: 'extractive', status: 'summarized' };
}

/**
 * Main summarization flow — routes to the appropriate summarizer
 * based on content type.
 *
 * Input priority: pastedText first, then extractedText.
 */
export function summarizeByType(link) {
  const inputText = link.pasted_text || link.extracted_text || '';

  if (!inputText.trim()) {
    return { autoSummary: '', summaryMethod: 'none', summaryStatus: 'needs_review' };
  }

  if (link.content_type === 'tweet') {
    const result = summarizeTweet(inputText);
    return { autoSummary: result.summary, summaryMethod: result.method, summaryStatus: result.status };
  }

  // web_article, press_release, filing, transcript, other
  const result = summarizeExtractive(inputText, link.title || '');
  return { autoSummary: result.summary, summaryMethod: result.method, summaryStatus: result.status };
}
