// Search engines may index the pages; AI crawlers are turned away and nobody gets the model API.
const AI_BOTS = [
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-Web', 'anthropic-ai', 'PerplexityBot',
  'Perplexity-User', 'CCBot', 'Google-Extended', 'Applebot-Extended', 'Bytespider', 'Amazonbot',
  'cohere-ai', 'Diffbot', 'meta-externalagent', 'FacebookBot', 'ImagesiftBot', 'Omgilibot', 'YouBot',
];

export default function robots() {
  return {
    rules: [
      { userAgent: AI_BOTS, disallow: '/' },
      { userAgent: '*', allow: '/', disallow: '/api/' },
    ],
  };
}
