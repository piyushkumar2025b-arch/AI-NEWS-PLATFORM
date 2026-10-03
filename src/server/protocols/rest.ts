import { httpClient } from '../clients/http_client.js';

export const restProtocol = {
  async fetchData(options: {
    sourceId: string;
    url: string;
    params?: Record<string, any>;
    timeoutMs?: number;
    maxRetries?: number;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  }) {
    const res = await httpClient.get(options.url, {
      sourceId: options.sourceId,
      params: options.params,
      timeoutMs: options.timeoutMs,
      maxRetries: options.maxRetries,
      headers: options.headers,
      signal: options.signal
    });
    return res.data;
  }
};
