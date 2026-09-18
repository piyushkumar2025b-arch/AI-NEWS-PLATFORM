import assert from 'assert';
import { normalizeUrl, extractDomain, isValidHttpUrl } from '../src/server/utils/urls.js';
import { parseDateToISO, formatTimeAgo } from '../src/server/utils/dates.js';
import { cleanTitle, stripHtml, calculateStringSimilarity } from '../src/server/utils/text.js';
import { generateArticleId, generateTitleFingerprint } from '../src/server/utils/hashing.js';
import { validationPipeline } from '../src/server/pipelines/validation.js';
import { normalizationPipeline } from '../src/server/pipelines/normalization.js';
import { filterPipeline } from '../src/server/pipelines/filtering.js';
import { deduplicationPipeline } from '../src/server/pipelines/deduplication.js';
import { enrichmentPipeline } from '../src/server/pipelines/enrichment.js';
import { RssClient } from '../src/server/clients/rss_client.js';
import { newsRepository } from '../src/server/database/repository.js';
import { SOURCES } from '../src/server/config/sources.js';
import { getAllConnectors, getConnector } from '../src/server/connectors/index.js';
import { youtubeClient } from '../src/server/clients/youtube_client.js';
import { CircuitBreaker, CircuitBreakerOpenError } from '../src/server/resilience/circuit_breaker.js';
import { TokenBucket } from '../src/server/resilience/rate_limiter.js';
import { feedService } from '../src/server/services/feed_service.js';
import { videoSearchService } from '../src/server/services/video_search_service.js';
import { hnAiConnector } from '../src/server/connectors/hn_ai.js';
import { openAiStatusConnector } from '../src/server/connectors/openai_status.js';
import { Article } from '../src/server/models/article.js';
import { mediaResolver } from '../src/server/services/media_resolver.js';
import { sourceService } from '../src/server/services/source_service.js';
import { ValidationError } from '../src/server/errors/exceptions.js';
import { adminAuthMiddleware, corsMiddleware } from '../src/server/api/middleware.js';
import { settings } from '../src/server/config/settings.js';

let passed = 0;
let failed = 0;

function makeTestArticle(overrides: Partial<Article>): Article {
  return {
    id: 'test_' + Math.random().toString(36).substring(2, 9),
    title: 'Test Article',
    description: 'Test Description',
    url: 'https://example.com/test',
    canonical_url: 'https://example.com/test',
    image_url: null,
    source: 'Test Source',
    source_id: 'test_source',
    author: 'Test Author',
    published_at: new Date().toISOString(),
    category: 'technology',
    tags: ['tech'],
    language: 'en',
    source_type: 'news',
    media: [],
    domain: 'example.com',
    content_hash: 'hash_' + Math.random().toString(36).substring(2, 9),
    raw_metadata: {},
    updated_at: null,
    external_id: null,
    ...overrides
  };
}

function test(name: string, fn: () => void | Promise<void>) {
  return async () => {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
      failed++;
    }
  };
}

