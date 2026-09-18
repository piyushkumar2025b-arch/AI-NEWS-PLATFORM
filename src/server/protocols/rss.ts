import { rssClient } from '../clients/rss_client.js';

export const rssProtocol = {
  async fetchData(options: {
    sourceId: string;
    url: string;
    timeoutMs?: number;
    maxRetries?: number;
    headers?: Record<string, string>;
  }) {
    return await rssClient.fetchAndParse(options.url, options.sourceId, {
      timeoutMs: options.timeoutMs,
      maxRetries: options.maxRetries,
      headers: options.headers
    });
  }
};
