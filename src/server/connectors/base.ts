export class BaseConnector {
  public definition: any;
  public protocol: any;

  isEnabled(): boolean {
    return Boolean(this.definition?.enabled);
  }

  getSourceId(): string {
    return this.definition?.id || '';
  }

  getSourceName(): string {
    return this.definition?.name || '';
  }

  async fetch(options: any = {}): Promise<{ rawItems: any[]; durationMs: number; sourceId: string; sourceName: string }> {
    return {
      rawItems: [],
      durationMs: 0,
      sourceId: this.getSourceId(),
      sourceName: this.getSourceName()
    };
  }

  async fetchArticles(options: any = {}): Promise<any[]> {
    const res = await this.fetch(options);
    return res?.rawItems || [];
  }
}