async function runAllTests() {
  console.log('\n========================================');
  console.log('🧪 RUNNING PRODUCTION TEST SUITE');
  console.log('========================================\n');

  const tests = [
    // 1. URL Utils
    test('URL Normalization strips UTM params and trailing slashes', () => {
      const input = 'https://www.example.com/ai/article/?utm_source=twitter&utm_medium=social&ref=123';
      const output = normalizeUrl(input);
      assert.strictEqual(output, 'https://example.com/ai/article');
    }),

    test('Domain Extraction parses clean hostname', () => {
      assert.strictEqual(extractDomain('https://news.ycombinator.com/item?id=123'), 'news.ycombinator.com');
      assert.strictEqual(extractDomain('https://www.github.com/vllm/vllm'), 'github.com');
    }),

    test('Valid HTTP URL checker filters invalid protocols', () => {
      assert.strictEqual(isValidHttpUrl('https://arxiv.org/abs/2412.19437'), true);
      assert.strictEqual(isValidHttpUrl('javascript:alert(1)'), false);
      assert.strictEqual(isValidHttpUrl('file:///etc/passwd'), false);
    }),

    // 2. Dates & Text
    test('Date parser correctly handles multiple timestamp formats', () => {
      const iso1 = parseDateToISO('2026-09-01T09:00:00Z');
      assert.ok(iso1.startsWith('2026-09-01'));

      const gdeltIso = parseDateToISO('20260901123000');
      assert.ok(gdeltIso.startsWith('2026-09-01'));
    }),

    test('Text cleaner strips HTML tags and publisher suffixes', () => {
      const raw = '<p>OpenAI announces GPT-5 <b>breakthrough</b>! - TechCrunch</p>';
      const cleaned = cleanTitle(raw, { knownPublisher: 'TechCrunch' });
      assert.strictEqual(cleaned, 'OpenAI announces GPT-5 breakthrough!');
    }),

    test('String similarity accurately computes bigram Jaccard metric', () => {
      const s1 = 'DeepSeek announces open-source reasoning model R1';
      const s2 = 'DeepSeek announces open source reasoning model R1';
      const sim = calculateStringSimilarity(s1, s2);
      assert.ok(sim > 0.85, `Similarity ${sim} should be > 0.85`);
    }),

    // 3. RSS & XML Parser
    test('RSS Client parses RSS 2.0 XML with enclosures and Dublin Core', () => {
      const xml = `
        <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
          <channel>
            <title>Tech Feed</title>
            <item>
              <title><![CDATA[New LLM Release from Anthropic]]></title>
              <link>https://example.com/anthropic-llm</link>
              <description>Full details on the new model weights and capabilities</description>
              <dc:creator>John Doe</dc:creator>
              <pubDate>Mon, 01 Sep 2026 12:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>
      `;
      const client = new RssClient();
      const feed = client.parseXml(xml);
      assert.strictEqual(feed.items.length, 1);
      assert.strictEqual(feed.items[0].title, 'New LLM Release from Anthropic');
      assert.strictEqual(feed.items[0].author, 'John Doe');
    }),

    test('RSS Client parses Atom 1.0 XML (ArXiv format)', () => {
      const atomXml = `
        <feed xmlns="http://www.w3.org/2005/Atom">
          <title>arXiv cs.AI</title>
          <entry>
            <title>Diffusion Models for Real-time Robotic Control</title>
            <id>http://arxiv.org/abs/2609.12345v1</id>
            <summary>We present a novel diffusion policy architecture.</summary>
            <published>2026-09-01T08:30:00Z</published>
            <author><name>Alice Smith</name></author>
            <category term="cs.RO" />
          </entry>
        </feed>
      `;
      const client = new RssClient();
      const feed = client.parseXml(atomXml);
      assert.strictEqual(feed.items.length, 1);
      assert.strictEqual(feed.items[0].title, 'Diffusion Models for Real-time Robotic Control');
      assert.strictEqual(feed.items[0].author, 'Alice Smith');
      assert.strictEqual(feed.items[0].categories?.[0], 'cs.RO');
    }),

    test('RSS Client parses RSS 1.0 / RDF XML (Nature format) with multi-authors', () => {
      const rdfXml = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns="http://purl.org/rss/1.0/">
          <channel rdf:about="http://feeds.nature.com/nature/rss/current">
            <title>Nature</title>
            <link>https://www.nature.com/nature</link>
            <description>Frontier scientific journal</description>
          </channel>
          <item rdf:about="https://www.nature.com/articles/s41586-026-0001">
            <title>Quantum Advantage in Deep Neural Optimization</title>
            <link>https://www.nature.com/articles/s41586-026-0001</link>
            <dc:creator>Dr. Elena Rostova</dc:creator>
            <dc:creator>Dr. Marcus Vance</dc:creator>
            <dc:date>2026-09-07</dc:date>
            <description>Breakthrough quantum computing architecture demonstrated.</description>
          </item>
        </rdf:RDF>
      `;
      const client = new RssClient();
      const feed = client.parseXml(rdfXml);
      assert.strictEqual(feed.title, 'Nature');
      assert.strictEqual(feed.items.length, 1);
      assert.strictEqual(feed.items[0].title, 'Quantum Advantage in Deep Neural Optimization');
      assert.ok(feed.items[0].author?.includes('Dr. Elena Rostova'));
      assert.ok(feed.items[0].author?.includes('Dr. Marcus Vance'));
      assert.strictEqual(feed.items[0].pubDate, '2026-09-07');
    }),

    // 4. Pipelines
    test('Validation Pipeline blocks invalid titles or corrupted payloads', () => {
      const invalidItem = {
        title: 'ab',
        url: 'invalid-url',
        sourceId: 'gdelt',
        sourceName: 'GDELT'
      };
      const res = validationPipeline.validate(invalidItem);
      assert.strictEqual(res.valid, false);
    }),

    test('Normalization Pipeline standardizes RawArticleInput into uniform Article contract', () => {
      const raw = {
        title: 'OpenAI Introduces Operator Agent System',
        url: 'https://openai.com/index/introducing-operator/?ref=social',
        description: '<p>Autonomous web agent for computer interaction.</p>',
        sourceId: 'google_news',
        sourceName: 'Google News',
        author: 'OpenAI Research',
        publishedAt: '2026-09-01T10:00:00Z'
      };
      const art = normalizationPipeline.normalize(raw);
      assert.ok(art.id.startsWith('art_'));
      assert.strictEqual(art.canonical_url, 'https://openai.com/index/introducing-operator');
      assert.strictEqual(art.source_type, 'news');
      assert.strictEqual(art.description, 'Autonomous web agent for computer interaction.');
    }),

    test('Deduplication Pipeline identifies duplicates and links source provenance', () => {
      const uniqueId = `unit-test-run-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const raw1 = {
        title: `Unique Hardware Benchmark Test Announcement ${uniqueId}`,
        url: `https://nvidianews.nvidia.com/news/${uniqueId}`,
        description: 'New semiconductor architecture for trillion parameter models',
        sourceId: 'gdelt',
        sourceName: 'GDELT',
        publishedAt: '2026-09-01T10:00:00Z'
      };
      const raw2 = {
        title: `Unique Hardware Benchmark Test Announcement ${uniqueId}`,
        url: `https://nvidianews.nvidia.com/news/${uniqueId}?utm_source=rss`,
        description: 'Next generation GPU server architecture with liquid cooling',
        sourceId: 'google_news',
        sourceName: 'Google News',
        publishedAt: '2026-09-01T10:05:00Z'
      };

      const art1 = normalizationPipeline.normalize(raw1);
      const art2 = normalizationPipeline.normalize(raw2);

      const res1 = deduplicationPipeline.checkAndDeduplicate(art1);
      assert.strictEqual(res1.isUnique, true);
      newsRepository.upsertArticle(art1);

      const res2 = deduplicationPipeline.checkAndDeduplicate(art2);
      assert.strictEqual(res2.isUnique, false);
      assert.strictEqual(res2.matchedReason, 'canonical_url');
    }),

    test('Enrichment Pipeline classifies keywords into taxonomy categories', () => {
      const art = normalizationPipeline.normalize({
        title: 'New humanoid bipedal robotics actuators and walking kinematics',
        url: 'https://example.com/robotics-paper',
        sourceId: 'arxiv',
        sourceName: 'ArXiv'
      });
      const enriched = enrichmentPipeline.enrich(art);
      assert.strictEqual(enriched.category, 'robotics');
      assert.ok(enriched.tags.includes('robotics'));
    }),

    // 5. Source Registry & Connectors
    test('Source Registry defines external news and research sources', () => {
      const allConnectors = getAllConnectors();
      assert.ok(allConnectors.length >= 13, 'Should have at least 13 connectors configured');

      const gdelt = getConnector('gdelt');
      assert.ok(gdelt);
      assert.strictEqual(gdelt.definition.protocol, 'rest');

      const googleNews = getConnector('google_news');
      assert.ok(googleNews);
      assert.strictEqual(googleNews.definition.protocol, 'rss');

      const arxiv = getConnector('arxiv');
      assert.ok(arxiv);
      assert.strictEqual(arxiv.definition.protocol, 'atom');
    }),

    test('YouTube Data API client is configured and derives playlist IDs', () => {
      (settings as any).youtubeApiKey = settings.youtubeApiKey || 'test_yt_key';
      assert.strictEqual(youtubeClient.isConfigured(), true);
      const channelId = 'UCbfYPyITQ-7l4upoX8nvctg';
      const playlistId = youtubeClient.getUploadsPlaylistId(channelId);
      assert.strictEqual(playlistId, 'UUbfYPyITQ-7l4upoX8nvctg');
    }),

    test('Optional authenticated connectors gracefully handle configuration', () => {
      const guardian = getConnector('guardian');
      assert.ok(guardian);
      assert.strictEqual(guardian.definition.id, 'guardian');

      const newsapi = getConnector('newsapi');
      assert.ok(newsapi);
      assert.strictEqual(newsapi.definition.id, 'newsapi');
    }),

    test('Repository query and indexing supports multi-filtering', () => {
      const result = newsRepository.queryArticles({ limit: 10 });
      assert.ok(result.total >= 1);
      assert.ok(Array.isArray(result.articles));
    }),

    // 6. System Resilience & Circuit Breaker Engine
    test('CircuitBreaker transitions to OPEN on consecutive failures and fast-fails', async () => {
      const breaker = new CircuitBreaker({
        name: 'test_circuit',
        failureThreshold: 2,
        recoveryTimeoutMs: 200,
        halfOpenMaxSuccess: 1
      });

      assert.strictEqual(breaker.getState(), 'CLOSED');

      // Fail 1
      try {
        await breaker.execute(async () => { throw new Error('First failure'); });
      } catch { /* ignore */ }
      assert.strictEqual(breaker.getState(), 'CLOSED');

      // Fail 2 -> Should trip to OPEN
      try {
        await breaker.execute(async () => { throw new Error('Second failure'); });
      } catch { /* ignore */ }
      assert.strictEqual(breaker.getState(), 'OPEN');

      // Fast fail without running operation
      let attempted = false;
      try {
        await breaker.execute(async () => {
          attempted = true;
          return 'ok';
        });
      } catch (err: any) {
        assert.ok(err instanceof CircuitBreakerOpenError);
      }
      assert.strictEqual(attempted, false, 'Operation should NOT have run while circuit was OPEN');

      // Wait for recovery timeout
      await new Promise(r => setTimeout(r, 220));
      assert.strictEqual(breaker.getState(), 'HALF_OPEN');

      // Successful canary probe resets to CLOSED
      const probeResult = await breaker.execute(async () => 'canary_success');
      assert.strictEqual(probeResult, 'canary_success');
      assert.strictEqual(breaker.getState(), 'CLOSED');
    }),

    test('TokenBucket rate limiter consumes and regulates tokens', async () => {
      const bucket = new TokenBucket({ capacity: 5, refillRatePerSec: 10 });
      assert.strictEqual(bucket.tryConsume(3), true);
      assert.strictEqual(bucket.tryConsume(2), true);
      assert.strictEqual(bucket.tryConsume(1), false, 'Should deny when bucket empty');
    }),

    // 7. Syndication & Feed Generation Engine
    test('FeedService outputs valid RSS 2.0 and JSON Feed 1.1', () => {
      const rss = feedService.generateRss({ limit: 5 });
      assert.ok(rss.includes('<?xml version="1.0" encoding="UTF-8"?>'));
      assert.ok(rss.includes('<rss version="2.0"'));
      assert.ok(rss.includes('<channel>'));

      const jsonFeed = feedService.generateJsonFeed({ limit: 5 }) as any;
      assert.strictEqual(jsonFeed.version, 'https://jsonfeed.org/version/1.1');
      assert.ok(Array.isArray(jsonFeed.items));

      const csv = feedService.generateCsv({ limit: 5 });
      assert.ok(csv.startsWith('ID,Title,URL,Category'));
    }),

    // 8. New API Connectors
    test('New Connectors are registered in Connector Registry', () => {
      const hn = getConnector('hn_ai');
      assert.ok(hn, 'hn_ai connector should be registered');
      assert.strictEqual(hn.definition.id, 'hn_ai');

      const openaiStatus = getConnector('openai_status');
      assert.ok(openaiStatus, 'openai_status connector should be registered');

      const arxivNlp = getConnector('arxiv_nlp');
      assert.ok(arxivNlp, 'arxiv_nlp connector should be registered');

      const arxivCv = getConnector('arxiv_cv');
      assert.ok(arxivCv, 'arxiv_cv connector should be registered');

      const ph = getConnector('producthunt_ai');
      assert.ok(ph, 'producthunt_ai connector should be registered');

      const kaggle = getConnector('kaggle_ai');
      assert.ok(kaggle, 'kaggle_ai connector should be registered');
    }),

    // 9. Regression Tests
    test('Regression: toDate YYYY-MM-DD includes full day events up to 23:59:59', () => {
      const art1 = makeTestArticle({
        id: 'test_date_1',
        title: 'Morning Paper on Multi-Modal LLMs',
        url: 'https://example.com/date1',
        canonical_url: 'https://example.com/date1',
        source: 'ArXiv',
        source_id: 'arxiv',
        published_at: '2026-09-11T09:30:00.000Z',
        category: 'llms',
        tags: ['llms'],
        language: 'en',
        source_type: 'research'
      });
      const art2 = makeTestArticle({
        id: 'test_date_2',
        title: 'Evening Paper on Diffusion Models',
        url: 'https://example.com/date2',
        canonical_url: 'https://example.com/date2',
        source: 'ArXiv',
        source_id: 'arxiv',
        published_at: '2026-09-11T21:45:00.000Z',
        category: 'llms',
        tags: ['llms'],
        language: 'en',
        source_type: 'research'
      });
      newsRepository.upsertArticle(art1);
      newsRepository.upsertArticle(art2);

      // Query with date string "2026-09-11" for both from and to with adequate limit
      const res = newsRepository.queryArticles({
        fromDate: '2026-09-11',
        toDate: '2026-09-11',
        category: 'llms',
        limit: 500
      });

      const found1 = res.articles.some(a => a.id === 'test_date_1');
      const found2 = res.articles.some(a => a.id === 'test_date_2');
      assert.ok(found1, 'Morning article on 2026-09-11 should be included');
      assert.ok(found2, 'Evening article on 2026-09-11 should be included');
    }),

    test('Regression: Language filter properly isolates articles by language code', () => {
      const artEn = makeTestArticle({
        id: 'test_lang_en',
        title: 'English Language AI Article',
        url: 'https://example.com/lang-en',
        canonical_url: 'https://example.com/lang-en',
        source: 'TechNews',
        source_id: 'tech_en',
        published_at: '2026-09-10T10:00:00Z',
        category: 'technology',
        tags: ['tech'],
        language: 'en',
        source_type: 'news'
      });
      const artFr = makeTestArticle({
        id: 'test_lang_fr',
        title: 'Article sur Intelligence Artificielle',
        url: 'https://example.com/lang-fr',
        canonical_url: 'https://example.com/lang-fr',
        source: 'TechNews FR',
        source_id: 'tech_fr',
        published_at: '2026-09-10T11:00:00Z',
        category: 'technology',
        tags: ['tech'],
        language: 'fr',
        source_type: 'news'
      });
      newsRepository.upsertArticle(artEn);
      newsRepository.upsertArticle(artFr);

      const frQuery = newsRepository.queryArticles({ language: 'fr' });
      assert.ok(frQuery.articles.some(a => a.id === 'test_lang_fr'));
      assert.ok(!frQuery.articles.some(a => a.id === 'test_lang_en'));
    }),

    test('Regression: Channel / publisher filter applies before pagination', () => {
      const artMatt = makeTestArticle({
        id: 'test_video_matt',
        title: 'Matt Wolfe AI Updates and Breakthroughs',
        url: 'https://youtube.com/watch?v=matt_test_vid',
        canonical_url: 'https://youtube.com/watch?v=matt_test_vid',
        source: 'Matt Wolfe AI',
        source_id: 'youtube_mattwolfe',
        publisher: { name: 'Matt Wolfe', domain: 'youtube.com' },
        author: 'Matt Wolfe',
        published_at: '2026-09-11T12:00:00Z',
        category: 'developer-tools',
        tags: ['video'],
        language: 'en',
        source_type: 'video'
      });
      newsRepository.upsertArticle(artMatt);

      const res = newsRepository.queryArticles({
        sourceType: 'video',
        channel: 'Matt Wolfe',
        limit: 10,
        page: 1
      });

      assert.ok(res.total >= 1, 'Total matching channel should be at least 1');
      assert.ok(res.articles.some(a => a.id === 'test_video_matt'));
    }),

    test('Regression: getArticleById falls back to external_id or canonical URL index', () => {
      const art = makeTestArticle({
        id: 'art_ext_lookup_test',
        title: 'Deep Research with Gemini 2.0 Flash',
        url: 'https://arxiv.org/abs/2501.99999',
        canonical_url: 'https://arxiv.org/abs/2501.99999',
        external_id: '2501.99999',
        source: 'ArXiv',
        source_id: 'arxiv',
        published_at: '2026-09-08T10:00:00Z',
        category: 'llms',
        tags: ['llms'],
        language: 'en',
        source_type: 'research'
      });
      newsRepository.upsertArticle(art);

      // Direct ID lookup
      const byDirectId = newsRepository.getArticleById('art_ext_lookup_test');
      assert.ok(byDirectId, 'Direct ID lookup should succeed');

      // Whitespace trimmed ID lookup
      const byTrimmedId = newsRepository.getArticleById('  art_ext_lookup_test  ');
      assert.ok(byTrimmedId, 'Trimmed ID lookup should succeed');

      // Canonical URL lookup
      const byCanonical = newsRepository.getArticleById('https://arxiv.org/abs/2501.99999');
      assert.ok(byCanonical, 'Lookup by canonical URL should resolve to article');

      // External ID fallback lookup
      const byExternalId = newsRepository.getArticleById('2501.99999');
      assert.ok(byExternalId, 'Lookup by external_id should resolve to article');
    }),

    // ==========================================
    // 6. Security Attack & Hardening Tests
    // ==========================================
    test('Security Attack: SSRF blocks private and loopback IPv4 addresses', () => {
      // Standard private / reserved IPv4 addresses
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('127.0.0.1'), true);
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('127.0.0.53'), true);
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('10.0.0.1'), true);
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('10.255.255.254'), true);
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('172.16.0.1'), true);
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('172.31.255.255'), true);
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('192.168.1.1'), true);
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('169.254.169.254'), true); // AWS/Cloud metadata
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('100.64.0.1'), true); // CGNAT
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('0.0.0.0'), true);
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('localhost'), true);
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('sub.localhost'), true);

      // Legitimate public hosts should be allowed
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('google.com'), false);
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('8.8.8.8'), false);
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('1.1.1.1'), false);
    }),

    test('Security Attack: SSRF blocks obfuscated numeric, hex, octal IP representations', () => {
      // Hex representation of 127.0.0.1 (0x7f000001)
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('0x7f000001'), true);
      // Decimal integer representation of 127.0.0.1 (2130706433)
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('2130706433'), true);
      // Hex representation of 169.254.169.254 (0xa9fea9fe)
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('0xa9fea9fe'), true);
      // Decimal integer representation of 169.254.169.254 (2852039166)
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('2852039166'), true);
      // Octal / leading zeros
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('0177.0.0.1'), true);
    }),

    test('Security Attack: SSRF blocks IPv6 loopback, link-local, and unique local addresses', () => {
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('::1'), true);
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('[::1]'), true);
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('fe80::1'), true);
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('fc00::1'), true);
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('fd12:3456::1'), true);
      assert.strictEqual(mediaResolver.isPrivateOrRestrictedHost('::ffff:127.0.0.1'), true);
    }),

    test('Security Attack: Custom source creation rejects malicious URLs and internal targets', () => {
      // Non-HTTP protocol
      assert.throws(() => {
        sourceService.addSource({ name: 'Malicious Source', url: 'file:///etc/passwd' });
      }, ValidationError);

      // Internal localhost target
      assert.throws(() => {
        sourceService.addSource({ name: 'Loopback Target', url: 'http://127.0.0.1:80/feed' });
      }, ValidationError);

      // Cloud metadata target
      assert.throws(() => {
        sourceService.addSource({ name: 'Metadata Target', url: 'http://169.254.169.254/latest/meta-data/' });
      }, ValidationError);

      // Non-standard port target (port scan / exploit)
      assert.throws(() => {
        sourceService.addSource({ name: 'Port Scan Target', url: 'http://example.com:6379/feed' });
      }, ValidationError);
    }),

    test('Security Attack: CSV Formula Injection (CWE-1236) sanitized in feed export', () => {
      const maliciousArticles = [
        makeTestArticle({
          id: 'test_csv_exploit_1',
          title: '=cmd|\' /C calc\'!A0',
          description: '+2+5+cmd',
          author: '-DDE("cmd";"calc";"")',
          category: '@SUM(1,2)'
        })
      ];

      // Temporarily upsert malicious article
      newsRepository.upsertArticle(maliciousArticles[0]);

      const csv = feedService.generateCsv({ limit: 50, search: 'calc' });
      assert.ok(csv.includes("`'=`") || csv.includes("`\"'=`") || csv.includes("\"'=cmd|") || csv.includes("'+2+5+cmd") || csv.includes("'-DDE") || csv.includes("'@SUM"), 'Formulas must be prepended with single quote to prevent spreadsheet execution');
    }),

    test('Security Attack: Admin endpoint auth rejects unauthorized access and timing attacks', () => {
      // Set test admin API key
      const origKey = settings.adminApiKey;
      const origBypass = process.env.ALLOW_DEV_ADMIN_BYPASS;
      delete process.env.ALLOW_DEV_ADMIN_BYPASS;
      (settings as any).adminApiKey = 'super-secret-admin-key-999';

      let nextCalled = false;
      let statusResult = 0;
      let jsonResult: any = null;

      const mockReq: any = {
        headers: { 'x-api-key': 'wrong-password' },
        ip: '203.0.113.1'
      };
      const mockRes: any = {
        status: (code: number) => {
          statusResult = code;
          return {
            json: (payload: any) => { jsonResult = payload; }
          };
        }
      };

      adminAuthMiddleware(mockReq, mockRes, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, false, 'Next should not be called on invalid admin key');
      assert.strictEqual(statusResult, 401, 'Should respond with HTTP 401 Unauthorized');
      assert.strictEqual(jsonResult?.error?.code, 'UNAUTHORIZED');

      // Valid key should succeed
      nextCalled = false;
      mockReq.headers['x-api-key'] = 'super-secret-admin-key-999';
      adminAuthMiddleware(mockReq, mockRes, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true, 'Next should be called on matching valid admin key');

      // Restore settings
      (settings as any).adminApiKey = origKey;
      if (origBypass !== undefined) {
        process.env.ALLOW_DEV_ADMIN_BYPASS = origBypass;
      }
    }),

    test('Security Attack: CORS middleware rejects untrusted origin and null origins', () => {
      let rejected = false;
      const mockReq: any = {
        headers: { origin: 'https://evil-attacker.com' },
        method: 'GET'
      };
      const mockRes: any = {
        setHeader: () => {},
        status: () => ({ end: () => {} })
      };

      corsMiddleware(mockReq, mockRes, (err?: any) => {
        if (err && err.message.includes('Not allowed by CORS policy')) {
          rejected = true;
        }
      });
      assert.strictEqual(rejected, true, 'Untrusted origin https://evil-attacker.com must be blocked by CORS');
    }),

    test('Security Attack: DNS verification rejects resolved loopback and private IPs', async () => {
      const isLoopbackSafe = await mediaResolver.verifyDnsSafety('localhost');
      assert.strictEqual(isLoopbackSafe, false, 'localhost should fail DNS safety check');

      const isNumericLoopbackSafe = await mediaResolver.verifyDnsSafety('127.0.0.1');
      assert.strictEqual(isNumericLoopbackSafe, false, '127.0.0.1 should fail DNS safety check');
    })
  ];

  for (const t of tests) {
    await t();
  }

  console.log('\n========================================');
  console.log(`📊 RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
