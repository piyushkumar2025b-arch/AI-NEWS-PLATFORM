var __defProp = Object.defineProperty;
var __name = (target, value) =>
  __defProp(target, "name", { value, configurable: true });
import { BaseConnector } from "./base.js";
import { SOURCES } from "../config/sources.js";
import { rssProtocol } from "../protocols/rss.js";
import { youtubeClient } from "../clients/youtube_client.js";
import { httpClient } from "../clients/http_client.js";
import { Logger } from "../config/logging.js";
const logger = new Logger("AiPublicationsConnector");
function decodeHtmlEntities(text) {
  if (!text) return "";
  return text
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, "\u2013")
    .replace(/&#8212;/g, "\u2014")
    .replace(/&#038;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
__name(decodeHtmlEntities, "decodeHtmlEntities");
class GenericAiRssConnector extends BaseConnector {
  public defaultCategory: string;
  public defaultPublisher: string;
  public defaultSourceType: string;

  constructor(
    sourceDef: any,
    defaultCategory: string,
    defaultPublisher: string,
    defaultSourceType: string = "news",
  ) {
    super();
    this.protocol = rssProtocol;
    this.definition = sourceDef;
    this.defaultCategory = defaultCategory;
    this.defaultPublisher = defaultPublisher;
    this.defaultSourceType = defaultSourceType;
  }
  static {
    __name(this, "GenericAiRssConnector");
  }
  async fetch(options: any = {}) {
    const startTime = Date.now();
    const limit = Math.min(60, options.limit || 30);
    const channelMatch = this.definition.baseUrl.match(
      /channel_id=([a-zA-Z0-9_-]+)/,
    );
    if (
      channelMatch &&
      (this.definition.id.startsWith("youtube_") ||
        this.defaultSourceType === "video") &&
      youtubeClient.isConfigured()
    ) {
      try {
        const channelId = channelMatch[1];
        const ytVideos = await youtubeClient.fetchChannelVideos(
          channelId,
          limit,
        );
        if (ytVideos && ytVideos.length > 0) {
          const rawItems2 = ytVideos.map((v) => ({
            title: decodeHtmlEntities(v.title),
            url: v.videoUrl,
            description:
              decodeHtmlEntities(v.description.slice(0, 500)) ||
              `${this.defaultPublisher} video on AI and frontier technology.`,
            imageUrl: v.thumbnailUrl,
            media: [
              {
                type: "image",
                url: v.thumbnailUrl,
                mimeType: "image/jpeg",
                source: "metadata",
              },
              {
                type: "video",
                url: v.embedUrl,
                mimeType: "video/youtube",
                source: "metadata",
              },
            ],
            sourceId: this.definition.id,
            sourceName: this.definition.name,
            publisherName: v.channelTitle || this.defaultPublisher,
            author: v.channelTitle || this.defaultPublisher,
            publishedAt: v.publishedAt,
            category: this.defaultCategory,
            tags: [
              "video",
              "youtube",
              "ai",
              this.defaultCategory,
              ...(v.tags || []).slice(0, 5).map((t) => t.toLowerCase()),
            ],
            sourceType: "video",
            externalId: v.id,
            recordOrigin: "live",
            metrics: { views: v.views, likes: v.likes, comments: v.comments },
            rawMetadata: {
              videoId: v.id,
              channelId: v.channelId,
              duration: v.duration,
              views: v.views,
              likes: v.likes,
              comments: v.comments,
              apiSource: "youtube_data_api_v3",
            },
          }));
          logger.info(
            `Fetched ${rawItems2.length} videos from YouTube Data API v3 for ${this.definition.name}`,
          );
          return {
            sourceId: this.definition.id,
            sourceName: this.definition.name,
            rawItems: rawItems2,
            durationMs: Date.now() - startTime,
          };
        }
      } catch (err) {
        logger.warn(
          `YouTube Data API v3 fetch failed for ${this.definition.name}, falling back to RSS: ${err.message}`,
        );
      }
    }
    let feed;
    try {
      feed = await this.protocol.fetchData({
        sourceId: this.definition.id,
        url: this.definition.baseUrl,
        timeoutMs: this.definition.timeoutMs,
        maxRetries: this.definition.maxRetries,
      });
    } catch (feedErr: any) {
      const isYouTube =
        this.definition.id.startsWith("youtube_") ||
        this.definition.baseUrl.includes("youtube.com") ||
        this.defaultSourceType === "video";
      const cleanPub = this.defaultPublisher.replace(/["']/g, "").trim();
      let query = "";
      if (isYouTube) {
        query = `site:youtube.com "${cleanPub}"`;
      } else if (this.definition.baseUrl.includes("scale.com")) {
        query = `site:scale.com/blog`;
      } else if (this.definition.baseUrl.includes("stability.ai")) {
        query = `site:stability.ai`;
      } else if (this.definition.baseUrl.includes("eleuther.ai")) {
        query = `site:eleuther.ai`;
      } else {
        query = `"${cleanPub}" AI technology`;
      }

      let bridgeSuccess = false;

      // Tier 1 Bridge: Bing News RSS (highly resilient, doesn't 503 cloud container egress)
      try {
        const bingBridgeUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`;
        feed = await this.protocol.fetchData({
          sourceId: this.definition.id,
          url: bingBridgeUrl,
          timeoutMs: Math.min(10000, this.definition.timeoutMs || 10000),
          maxRetries: 1,
        });
        if (feed && feed.items && feed.items.length > 0) {
          bridgeSuccess = true;
        }
      } catch (bingErr: any) {
        logger.debug(`Bing bridge fallback note for ${this.definition.name}: ${bingErr.message}`);
      }

      // Tier 2 Bridge: Google News RSS (if Bing returned empty or errored)
      if (!bridgeSuccess) {
        try {
          const bridgeUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
          feed = await this.protocol.fetchData({
            sourceId: this.definition.id,
            url: bridgeUrl,
            timeoutMs: Math.min(8000, this.definition.timeoutMs || 8000),
            maxRetries: 1,
          });
          if (feed && feed.items && feed.items.length > 0) {
            bridgeSuccess = true;
          }
        } catch (bridgeErr: any) {
          logger.debug(`Syndication fallback for ${this.definition.name} completed: ${bridgeErr.message}`);
        }
      }

      if (!bridgeSuccess || !feed) {
        return {
          sourceId: this.definition.id,
          sourceName: this.definition.name,
          rawItems: [],
          durationMs: Date.now() - startTime,
        };
      }
    }
    const rawItems = [];
    for (const item of (feed.items || []).slice(0, limit)) {
      if (!item.title || !item.link) continue;
      let cleanTitle = decodeHtmlEntities(item.title);
      cleanTitle = cleanTitle
        .replace(/\s*-\s*YouTube$/i, "")
        .replace(
          new RegExp(
            `\\s*-\\s*${this.defaultPublisher.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`,
            "i",
          ),
          "",
        )
        .trim();
      const cleanDesc = decodeHtmlEntities(
        (item.description || item.content || "")
          .replace(/<[^>]*>?/gm, "")
          .slice(0, 500),
      );
      const mediaList = [...(item.media || [])];
      let resolvedUrl = item.link;
      if (resolvedUrl && !resolvedUrl.startsWith("http")) {
        try {
          resolvedUrl = new URL(resolvedUrl, this.definition.baseUrl).href;
        } catch {}
      }
      const ytIdMatch = (
        resolvedUrl +
        " " +
        (item.guid || "") +
        " " +
        mediaList.map((m) => m.url).join(" ")
      ).match(
        /(?:youtube\.com\/(?:watch\?v=|v\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      );
      let primaryImage =
        item.imageUrl &&
        !item.imageUrl.includes(".swf") &&
        !item.imageUrl.includes("/v/")
          ? item.imageUrl
          : null;
      if (ytIdMatch) {
        const ytId = ytIdMatch[1];
        primaryImage = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
        if (!mediaList.some((m) => m.url === primaryImage)) {
          mediaList.unshift({
            type: "image",
            url: primaryImage,
            mimeType: "image/jpeg",
            source: "feed",
          });
        }
        if (!mediaList.some((m) => m.type === "video")) {
          mediaList.push({
            type: "video",
            url: `https://www.youtube-nocookie.com/embed/${ytId}`,
            mimeType: "video/youtube",
            source: "feed",
          });
        }
      } else if (!primaryImage && mediaList.length > 0) {
        const firstImg = mediaList.find(
          (m) =>
            m.type === "image" &&
            !m.url.includes(".swf") &&
            !m.url.includes("/v/"),
        );
        if (firstImg) primaryImage = firstImg.url;
      }
      if (!primaryImage) {
        primaryImage = null;
      }
      rawItems.push({
        title: cleanTitle,
        url: resolvedUrl,
        description: cleanDesc || "",
        imageUrl: primaryImage,
        media: mediaList,
        sourceId: this.definition.id,
        sourceName: this.definition.name,
        publisherName: this.defaultPublisher,
        author: item.author || this.defaultPublisher,
        publishedAt: item.pubDate || new Date().toISOString(),
        category: this.defaultCategory,
        tags: [
          "ai",
          "technology",
          this.defaultCategory,
          ...(item.categories || []).map((c) => c.toLowerCase()),
        ],
        sourceType: this.defaultSourceType,
        externalId: item.guid || item.link,
        rawMetadata: {
          originalTitle: item.title,
          categories: item.categories,
          feedTitle: feed.title,
        },
      });
    }
    return {
      sourceId: this.definition.id,
      sourceName: this.definition.name,
      rawItems,
      durationMs: Date.now() - startTime,
    };
  }
}
const deepmindConnector = new GenericAiRssConnector(
  SOURCES.deepmind,
  "ai",
  "Google DeepMind",
);
const openAiConnector = new GenericAiRssConnector(
  SOURCES.openai,
  "llms",
  "OpenAI",
);
const techcrunchAiConnector = new GenericAiRssConnector(
  SOURCES.techcrunch_ai,
  "ai",
  "TechCrunch",
);
const venturebeatAiConnector = new GenericAiRssConnector(
  SOURCES.venturebeat_ai,
  "ai-agents",
  "VentureBeat",
);
const thevergeAiConnector = new GenericAiRssConnector(
  SOURCES.theverge_ai,
  "technology",
  "The Verge",
);
const mitTechReviewConnector = new GenericAiRssConnector(
  SOURCES.mit_tech_review,
  "research",
  "MIT Technology Review",
);
const arstechnicaConnector = new GenericAiRssConnector(
  SOURCES.arstechnica,
  "ai-hardware",
  "Ars Technica",
);
const hfBlogConnector = new GenericAiRssConnector(
  SOURCES.hf_blog,
  "open-source-ai",
  "Hugging Face Blog",
);
const lastWeekInAiConnector = new GenericAiRssConnector(
  SOURCES.last_week_in_ai,
  "ai",
  "Last Week in AI",
);
const bbcTechConnector = new GenericAiRssConnector(
  SOURCES.bbc_tech,
  "technology",
  "BBC News",
);
const wiredConnector = new GenericAiRssConnector(
  SOURCES.wired,
  "technology",
  "Wired",
);
const engadgetConnector = new GenericAiRssConnector(
  SOURCES.engadget,
  "technology",
  "Engadget",
);
const siliconangleConnector = new GenericAiRssConnector(
  SOURCES.siliconangle,
  "cloud",
  "SiliconANGLE",
);
const ieeeSpectrumConnector = new GenericAiRssConnector(
  SOURCES.ieee_spectrum,
  "research",
  "IEEE Spectrum",
);
const techmemeConnector = new GenericAiRssConnector(
  SOURCES.techmeme,
  "technology",
  "Techmeme",
);
const theregisterConnector = new GenericAiRssConnector(
  SOURCES.theregister,
  "technology",
  "The Register",
);
const guardianAiConnector = new GenericAiRssConnector(
  SOURCES.guardian_ai,
  "ai",
  "The Guardian",
);
const nvidiaBlogConnector = new GenericAiRssConnector(
  SOURCES.nvidia_blog,
  "ai",
  "NVIDIA",
);
const awsMlConnector = new GenericAiRssConnector(
  SOURCES.aws_ml,
  "cloud",
  "Amazon Web Services",
);
const googleResearchConnector = new GenericAiRssConnector(
  SOURCES.google_research,
  "research",
  "Google Research",
);
const simonwAiConnector = new GenericAiRssConnector(
  SOURCES.simonw_ai,
  "ai",
  "Simon Willison",
);
const euronewsNextConnector = new GenericAiRssConnector(
  SOURCES.euronews_next,
  "technology",
  "Euronews Next",
);
const scmpTechConnector = new GenericAiRssConnector(
  SOURCES.scmp_tech,
  "technology",
  "South China Morning Post",
);
const ytTwoMinutePapersConnector = new GenericAiRssConnector(
  SOURCES.youtube_twominutepapers,
  "ai",
  "Two Minute Papers",
  "video",
);
const ytAiExplainedConnector = new GenericAiRssConnector(
  SOURCES.youtube_aiexplained,
  "ai",
  "AI Explained",
  "video",
);
const ytMattWolfeConnector = new GenericAiRssConnector(
  SOURCES.youtube_mattwolfe,
  "developer-tools",
  "Matt Wolfe",
  "video",
);
const ytDeepmindConnector = new GenericAiRssConnector(
  SOURCES.youtube_deepmind,
  "research",
  "Google DeepMind",
  "video",
);
const ytFireshipConnector = new GenericAiRssConnector(
  SOURCES.youtube_fireship,
  "programming",
  "Fireship",
  "video",
);
const practicalAiConnector = new GenericAiRssConnector(
  SOURCES.practical_ai,
  "ai",
  "Practical AI",
  "podcast",
);
const twimlAiConnector = new GenericAiRssConnector(
  SOURCES.twiml_ai,
  "machine-learning",
  "TWIML AI",
  "podcast",
);
const lexFridmanConnector = new GenericAiRssConnector(
  SOURCES.lex_fridman,
  "ai",
  "Lex Fridman",
  "podcast",
);
const tomsHardwareConnector = new GenericAiRssConnector(
  SOURCES.toms_hardware,
  "ai-hardware",
  "Tom's Hardware",
  "news",
);
const theHinduTechConnector = new GenericAiRssConnector(
  SOURCES.the_hindu_tech,
  "technology",
  "The Hindu",
  "news",
);
const siliconRepublicConnector = new GenericAiRssConnector(
  SOURCES.silicon_republic,
  "technology",
  "Silicon Republic",
  "news",
);
const hackernoonAiConnector = new GenericAiRssConnector(
  SOURCES.hackernoon_ai,
  "developer-tools",
  "HackerNoon",
  "news",
);
class NatureAiConnector extends GenericAiRssConnector {
  static {
    __name(this, "NatureAiConnector");
  }
  constructor() {
    super(SOURCES.nature_ai, "research", "Nature", "research");
  }
  async fetch(options: any = {}) {
    try {
      const result = await super.fetch(options);
      if (result.rawItems && result.rawItems.length > 0) {
        return result;
      }
    } catch (err) {
      logger.warn(
        `Nature primary RSS feed encountered issue (${err.message}). Activating Crossref Nature AI research index fallback.`,
      );
    }
    const startTime = Date.now();
    const limit = Math.min(options.limit || 30, 40);
    const rawItems = [];
    try {
      const crossrefUrl = `https://api.crossref.org/works?filter=prefix:10.1038&query=artificial+intelligence&sort=published&order=desc&rows=${limit}`;
      const res = await httpClient.get(crossrefUrl, {
        sourceId: "nature_ai",
        timeoutMs: 12e3,
        maxRetries: 2,
        headers: {
          "User-Agent":
            "AntigravityNews/1.0 (mailto:admin@antigravitynews.com)",
        },
      });
      const items = res.data?.message?.items || [];
      for (const it of items) {
        const title = decodeHtmlEntities(it.title?.[0] || "");
        if (!title || title.length < 5) continue;
        const journal = it["container-title"]?.[0] || "Nature Portfolio";
        const rawAbstract =
          typeof it.abstract === "string"
            ? it.abstract.replace(/<[^>]*>/g, "").trim()
            : "";
        const desc = rawAbstract
          ? rawAbstract.slice(0, 500)
          : `Peer-reviewed scientific study published in ${journal} exploring machine learning, artificial intelligence, and algorithmic frontiers.`;
        const authorList = (it.author || [])
          .map((a) => `${a.given || ""} ${a.family || ""}`.trim())
          .filter(Boolean);
        const authorStr =
          authorList.slice(0, 4).join(", ") +
            (authorList.length > 4 ? " et al." : "") || "Nature Research";
        const dParts = it.published?.["date-parts"]?.[0] || [];
        let publishedAt = new Date().toISOString();
        if (dParts.length >= 3) {
          publishedAt = new Date(
            Date.UTC(dParts[0], dParts[1] - 1, dParts[2]),
          ).toISOString();
        } else if (dParts.length === 1) {
          publishedAt = new Date(Date.UTC(dParts[0], 0, 1)).toISOString();
        }
        rawItems.push({
          title,
          url:
            it.URL ||
            (it.DOI ? `https://doi.org/${it.DOI}` : this.definition.baseUrl),
          description: desc,
          imageUrl: null,
          media: [],
          sourceId: this.definition.id,
          sourceName: this.definition.name,
          publisherName: "Nature",
          author: authorStr,
          publishedAt,
          category: "research",
          tags: ["research", "ai", "science", "nature", "peer-reviewed"],
          sourceType: "research",
          externalId: it.DOI || it.URL || title,
          rawMetadata: { doi: it.DOI, journal, publisher: it.publisher },
        });
      }
    } catch (fallbackErr) {
      logger.error(
        `Nature Crossref fallback also failed: ${fallbackErr.message}`,
      );
    }
    return {
      sourceId: this.definition.id,
      sourceName: this.definition.name,
      rawItems,
      durationMs: Date.now() - startTime,
    };
  }
}
const natureAiConnector = new NatureAiConnector();
const msResearchConnector = new GenericAiRssConnector(
  SOURCES.ms_research,
  "research",
  "Microsoft Research",
  "research",
);
const stanfordHaiConnector = new GenericAiRssConnector(
  SOURCES.stanford_hai,
  "research",
  "Stanford HAI",
  "research",
);
const mitAiNewsConnector = new GenericAiRssConnector(
  SOURCES.mit_ai_news,
  "research",
  "MIT News",
  "research",
);
const theGradientConnector = new GenericAiRssConnector(
  SOURCES.the_gradient,
  "research",
  "The Gradient",
  "research",
);
const latentSpaceConnector = new GenericAiRssConnector(
  SOURCES.latent_space,
  "developer-tools",
  "Latent Space",
  "podcast",
);
const importAiConnector = new GenericAiRssConnector(
  SOURCES.import_ai,
  "research",
  "Import AI",
  "news",
);
const interconnectsConnector = new GenericAiRssConnector(
  SOURCES.interconnects,
  "research",
  "Interconnects",
  "research",
);
const semianalysisConnector = new GenericAiRssConnector(
  SOURCES.semianalysis,
  "ai-hardware",
  "SemiAnalysis",
  "news",
);
const marktechpostConnector = new GenericAiRssConnector(
  SOURCES.marktechpost,
  "machine-learning",
  "MarkTechPost",
  "news",
);
const kdnuggetsConnector = new GenericAiRssConnector(
  SOURCES.kdnuggets,
  "machine-learning",
  "KDnuggets",
  "news",
);
const metaAiConnector = new GenericAiRssConnector(
  SOURCES.meta_ai,
  "open-source-ai",
  "Meta AI",
  "research",
);
const appleMlConnector = new GenericAiRssConnector(
  SOURCES.apple_ml,
  "research",
  "Apple ML",
  "research",
);
const marketingAiInstituteConnector = new GenericAiRssConnector(
  SOURCES.marketing_ai_institute,
  "advertising",
  "Marketing AI Institute",
  "news",
);
const searchenginelandAiConnector = new GenericAiRssConnector(
  SOURCES.searchengineland_ai,
  "advertising",
  "Search Engine Land",
  "news",
);
const adexchangerConnector = new GenericAiRssConnector(
  SOURCES.adexchanger,
  "advertising",
  "AdExchanger",
  "news",
);
const socialMediaExaminerConnector = new GenericAiRssConnector(
  SOURCES.social_media_examiner,
  "social-media",
  "Social Media Examiner",
  "news",
);
const wandbFcConnector = new GenericAiRssConnector(
  SOURCES.wandb_fc,
  "developer-tools",
  "Weights & Biases",
  "news",
);
const towardsDataScienceConnector = new GenericAiRssConnector(
  SOURCES.towards_data_science,
  "machine-learning",
  "Towards Data Science",
  "news",
);
const aheadOfAiConnector = new GenericAiRssConnector(
  SOURCES.ahead_of_ai,
  "research",
  "Ahead of AI",
  "research",
);
const oneUsefulThingConnector = new GenericAiRssConnector(
  SOURCES.one_useful_thing,
  "ai",
  "One Useful Thing",
  "research",
);
const aiSupremacyConnector = new GenericAiRssConnector(
  SOURCES.ai_supremacy,
  "ai",
  "AI Supremacy",
  "news",
);
const marcusOnAiConnector = new GenericAiRssConnector(
  SOURCES.marcus_on_ai,
  "ethics",
  "Marcus on AI",
  "research",
);
const algorithmicBridgeConnector = new GenericAiRssConnector(
  SOURCES.algorithmic_bridge,
  "ai",
  "The Algorithmic Bridge",
  "research",
);
const githubAiBlogConnector = new GenericAiRssConnector(
  SOURCES.github_ai_blog,
  "developer-tools",
  "GitHub AI Blog",
  "code",
);
const nvidiaDevBlogConnector = new GenericAiRssConnector(
  SOURCES.nvidia_dev_blog,
  "ai-hardware",
  "NVIDIA Technical Blog",
  "code",
);
const weaviateBlogConnector = new GenericAiRssConnector(
  SOURCES.weaviate_blog,
  "developer-tools",
  "Weaviate Blog",
  "code",
);
const togetherAiConnector = new GenericAiRssConnector(
  SOURCES.together_ai,
  "open-source-ai",
  "Together AI",
  "code",
);
const aiBusinessConnector = new GenericAiRssConnector(
  SOURCES.ai_business,
  "ai",
  "AI Business",
  "news",
);
const bairBlogConnector = new GenericAiRssConnector(
  SOURCES.bair_blog,
  "research",
  "UC Berkeley BAIR",
  "research",
);
const aiNewsConnector = new GenericAiRssConnector(
  SOURCES.ai_news,
  "ai",
  "AI News",
  "news",
);
const mlMasteryConnector = new GenericAiRssConnector(
  SOURCES.ml_mastery,
  "machine-learning",
  "Machine Learning Mastery",
  "news",
);
const towardsAiConnector = new GenericAiRssConnector(
  SOURCES.towards_ai,
  "open-source-ai",
  "Towards AI",
  "news",
);
const understandingAiConnector = new GenericAiRssConnector(
  SOURCES.understanding_ai,
  "ai",
  "Understanding AI",
  "research",
);
const analyticsVidhyaConnector = new GenericAiRssConnector(
  SOURCES.analytics_vidhya,
  "developer-tools",
  "Analytics Vidhya",
  "news",
);
const turingInstituteConnector = new GenericAiRssConnector(
  SOURCES.turing_institute,
  "research",
  "Alan Turing Institute",
  "research",
);
const fastcompanyAiConnector = new GenericAiRssConnector(
  SOURCES.fastcompany_ai,
  "technology",
  "Fast Company",
  "news",
);
const openaiOfficialConnector = new GenericAiRssConnector(
  SOURCES.openai_official,
  "ai",
  "OpenAI",
  "research",
);
const anthropicAiConnector = new GenericAiRssConnector(
  SOURCES.anthropic_ai,
  "ai",
  "Anthropic",
  "research",
);
const mistralAiConnector = new GenericAiRssConnector(
  SOURCES.mistral_ai,
  "open-source-ai",
  "Mistral AI",
  "news",
);
const deepseekAiConnector = new GenericAiRssConnector(
  SOURCES.deepseek_ai,
  "open-source-ai",
  "DeepSeek AI",
  "research",
);
const perplexityAiConnector = new GenericAiRssConnector(
  SOURCES.perplexity_ai,
  "ai",
  "Perplexity AI",
  "news",
);
const cbsTechConnector = new GenericAiRssConnector(
  SOURCES.cbs_tech,
  "technology",
  "CBS News",
  "news",
);
const cnbcTechConnector = new GenericAiRssConnector(
  SOURCES.cnbc_tech,
  "technology",
  "CNBC",
  "news",
);
const bloombergTechConnector = new GenericAiRssConnector(
  SOURCES.bloomberg_tech,
  "technology",
  "Bloomberg",
  "news",
);
const cnnTechConnector = new GenericAiRssConnector(
  SOURCES.cnn_tech,
  "technology",
  "CNN",
  "news",
);
const ytYannicKilcherConnector = new GenericAiRssConnector(
  SOURCES.youtube_yannickilcher,
  "ai",
  "Yannic Kilcher",
  "video",
);
const ytWesRothConnector = new GenericAiRssConnector(
  SOURCES.youtube_wesroth,
  "ai",
  "Wes Roth",
  "video",
);
const reutersTechConnector = new GenericAiRssConnector(
  SOURCES.reuters_tech,
  "technology",
  "Reuters",
  "news",
);
const financialTimesConnector = new GenericAiRssConnector(
  SOURCES.financial_times,
  "ai",
  "Financial Times",
  "news",
);
const apNewsTechConnector = new GenericAiRssConnector(
  SOURCES.ap_news_tech,
  "technology",
  "Associated Press",
  "news",
);
const wsjTechConnector = new GenericAiRssConnector(
  SOURCES.wsj_tech,
  "technology",
  "The Wall Street Journal",
  "news",
);
const nikkeiAsiaConnector = new GenericAiRssConnector(
  SOURCES.nikkei_asia,
  "semiconductors",
  "Nikkei Asia",
  "news",
);
const dwTechConnector = new GenericAiRssConnector(
  SOURCES.dw_tech,
  "technology",
  "Deutsche Welle",
  "news",
);
const france24TechConnector = new GenericAiRssConnector(
  SOURCES.france24_tech,
  "technology",
  "France 24",
  "news",
);
const straitsTimesConnector = new GenericAiRssConnector(
  SOURCES.straits_times,
  "technology",
  "The Straits Times",
  "news",
);
const alJazeeraTechConnector = new GenericAiRssConnector(
  SOURCES.al_jazeera_tech,
  "technology",
  "Al Jazeera English",
  "news",
);
const koreaHeraldConnector = new GenericAiRssConnector(
  SOURCES.korea_herald,
  "semiconductors",
  "The Korea Herald",
  "news",
);
const restOfWorldConnector = new GenericAiRssConnector(
  SOURCES.rest_of_world,
  "technology",
  "Rest of World",
  "news",
);
const siftedEuConnector = new GenericAiRssConnector(
  SOURCES.sifted_eu,
  "startups",
  "Sifted EU",
  "news",
);
const abcAustraliaTechConnector = new GenericAiRssConnector(
  SOURCES.abc_australia_tech,
  "technology",
  "ABC News Australia",
  "news",
);
const telegraphTechConnector = new GenericAiRssConnector(
  SOURCES.telegraph_tech,
  "technology",
  "The Telegraph",
  "news",
);
const cohereBlogConnector = new GenericAiRssConnector(
  SOURCES.cohere_blog,
  "llms",
  "Cohere Research",
  "research",
);
const scaleAiBlogConnector = new GenericAiRssConnector(
  SOURCES.scale_ai_blog,
  "ai",
  "Scale AI",
  "research",
);
const eleutherAiConnector = new GenericAiRssConnector(
  SOURCES.eleuther_ai,
  "open-source-ai",
  "EleutherAI",
  "research",
);
const allenAiConnector = new GenericAiRssConnector(
  SOURCES.allen_ai,
  "research",
  "Allen Institute for AI",
  "research",
);
const stabilityAiConnector = new GenericAiRssConnector(
  SOURCES.stability_ai,
  "computer-vision",
  "Stability AI",
  "news",
);
const characterAiConnector = new GenericAiRssConnector(
  SOURCES.character_ai,
  "ai-agents",
  "Character.AI",
  "news",
);
const ieeeRoboticsConnector = new GenericAiRssConnector(
  SOURCES.ieee_robotics,
  "robotics",
  "IEEE Spectrum Robotics",
  "news",
);
const theRobotReportConnector = new GenericAiRssConnector(
  SOURCES.the_robot_report,
  "robotics",
  "The Robot Report",
  "news",
);
const bostonDynamicsConnector = new GenericAiRssConnector(
  SOURCES.boston_dynamics,
  "robotics",
  "Boston Dynamics",
  "research",
);
const cerebrasBlogConnector = new GenericAiRssConnector(
  SOURCES.cerebras_blog,
  "semiconductors",
  "Cerebras Systems",
  "news",
);
const groqBlogConnector = new GenericAiRssConnector(
  SOURCES.groq_blog,
  "semiconductors",
  "Groq Inc.",
  "news",
);
const semiwikiConnector = new GenericAiRssConnector(
  SOURCES.semiwiki,
  "semiconductors",
  "SemiWiki",
  "news",
);
const tomshardwareSiliconConnector = new GenericAiRssConnector(
  SOURCES.tomshardware_silicon,
  "semiconductors",
  "Tom's Hardware",
  "news",
);
const langchainBlogConnector = new GenericAiRssConnector(
  SOURCES.langchain_blog,
  "ai-agents",
  "LangChain",
  "code",
);
const llamaindexBlogConnector = new GenericAiRssConnector(
  SOURCES.llamaindex_blog,
  "developer-tools",
  "LlamaIndex",
  "code",
);
const pineconeBlogConnector = new GenericAiRssConnector(
  SOURCES.pinecone_blog,
  "developer-tools",
  "Pinecone",
  "code",
);
const qdrantBlogConnector = new GenericAiRssConnector(
  SOURCES.qdrant_blog,
  "developer-tools",
  "Qdrant",
  "code",
);
const vllmProjectConnector = new GenericAiRssConnector(
  SOURCES.vllm_project,
  "open-source-ai",
  "vLLM Project",
  "code",
);
const ollamaBlogConnector = new GenericAiRssConnector(
  SOURCES.ollama_blog,
  "open-source-ai",
  "Ollama",
  "code",
);
const unslothBlogConnector = new GenericAiRssConnector(
  SOURCES.unsloth_blog,
  "developer-tools",
  "Unsloth AI",
  "code",
);
const cmuScsNewsConnector = new GenericAiRssConnector(
  SOURCES.cmu_scs_news,
  "research",
  "Carnegie Mellon University",
  "research",
);
const oxfordAiInstituteConnector = new GenericAiRssConnector(
  SOURCES.oxford_ai_institute,
  "research",
  "University of Oxford",
  "research",
);
const maxPlanckIsConnector = new GenericAiRssConnector(
  SOURCES.max_planck_is,
  "research",
  "Max Planck Institute",
  "research",
);
const princetonPliConnector = new GenericAiRssConnector(
  SOURCES.princeton_pli,
  "research",
  "Princeton University",
  "research",
);
const ibmQuantumBlogConnector = new GenericAiRssConnector(
  SOURCES.ibm_quantum_blog,
  "research",
  "IBM Quantum",
  "research",
);
const quantamagazineAiConnector = new GenericAiRssConnector(
  SOURCES.quantamagazine_ai,
  "research",
  "Quanta Magazine",
  "research",
);
const natureMachineIntelligenceConnector = new GenericAiRssConnector(
  SOURCES.nature_machine_intelligence,
  "research",
  "Nature Publishing Group",
  "research",
);
const alignmentForumConnector = new GenericAiRssConnector(
  SOURCES.alignment_forum,
  "research",
  "AI Alignment Forum",
  "research",
);
const epochAiConnector = new GenericAiRssConnector(
  SOURCES.epoch_ai,
  "research",
  "Epoch AI",
  "research",
);
const csisStrategicTechConnector = new GenericAiRssConnector(
  SOURCES.csis_strategic_tech,
  "technology",
  "CSIS Strategic Technologies",
  "news",
);
const mitCsailConnector = new GenericAiRssConnector(
  SOURCES.mit_csail,
  "research",
  "MIT CSAIL",
  "research",
);
const deeplearningAiBatchConnector = new GenericAiRssConnector(
  SOURCES.deeplearning_ai_batch,
  "ai",
  "DeepLearning.AI",
  "news",
);
const vercelBlogConnector = new GenericAiRssConnector(
  SOURCES.vercel_blog,
  "developer-tools",
  "Vercel",
  "news",
);
const githubBlogConnector = new GenericAiRssConnector(
  SOURCES.github_blog,
  "developer-tools",
  "GitHub",
  "news",
);
const stackoverflowBlogConnector = new GenericAiRssConnector(
  SOURCES.stackoverflow_blog,
  "developer-tools",
  "Stack Overflow",
  "news",
);
const pragmaticEngineerConnector = new GenericAiRssConnector(
  SOURCES.pragmatic_engineer,
  "technology",
  "The Pragmatic Engineer",
  "news",
);
const bytebytegoConnector = new GenericAiRssConnector(
  SOURCES.bytebytego,
  "technology",
  "ByteByteGo",
  "news",
);
const benEvansConnector = new GenericAiRssConnector(
  SOURCES.ben_evans,
  "policy",
  "Benedict Evans",
  "news",
);
const stratecheryConnector = new GenericAiRssConnector(
  SOURCES.stratechery,
  "startups",
  "Stratechery",
  "news",
);
const theHackerNewsConnector = new GenericAiRssConnector(
  SOURCES.thehackernews,
  "technology",
  "The Hacker News",
  "news",
);
const bleepingComputerConnector = new GenericAiRssConnector(
  SOURCES.bleepingcomputer,
  "technology",
  "BleepingComputer",
  "news",
);
const krebsOnSecurityConnector = new GenericAiRssConnector(
  SOURCES.krebsonsecurity,
  "technology",
  "Krebs on Security",
  "news",
);
const darkReadingConnector = new GenericAiRssConnector(
  SOURCES.darkreading,
  "technology",
  "Dark Reading",
  "news",
);
const schneierSecurityConnector = new GenericAiRssConnector(
  SOURCES.schneier_security,
  "technology",
  "Schneier on Security",
  "news",
);
const serveTheHomeConnector = new GenericAiRssConnector(
  SOURCES.servethehome,
  "semiconductors",
  "ServeTheHome",
  "news",
);
const nextPlatformConnector = new GenericAiRssConnector(
  SOURCES.nextplatform,
  "semiconductors",
  "The Next Platform",
  "news",
);
const eeTimesConnector = new GenericAiRssConnector(
  SOURCES.eetimes,
  "semiconductors",
  "EE Times",
  "news",
);
const scienceDailyAiConnector = new GenericAiRssConnector(
  SOURCES.sciencedaily_ai,
  "research",
  "ScienceDaily",
  "research",
);
const cloudflareBlogConnector = new GenericAiRssConnector(
  SOURCES.cloudflare_blog,
  "developer-tools",
  "Cloudflare",
  "news",
);
const dockerBlogConnector = new GenericAiRssConnector(
  SOURCES.docker_blog,
  "developer-tools",
  "Docker",
  "news",
);
const techInAsiaConnector = new GenericAiRssConnector(
  SOURCES.techinasia,
  "startups",
  "Tech in Asia",
  "news",
);
const inc42Connector = new GenericAiRssConnector(
  SOURCES.inc42,
  "startups",
  "Inc42",
  "news",
);
const techpointAfricaConnector = new GenericAiRssConnector(
  SOURCES.techpoint_africa,
  "startups",
  "Techpoint Africa",
  "news",
);
const dwarkeshPodcastConnector = new GenericAiRssConnector(
  SOURCES.dwarkesh_podcast,
  "ai",
  "Dwarkesh Podcast",
  "podcast",
);
const nasaBreakingConnector = new GenericAiRssConnector(
  SOURCES.nasa_breaking,
  "research",
  "NASA",
  "news",
);
const spaceNewsConnector = new GenericAiRssConnector(
  SOURCES.spacenews,
  "technology",
  "SpaceNews",
  "news",
);
const esaNewsConnector = new GenericAiRssConnector(
  SOURCES.esa_news,
  "research",
  "European Space Agency",
  "news",
);
const natureNewsConnector = new GenericAiRssConnector(
  SOURCES.nature_news,
  "research",
  "Nature Portfolio",
  "news",
);
const kubernetesBlogConnector = new GenericAiRssConnector(
  SOURCES.kubernetes_blog,
  "developer-tools",
  "Kubernetes CNCF",
  "news",
);
const awsArchitectureConnector = new GenericAiRssConnector(
  SOURCES.aws_architecture,
  "developer-tools",
  "AWS",
  "news",
);
const awsAiBlogConnector = new GenericAiRssConnector(
  SOURCES.aws_ai_blog,
  "ai",
  "AWS Machine Learning",
  "news",
);
const golangBlogConnector = new GenericAiRssConnector(
  SOURCES.golang_blog,
  "developer-tools",
  "Go Language Team",
  "news",
);
const rustBlogConnector = new GenericAiRssConnector(
  SOURCES.rust_blog,
  "developer-tools",
  "Rust Foundation",
  "news",
);
const mozillaHacksConnector = new GenericAiRssConnector(
  SOURCES.mozilla_hacks,
  "developer-tools",
  "Mozilla Hacks",
  "news",
);
const phoronixLinuxConnector = new GenericAiRssConnector(
  SOURCES.phoronix_linux,
  "semiconductors",
  "Phoronix",
  "news",
);
const metaEngineeringConnector = new GenericAiRssConnector(
  SOURCES.meta_engineering,
  "developer-tools",
  "Meta Engineering",
  "news",
);
const netflixTechblogConnector = new GenericAiRssConnector(
  SOURCES.netflix_techblog,
  "developer-tools",
  "Netflix",
  "news",
);
const wiredSecurityConnector = new GenericAiRssConnector(
  SOURCES.wired_security,
  "technology",
  "Wired Security",
  "news",
);
const wiredBusinessConnector = new GenericAiRssConnector(
  SOURCES.wired_business,
  "startups",
  "Wired Business",
  "news",
);
const slashdotConnector = new GenericAiRssConnector(
  SOURCES.slashdot,
  "technology",
  "Slashdot",
  "news",
);
const canaryMediaConnector = new GenericAiRssConnector(
  SOURCES.canary_media,
  "technology",
  "Canary Media",
  "news",
);
const electrekCoConnector = new GenericAiRssConnector(
  SOURCES.electrek_co,
  "technology",
  "Electrek",
  "news",
);
const neuroscienceNewsConnector = new GenericAiRssConnector(
  SOURCES.neurosciencenews,
  "research",
  "Neuroscience News",
  "research",
);
const statNewsConnector = new GenericAiRssConnector(
  SOURCES.statnews,
  "research",
  "STAT News",
  "news",
);
const redHatBlogConnector = new GenericAiRssConnector(
  SOURCES.redhat_blog,
  "developer-tools",
  "Red Hat",
  "news",
);
const replicateBlogConnector = new GenericAiRssConnector(
  SOURCES.replicate_blog,
  "open-source-ai",
  "Replicate",
  "news",
);
const simonWillisonConnector = new GenericAiRssConnector(
  SOURCES.simon_willison,
  "ai",
  "Simon Willison",
  "news",
);
const lilianWengConnector = new GenericAiRssConnector(
  SOURCES.lilian_weng,
  "ai",
  "Lilian Weng",
  "research",
);
const sebastianRaschkaConnector = new GenericAiRssConnector(
  SOURCES.sebastian_raschka,
  "ai",
  "Sebastian Raschka",
  "research",
);
const chipHuyenConnector = new GenericAiRssConnector(
  SOURCES.chip_huyen,
  "ai",
  "Chip Huyen",
  "research",
);
const pytorchBlogConnector = new GenericAiRssConnector(
  SOURCES.pytorch_blog,
  "developer-tools",
  "PyTorch Foundation",
  "news",
);
const tensorflowBlogConnector = new GenericAiRssConnector(
  SOURCES.tensorflow_blog,
  "developer-tools",
  "Google TensorFlow",
  "news",
);
const huggingFaceBlogConnector = new GenericAiRssConnector(
  SOURCES.huggingface_blog,
  "open-source-ai",
  "Hugging Face",
  "news",
);
const denoBlogConnector = new GenericAiRssConnector(
  SOURCES.deno_blog,
  "developer-tools",
  "Deno Land",
  "news",
);
const duckDbBlogConnector = new GenericAiRssConnector(
  SOURCES.duckdb_blog,
  "developer-tools",
  "DuckDB Labs",
  "news",
);
const prismaBlogConnector = new GenericAiRssConnector(
  SOURCES.prisma_blog,
  "developer-tools",
  "Prisma",
  "news",
);
const stripeEngineeringConnector = new GenericAiRssConnector(
  SOURCES.stripe_engineering,
  "developer-tools",
  "Stripe",
  "news",
);
const githubEngineeringConnector = new GenericAiRssConnector(
  SOURCES.github_engineering,
  "developer-tools",
  "GitHub",
  "news",
);
const dropboxTechConnector = new GenericAiRssConnector(
  SOURCES.dropbox_tech,
  "developer-tools",
  "Dropbox",
  "news",
);
const gitlabBlogConnector = new GenericAiRssConnector(
  SOURCES.gitlab_blog,
  "developer-tools",
  "GitLab",
  "news",
);
const tailscaleBlogConnector = new GenericAiRssConnector(
  SOURCES.tailscale_blog,
  "developer-tools",
  "Tailscale",
  "news",
);
const flyIoBlogConnector = new GenericAiRssConnector(
  SOURCES.fly_io_blog,
  "developer-tools",
  "Fly.io",
  "news",
);
const grafanaBlogConnector = new GenericAiRssConnector(
  SOURCES.grafana_blog,
  "developer-tools",
  "Grafana Labs",
  "news",
);
const honeycombBlogConnector = new GenericAiRssConnector(
  SOURCES.honeycomb_blog,
  "developer-tools",
  "Honeycomb.io",
  "news",
);
const sentryBlogConnector = new GenericAiRssConnector(
  SOURCES.sentry_blog,
  "developer-tools",
  "Sentry",
  "news",
);
const hackadayConnector = new GenericAiRssConnector(
  SOURCES.hackaday,
  "technology",
  "Hackaday",
  "news",
);
const adafruitBlogConnector = new GenericAiRssConnector(
  SOURCES.adafruit_blog,
  "technology",
  "Adafruit",
  "news",
);
const rosDiscourseConnector = new GenericAiRssConnector(
  SOURCES.ros_discourse,
  "research",
  "Open Robotics",
  "news",
);
const bunBlogConnector = new GenericAiRssConnector(
  SOURCES.bun_blog,
  "developer-tools",
  "Bun Team",
  "news",
);
const astralBlogConnector = new GenericAiRssConnector(
  SOURCES.astral_blog,
  "developer-tools",
  "Astral",
  "news",
);
const cernCourierConnector = new GenericAiRssConnector(
  SOURCES.cern_courier,
  "research",
  "CERN",
  "research",
);
const vitalikBlogConnector = new GenericAiRssConnector(
  SOURCES.vitalik_blog,
  "research",
  "Vitalik Buterin",
  "research",
);
const shopifyEngineeringConnector = new GenericAiRssConnector(
  SOURCES.shopify_engineering,
  "developer-tools",
  "Shopify",
  "news",
);
const slackEngineeringConnector = new GenericAiRssConnector(
  SOURCES.slack_engineering,
  "developer-tools",
  "Slack",
  "news",
);
const spotifyEngineeringConnector = new GenericAiRssConnector(
  SOURCES.spotify_engineering,
  "developer-tools",
  "Spotify",
  "news",
);
const airbnbEngineeringConnector = new GenericAiRssConnector(
  SOURCES.airbnb_engineering,
  "developer-tools",
  "Airbnb",
  "news",
);
const datadogEngineeringConnector = new GenericAiRssConnector(
  SOURCES.datadog_engineering,
  "developer-tools",
  "Datadog",
  "news",
);
const palantirBlogConnector = new GenericAiRssConnector(
  SOURCES.palantir_blog,
  "ai",
  "Palantir",
  "research",
);
const canvaEngineeringConnector = new GenericAiRssConnector(
  SOURCES.canva_engineering,
  "developer-tools",
  "Canva",
  "news",
);
const cisaAdvisoriesConnector = new GenericAiRssConnector(
  SOURCES.cisa_advisories,
  "cybersecurity",
  "CISA",
  "news",
);
const effUpdatesConnector = new GenericAiRssConnector(
  SOURCES.eff_updates,
  "cybersecurity",
  "EFF",
  "news",
);
const githubSecurityConnector = new GenericAiRssConnector(
  SOURCES.github_security,
  "cybersecurity",
  "GitHub Security",
  "research",
);
const arstechnicaScienceConnector = new GenericAiRssConnector(
  SOURCES.arstechnica_science,
  "research",
  "Ars Technica Science",
  "news",
);
const thevergeScienceConnector = new GenericAiRssConnector(
  SOURCES.theverge_science,
  "research",
  "The Verge Science",
  "news",
);
const figmaBlogConnector = new GenericAiRssConnector(
  SOURCES.figma_blog,
  "developer-tools",
  "Figma",
  "news",
);
const webkitBlogConnector = new GenericAiRssConnector(
  SOURCES.webkit_blog,
  "developer-tools",
  "WebKit",
  "code",
);
const v8EngineBlogConnector = new GenericAiRssConnector(
  SOURCES.v8_engine_blog,
  "developer-tools",
  "Google V8 Team",
  "code",
);
const apacheNewsConnector = new GenericAiRssConnector(
  SOURCES.apache_news,
  "developer-tools",
  "Apache Software Foundation",
  "community",
);
const physOrgConnector = new GenericAiRssConnector(
  SOURCES.phys_org,
  "research",
  "Phys.org",
  "research",
);
const sciencedailyConnector = new GenericAiRssConnector(
  SOURCES.sciencedaily,
  "research",
  "ScienceDaily",
  "research",
);
const martinFowlerConnector = new GenericAiRssConnector(
  SOURCES.martin_fowler,
  "developer-tools",
  "Martin Fowler",
  "research",
);
const danLuuConnector = new GenericAiRssConnector(
  SOURCES.dan_luu,
  "developer-tools",
  "Dan Luu",
  "research",
);
const juliaEvansConnector = new GenericAiRssConnector(
  SOURCES.julia_evans,
  "developer-tools",
  "Julia Evans",
  "news",
);
const mitchellHashimotoConnector = new GenericAiRssConnector(
  SOURCES.mitchell_hashimoto,
  "developer-tools",
  "Mitchell Hashimoto",
  "code",
);
const antirezBlogConnector = new GenericAiRssConnector(
  SOURCES.antirez_blog,
  "developer-tools",
  "antirez",
  "code",
);
const ycBlogConnector = new GenericAiRssConnector(
  SOURCES.yc_blog,
  "technology",
  "Y Combinator",
  "news",
);
const githubChangelogConnector = new GenericAiRssConnector(
  SOURCES.github_changelog,
  "developer-tools",
  "GitHub",
  "news",
);
const infoqTechConnector = new GenericAiRssConnector(
  SOURCES.infoq_tech,
  "developer-tools",
  "InfoQ",
  "news",
);
const malwarebytesLabsConnector = new GenericAiRssConnector(
  SOURCES.malwarebytes_labs,
  "cybersecurity",
  "Malwarebytes Labs",
  "research",
);
const redmonkAnalystsConnector = new GenericAiRssConnector(
  SOURCES.redmonk_analysts,
  "developer-tools",
  "RedMonk",
  "research",
);
const postgresqlNewsConnector = new GenericAiRssConnector(
  SOURCES.postgresql_news,
  "developer-tools",
  "PostgreSQL Global Development Group",
  "news",
);
const swiftLangBlogConnector = new GenericAiRssConnector(
  SOURCES.swift_lang_blog,
  "developer-tools",
  "Swift.org",
  "news",
);
const kotlinBlogConnector = new GenericAiRssConnector(
  SOURCES.kotlin_blog,
  "developer-tools",
  "JetBrains",
  "news",
);
const pythonInsiderConnector = new GenericAiRssConnector(
  SOURCES.python_insider,
  "developer-tools",
  "Python Software Foundation",
  "news",
);
const elixirLangConnector = new GenericAiRssConnector(
  SOURCES.elixir_lang,
  "developer-tools",
  "Elixir Team",
  "news",
);
const zigLangNewsConnector = new GenericAiRssConnector(
  SOURCES.zig_lang_news,
  "developer-tools",
  "Zig Software Foundation",
  "news",
);
const rubyLangNewsConnector = new GenericAiRssConnector(
  SOURCES.ruby_lang_news,
  "developer-tools",
  "Ruby Core Team",
  "news",
);
const rustInsideBlogConnector = new GenericAiRssConnector(
  SOURCES.rust_inside_blog,
  "developer-tools",
  "Rust Project",
  "news",
);
const lwnNetConnector = new GenericAiRssConnector(
  SOURCES.lwn_net,
  "developer-tools",
  "LWN.net",
  "news",
);
const elasticBlogConnector = new GenericAiRssConnector(
  SOURCES.elastic_blog,
  "developer-tools",
  "Elastic",
  "news",
);
const awsNewsBlogConnector = new GenericAiRssConnector(
  SOURCES.aws_news_blog,
  "developer-tools",
  "AWS",
  "news",
);
const theNewStackConnector = new GenericAiRssConnector(
  SOURCES.the_new_stack,
  "developer-tools",
  "The New Stack",
  "news",
);
const planetPythonConnector = new GenericAiRssConnector(
  SOURCES.planet_python,
  "developer-tools",
  "Planet Python",
  "community",
);
const planetGnomeConnector = new GenericAiRssConnector(
  SOURCES.planet_gnome,
  "developer-tools",
  "Planet GNOME",
  "community",
);
const openbsdJournalConnector = new GenericAiRssConnector(
  SOURCES.openbsd_journal,
  "developer-tools",
  "OpenBSD Community",
  "news",
);
const archLinuxNewsConnector = new GenericAiRssConnector(
  SOURCES.arch_linux_news,
  "developer-tools",
  "Arch Linux",
  "news",
);
const ubuntuBlogConnector = new GenericAiRssConnector(
  SOURCES.ubuntu_blog,
  "developer-tools",
  "Canonical / Ubuntu",
  "news",
);
const pypiUpdatesConnector = new GenericAiRssConnector(
  SOURCES.pypi_updates,
  "developer-tools",
  "PyPI",
  "news",
);
const fourOFourMediaConnector = new GenericAiRssConnector(
  SOURCES.four_o_four_media,
  "technology",
  "404 Media",
  "news",
);
const securityweekConnector = new GenericAiRssConnector(
  SOURCES.securityweek,
  "cybersecurity",
  "SecurityWeek",
  "news",
);
const semiengineeringConnector = new GenericAiRssConnector(
  SOURCES.semiengineering,
  "semiconductors",
  "Semiconductor Engineering",
  "research",
);
const linuxFoundationBlogConnector = new GenericAiRssConnector(
  SOURCES.linux_foundation_blog,
  "developer-tools",
  "The Linux Foundation",
  "news",
);
const reactOfficialBlogConnector = new GenericAiRssConnector(
  SOURCES.react_official_blog,
  "developer-tools",
  "React Core Team",
  "news",
);
const svelteBlogConnector = new GenericAiRssConnector(
  SOURCES.svelte_blog,
  "developer-tools",
  "Svelte Core Team",
  "news",
);
const astroBlogConnector = new GenericAiRssConnector(
  SOURCES.astro_blog,
  "developer-tools",
  "Astro",
  "news",
);
const typescriptBlogConnector = new GenericAiRssConnector(
  SOURCES.typescript_blog,
  "developer-tools",
  "Microsoft TypeScript Team",
  "news",
);
const dotnetBlogConnector = new GenericAiRssConnector(
  SOURCES.dotnet_blog,
  "developer-tools",
  "Microsoft .NET Team",
  "news",
);
const vscodeBlogConnector = new GenericAiRssConnector(
  SOURCES.vscode_blog,
  "developer-tools",
  "Microsoft VS Code Team",
  "news",
);
const vueOfficialBlogConnector = new GenericAiRssConnector(
  SOURCES.vue_official_blog,
  "developer-tools",
  "Vue.js Core Team",
  "news",
);
const fsfNewsConnector = new GenericAiRssConnector(
  SOURCES.fsf_news,
  "developer-tools",
  "Free Software Foundation",
  "news",
);
const smashingMagazineConnector = new GenericAiRssConnector(
  SOURCES.smashing_magazine,
  "developer-tools",
  "Smashing Magazine",
  "news",
);
const cssTricksConnector = new GenericAiRssConnector(
  SOURCES.css_tricks,
  "developer-tools",
  "CSS-Tricks",
  "news",
);
const googleProjectZeroConnector = new GenericAiRssConnector(
  SOURCES.google_project_zero,
  "cybersecurity",
  "Google Project Zero",
  "research",
);
const sansIscConnector = new GenericAiRssConnector(
  SOURCES.sans_isc,
  "cybersecurity",
  "SANS Institute",
  "news",
);
const portswiggerResearchConnector = new GenericAiRssConnector(
  SOURCES.portswigger_research,
  "cybersecurity",
  "PortSwigger Research",
  "research",
);
const troyHuntConnector = new GenericAiRssConnector(
  SOURCES.troy_hunt,
  "cybersecurity",
  "Troy Hunt",
  "news",
);
const deepLearningWeeklyConnector = new GenericAiRssConnector(
  SOURCES.deep_learning_weekly,
  "ai",
  "Deep Learning Weekly",
  "research",
);
const ieeeSpectrumComputingConnector = new GenericAiRssConnector(
  SOURCES.ieee_spectrum_computing,
  "technology",
  "IEEE Spectrum",
  "news",
);
const googleCloudBlogConnector = new GenericAiRssConnector(
  SOURCES.google_cloud_blog,
  "developer-tools",
  "Google Cloud",
  "news",
);
const angularBlogConnector = new GenericAiRssConnector(
  SOURCES.angular_blog,
  "developer-tools",
  "Angular Team",
  "news",
);
const grahamCluleyConnector = new GenericAiRssConnector(
  SOURCES.graham_cluley,
  "cybersecurity",
  "Graham Cluley",
  "news",
);
const awsSecurityBlogConnector = new GenericAiRssConnector(
  SOURCES.aws_security_blog,
  "cybersecurity",
  "AWS Security",
  "news",
);
const googleSecurityBlogConnector = new GenericAiRssConnector(
  SOURCES.google_security_blog,
  "cybersecurity",
  "Google Security",
  "news",
);
const msSecurityBlogConnector = new GenericAiRssConnector(
  SOURCES.ms_security_blog,
  "cybersecurity",
  "Microsoft Security",
  "news",
);
const godotEngineNewsConnector = new GenericAiRssConnector(
  SOURCES.godot_engine_news,
  "developer-tools",
  "Godot Engine Project",
  "news",
);
const blenderCodeBlogConnector = new GenericAiRssConnector(
  SOURCES.blender_code_blog,
  "developer-tools",
  "Blender Foundation",
  "news",
);
const trailOfBitsConnector = new GenericAiRssConnector(
  SOURCES.trail_of_bits,
  "cybersecurity",
  "Trail of Bits",
  "research",
);
const ciscoTalosConnector = new GenericAiRssConnector(
  SOURCES.cisco_talos,
  "cybersecurity",
  "Cisco Talos",
  "news",
);
const unit42PaloaltoConnector = new GenericAiRssConnector(
  SOURCES.unit42_paloalto,
  "cybersecurity",
  "Unit 42",
  "research",
);
const rapid7ResearchConnector = new GenericAiRssConnector(
  SOURCES.rapid7_research,
  "cybersecurity",
  "Rapid7",
  "news",
);
const raspberryPiBlogConnector = new GenericAiRssConnector(
  SOURCES.raspberry_pi_blog,
  "semiconductors",
  "Raspberry Pi Foundation",
  "news",
);
const arduinoBlogConnector = new GenericAiRssConnector(
  SOURCES.arduino_blog,
  "semiconductors",
  "Arduino",
  "news",
);
const scyllaDbBlogConnector = new GenericAiRssConnector(
  SOURCES.scylladb_blog,
  "developer-tools",
  "ScyllaDB",
  "news",
);
const timescaleBlogConnector = new GenericAiRssConnector(
  SOURCES.timescale_blog,
  "developer-tools",
  "Timescale",
  "news",
);
const yugabyteDbBlogConnector = new GenericAiRssConnector(
  SOURCES.yugabytedb_blog,
  "developer-tools",
  "YugabyteDB",
  "news",
);
const pingCapBlogConnector = new GenericAiRssConnector(
  SOURCES.pingcap_blog,
  "developer-tools",
  "PingCAP",
  "news",
);
const qiskitBlogConnector = new GenericAiRssConnector(
  SOURCES.qiskit_blog,
  "research",
  "IBM Quantum / Qiskit Community",
  "research",
);
const quantumDailyConnector = new GenericAiRssConnector(
  SOURCES.quantum_daily,
  "research",
  "The Quantum Insider",
  "news",
);
const ethereumBlogConnector = new GenericAiRssConnector(
  SOURCES.ethereum_blog,
  "technology",
  "Ethereum Foundation",
  "research",
);
const biorxivBioinfoConnector = new GenericAiRssConnector(
  SOURCES.biorxiv_bioinfo,
  "research",
  "Cold Spring Harbor Laboratory",
  "research",
);
const biorxivNeuroConnector = new GenericAiRssConnector(
  SOURCES.biorxiv_neuro,
  "research",
  "Cold Spring Harbor Laboratory",
  "research",
);
const medrxivAiConnector = new GenericAiRssConnector(
  SOURCES.medrxiv_ai,
  "research",
  "Cold Spring Harbor Laboratory",
  "research",
);
const codropsWebConnector = new GenericAiRssConnector(
  SOURCES.codrops_web,
  "developer-tools",
  "Codrops",
  "news",
);
const webDevOfficialConnector = new GenericAiRssConnector(
  SOURCES.web_dev_official,
  "developer-tools",
  "Google Chrome Team",
  "news",
);
const deepmindPodcastConnector = new GenericAiRssConnector(
  SOURCES.deepmind_podcast,
  "ai",
  "Google DeepMind",
  "research",
);
const gradientFlowConnector = new GenericAiRssConnector(
  SOURCES.gradient_flow,
  "ai",
  "Gradient Flow",
  "news",
);
const aiWeirdnessConnector = new GenericAiRssConnector(
  SOURCES.ai_weirdness,
  "ai",
  "Janelle Shane",
  "news",
);
const openaiCommunityConnector = new GenericAiRssConnector(
  SOURCES.openai_community,
  "ai",
  "OpenAI Community",
  "community",
);
const hashicorpBlogConnector = new GenericAiRssConnector(
  SOURCES.hashicorp_blog,
  "developer-tools",
  "HashiCorp / IBM",
  "news",
);
const supabaseBlogConnector = new GenericAiRssConnector(
  SOURCES.supabase_blog,
  "developer-tools",
  "Supabase",
  "news",
);
const kaggleBlogConnector = new GenericAiRssConnector(
  SOURCES.kaggle_blog,
  "ai",
  "Kaggle / Google",
  "research",
);
const bytecodeAllianceConnector = new GenericAiRssConnector(
  SOURCES.bytecode_alliance,
  "developer-tools",
  "Bytecode Alliance",
  "news",
);
const opentelemetryBlogConnector = new GenericAiRssConnector(
  SOURCES.opentelemetry_blog,
  "developer-tools",
  "CNCF OpenTelemetry",
  "news",
);
const nixosNewsConnector = new GenericAiRssConnector(
  SOURCES.nixos_news,
  "developer-tools",
  "NixOS Foundation",
  "news",
);
const tauriBlogConnector = new GenericAiRssConnector(
  SOURCES.tauri_blog,
  "developer-tools",
  "Tauri Programme",
  "news",
);
const zigNewsConnector = new GenericAiRssConnector(
  SOURCES.zig_news,
  "developer-tools",
  "Zig Software Foundation",
  "news",
);
const rustInternalsConnector = new GenericAiRssConnector(
  SOURCES.rust_internals,
  "developer-tools",
  "Rust Project",
  "news",
);
const elixirLangBlogConnector = new GenericAiRssConnector(
  SOURCES.elixir_lang_blog,
  "developer-tools",
  "Elixir Core Team",
  "news",
);
const ocamlDiscussConnector = new GenericAiRssConnector(
  SOURCES.ocaml_discuss,
  "developer-tools",
  "OCaml Community",
  "news",
);
const neonPostgresBlogConnector = new GenericAiRssConnector(
  SOURCES.neon_postgres_blog,
  "developer-tools",
  "Neon Tech",
  "news",
);
const redpandaBlogConnector = new GenericAiRssConnector(
  SOURCES.redpanda_blog,
  "developer-tools",
  "Redpanda Data",
  "news",
);
const elasticEngineeringConnector = new GenericAiRssConnector(
  SOURCES.elastic_engineering,
  "developer-tools",
  "Elastic",
  "news",
);
const rosNewsConnector = new GenericAiRssConnector(
  SOURCES.ros_news,
  "robotics",
  "Open Robotics",
  "news",
);
const hacksterIoConnector = new GenericAiRssConnector(
  SOURCES.hackster_io,
  "hardware",
  "Hackster.io",
  "news",
);
const postmanEngineeringConnector = new GenericAiRssConnector(
  SOURCES.postman_engineering,
  "developer-tools",
  "Postman",
  "news",
);
const pytorchDiscussConnector = new GenericAiRssConnector(
  SOURCES.pytorch_discuss,
  "ai",
  "PyTorch Community",
  "news",
);
const jetbrainsBlogConnector = new GenericAiRssConnector(
  SOURCES.jetbrains_blog,
  "developer-tools",
  "JetBrains",
  "news",
);
const arxivQuantumConnector = new GenericAiRssConnector(
  SOURCES.arxiv_quantum,
  "research",
  "Cornell arXiv",
  "research",
);
const arxivDistributedConnector = new GenericAiRssConnector(
  SOURCES.arxiv_distributed,
  "research",
  "Cornell arXiv",
  "research",
);
const arxivSecurityConnector = new GenericAiRssConnector(
  SOURCES.arxiv_security,
  "research",
  "Cornell arXiv",
  "research",
);
const arxivRoboticsConnector = new GenericAiRssConnector(
  SOURCES.arxiv_robotics,
  "research",
  "Cornell arXiv",
  "research",
);
const lobstersRustConnector = new GenericAiRssConnector(
  SOURCES.lobsters_rust,
  "developer-tools",
  "Lobsters Community",
  "news",
);
const lobstersDatabasesConnector = new GenericAiRssConnector(
  SOURCES.lobsters_databases,
  "developer-tools",
  "Lobsters Community",
  "news",
);
const lobstersHardwareConnector = new GenericAiRssConnector(
  SOURCES.lobsters_hardware,
  "hardware",
  "Lobsters Community",
  "news",
);
const lobstersAiConnector = new GenericAiRssConnector(
  SOURCES.lobsters_ai,
  "ai",
  "Lobsters Community",
  "news",
);
const lobstersSecurityConnector = new GenericAiRssConnector(
  SOURCES.lobsters_security,
  "cybersecurity",
  "Lobsters Community",
  "news",
);
const wasmWeeklyConnector = new GenericAiRssConnector(
  SOURCES.wasm_weekly,
  "developer-tools",
  "Wasm Weekly",
  "news",
);
const denoNewsConnector = new GenericAiRssConnector(
  SOURCES.deno_news,
  "developer-tools",
  "Deno Land",
  "news",
);
const openssfBlogConnector = new GenericAiRssConnector(
  SOURCES.openssf_blog,
  "cybersecurity",
  "Open Source Security Foundation",
  "news",
);
const v8JsBlogConnector = new GenericAiRssConnector(
  SOURCES.v8_js_blog,
  "developer-tools",
  "Google V8 Team",
  "news",
);
export {
  GenericAiRssConnector,
  NatureAiConnector,
  abcAustraliaTechConnector,
  adafruitBlogConnector,
  adexchangerConnector,
  aheadOfAiConnector,
  aiBusinessConnector,
  aiNewsConnector,
  aiSupremacyConnector,
  aiWeirdnessConnector,
  airbnbEngineeringConnector,
  alJazeeraTechConnector,
  algorithmicBridgeConnector,
  alignmentForumConnector,
  allenAiConnector,
  analyticsVidhyaConnector,
  angularBlogConnector,
  anthropicAiConnector,
  antirezBlogConnector,
  apNewsTechConnector,
  apacheNewsConnector,
  appleMlConnector,
  archLinuxNewsConnector,
  arduinoBlogConnector,
  arstechnicaConnector,
  arstechnicaScienceConnector,
  arxivDistributedConnector,
  arxivQuantumConnector,
  arxivRoboticsConnector,
  arxivSecurityConnector,
  astralBlogConnector,
  astroBlogConnector,
  awsAiBlogConnector,
  awsArchitectureConnector,
  awsMlConnector,
  awsNewsBlogConnector,
  awsSecurityBlogConnector,
  bairBlogConnector,
  bbcTechConnector,
  benEvansConnector,
  biorxivBioinfoConnector,
  biorxivNeuroConnector,
  bleepingComputerConnector,
  blenderCodeBlogConnector,
  bloombergTechConnector,
  bostonDynamicsConnector,
  bunBlogConnector,
  bytebytegoConnector,
  bytecodeAllianceConnector,
  canaryMediaConnector,
  canvaEngineeringConnector,
  cbsTechConnector,
  cerebrasBlogConnector,
  cernCourierConnector,
  characterAiConnector,
  chipHuyenConnector,
  cisaAdvisoriesConnector,
  ciscoTalosConnector,
  cloudflareBlogConnector,
  cmuScsNewsConnector,
  cnbcTechConnector,
  cnnTechConnector,
  codropsWebConnector,
  cohereBlogConnector,
  csisStrategicTechConnector,
  cssTricksConnector,
  danLuuConnector,
  darkReadingConnector,
  datadogEngineeringConnector,
  deepLearningWeeklyConnector,
  deeplearningAiBatchConnector,
  deepmindConnector,
  deepmindPodcastConnector,
  deepseekAiConnector,
  denoBlogConnector,
  denoNewsConnector,
  dockerBlogConnector,
  dotnetBlogConnector,
  dropboxTechConnector,
  duckDbBlogConnector,
  dwTechConnector,
  dwarkeshPodcastConnector,
  eeTimesConnector,
  effUpdatesConnector,
  elasticBlogConnector,
  elasticEngineeringConnector,
  electrekCoConnector,
  eleutherAiConnector,
  elixirLangBlogConnector,
  elixirLangConnector,
  engadgetConnector,
  epochAiConnector,
  esaNewsConnector,
  ethereumBlogConnector,
  euronewsNextConnector,
  fastcompanyAiConnector,
  figmaBlogConnector,
  financialTimesConnector,
  flyIoBlogConnector,
  fourOFourMediaConnector,
  france24TechConnector,
  fsfNewsConnector,
  githubAiBlogConnector,
  githubBlogConnector,
  githubChangelogConnector,
  githubEngineeringConnector,
  githubSecurityConnector,
  gitlabBlogConnector,
  godotEngineNewsConnector,
  golangBlogConnector,
  googleCloudBlogConnector,
  googleProjectZeroConnector,
  googleResearchConnector,
  googleSecurityBlogConnector,
  gradientFlowConnector,
  grafanaBlogConnector,
  grahamCluleyConnector,
  groqBlogConnector,
  guardianAiConnector,
  hackadayConnector,
  hackernoonAiConnector,
  hacksterIoConnector,
  hashicorpBlogConnector,
  hfBlogConnector,
  honeycombBlogConnector,
  huggingFaceBlogConnector,
  ibmQuantumBlogConnector,
  ieeeRoboticsConnector,
  ieeeSpectrumComputingConnector,
  ieeeSpectrumConnector,
  importAiConnector,
  inc42Connector,
  infoqTechConnector,
  interconnectsConnector,
  jetbrainsBlogConnector,
  juliaEvansConnector,
  kaggleBlogConnector,
  kdnuggetsConnector,
  koreaHeraldConnector,
  kotlinBlogConnector,
  krebsOnSecurityConnector,
  kubernetesBlogConnector,
  langchainBlogConnector,
  lastWeekInAiConnector,
  latentSpaceConnector,
  lexFridmanConnector,
  lilianWengConnector,
  linuxFoundationBlogConnector,
  llamaindexBlogConnector,
  lobstersAiConnector,
  lobstersDatabasesConnector,
  lobstersHardwareConnector,
  lobstersRustConnector,
  lobstersSecurityConnector,
  lwnNetConnector,
  malwarebytesLabsConnector,
  marcusOnAiConnector,
  marketingAiInstituteConnector,
  marktechpostConnector,
  martinFowlerConnector,
  maxPlanckIsConnector,
  medrxivAiConnector,
  metaAiConnector,
  metaEngineeringConnector,
  mistralAiConnector,
  mitAiNewsConnector,
  mitCsailConnector,
  mitTechReviewConnector,
  mitchellHashimotoConnector,
  mlMasteryConnector,
  mozillaHacksConnector,
  msResearchConnector,
  msSecurityBlogConnector,
  nasaBreakingConnector,
  natureAiConnector,
  natureMachineIntelligenceConnector,
  natureNewsConnector,
  neonPostgresBlogConnector,
  netflixTechblogConnector,
  neuroscienceNewsConnector,
  nextPlatformConnector,
  nikkeiAsiaConnector,
  nixosNewsConnector,
  nvidiaBlogConnector,
  nvidiaDevBlogConnector,
  ocamlDiscussConnector,
  ollamaBlogConnector,
  oneUsefulThingConnector,
  openAiConnector,
  openaiCommunityConnector,
  openaiOfficialConnector,
  openbsdJournalConnector,
  openssfBlogConnector,
  opentelemetryBlogConnector,
  oxfordAiInstituteConnector,
  palantirBlogConnector,
  perplexityAiConnector,
  phoronixLinuxConnector,
  physOrgConnector,
  pineconeBlogConnector,
  pingCapBlogConnector,
  planetGnomeConnector,
  planetPythonConnector,
  portswiggerResearchConnector,
  postgresqlNewsConnector,
  postmanEngineeringConnector,
  practicalAiConnector,
  pragmaticEngineerConnector,
  princetonPliConnector,
  prismaBlogConnector,
  pypiUpdatesConnector,
  pythonInsiderConnector,
  pytorchBlogConnector,
  pytorchDiscussConnector,
  qdrantBlogConnector,
  qiskitBlogConnector,
  quantamagazineAiConnector,
  quantumDailyConnector,
  rapid7ResearchConnector,
  raspberryPiBlogConnector,
  reactOfficialBlogConnector,
  redHatBlogConnector,
  redmonkAnalystsConnector,
  redpandaBlogConnector,
  replicateBlogConnector,
  restOfWorldConnector,
  reutersTechConnector,
  rosDiscourseConnector,
  rosNewsConnector,
  rubyLangNewsConnector,
  rustBlogConnector,
  rustInsideBlogConnector,
  rustInternalsConnector,
  sansIscConnector,
  scaleAiBlogConnector,
  schneierSecurityConnector,
  scienceDailyAiConnector,
  sciencedailyConnector,
  scmpTechConnector,
  scyllaDbBlogConnector,
  searchenginelandAiConnector,
  sebastianRaschkaConnector,
  securityweekConnector,
  semianalysisConnector,
  semiengineeringConnector,
  semiwikiConnector,
  sentryBlogConnector,
  serveTheHomeConnector,
  shopifyEngineeringConnector,
  siftedEuConnector,
  siliconRepublicConnector,
  siliconangleConnector,
  simonWillisonConnector,
  simonwAiConnector,
  slackEngineeringConnector,
  slashdotConnector,
  smashingMagazineConnector,
  socialMediaExaminerConnector,
  spaceNewsConnector,
  spotifyEngineeringConnector,
  stabilityAiConnector,
  stackoverflowBlogConnector,
  stanfordHaiConnector,
  statNewsConnector,
  straitsTimesConnector,
  stratecheryConnector,
  stripeEngineeringConnector,
  supabaseBlogConnector,
  svelteBlogConnector,
  swiftLangBlogConnector,
  tailscaleBlogConnector,
  tauriBlogConnector,
  techInAsiaConnector,
  techcrunchAiConnector,
  techmemeConnector,
  techpointAfricaConnector,
  telegraphTechConnector,
  tensorflowBlogConnector,
  theGradientConnector,
  theHackerNewsConnector,
  theHinduTechConnector,
  theNewStackConnector,
  theRobotReportConnector,
  theregisterConnector,
  thevergeAiConnector,
  thevergeScienceConnector,
  timescaleBlogConnector,
  togetherAiConnector,
  tomsHardwareConnector,
  tomshardwareSiliconConnector,
  towardsAiConnector,
  towardsDataScienceConnector,
  trailOfBitsConnector,
  troyHuntConnector,
  turingInstituteConnector,
  twimlAiConnector,
  typescriptBlogConnector,
  ubuntuBlogConnector,
  understandingAiConnector,
  unit42PaloaltoConnector,
  unslothBlogConnector,
  v8EngineBlogConnector,
  v8JsBlogConnector,
  venturebeatAiConnector,
  vercelBlogConnector,
  vitalikBlogConnector,
  vllmProjectConnector,
  vscodeBlogConnector,
  vueOfficialBlogConnector,
  wandbFcConnector,
  wasmWeeklyConnector,
  weaviateBlogConnector,
  webDevOfficialConnector,
  webkitBlogConnector,
  wiredBusinessConnector,
  wiredConnector,
  wiredSecurityConnector,
  wsjTechConnector,
  ycBlogConnector,
  ytAiExplainedConnector,
  ytDeepmindConnector,
  ytFireshipConnector,
  ytMattWolfeConnector,
  ytTwoMinutePapersConnector,
  ytWesRothConnector,
  ytYannicKilcherConnector,
  yugabyteDbBlogConnector,
  zigLangNewsConnector,
  zigNewsConnector,
};

export const aiPublicationsConnectors: any[] = [
  venturebeatAiConnector,
  anthropicAiConnector,
  mistralAiConnector,
  deepseekAiConnector,
  perplexityAiConnector,
  thevergeAiConnector,
  mitTechReviewConnector,
  arstechnicaConnector,
  hfBlogConnector,
  lastWeekInAiConnector,
  bbcTechConnector,
  wiredConnector,
  engadgetConnector,
  siliconangleConnector,
  ieeeSpectrumConnector,
  techmemeConnector,
  theregisterConnector,
  guardianAiConnector,
  nvidiaBlogConnector,
  awsMlConnector,
  googleResearchConnector,
  simonwAiConnector,
  euronewsNextConnector,
  scmpTechConnector,
  practicalAiConnector,
  twimlAiConnector,
  lexFridmanConnector,
  tomsHardwareConnector,
  theHinduTechConnector,
  siliconRepublicConnector,
  hackernoonAiConnector,
  natureAiConnector,
  msResearchConnector,
  stanfordHaiConnector,
  mitAiNewsConnector,
  theGradientConnector,
  latentSpaceConnector,
  importAiConnector,
  interconnectsConnector,
  semianalysisConnector,
  marktechpostConnector,
  kdnuggetsConnector,
  metaAiConnector,
  appleMlConnector,
  marketingAiInstituteConnector,
  searchenginelandAiConnector,
  adexchangerConnector,
  socialMediaExaminerConnector,
  wandbFcConnector,
  towardsDataScienceConnector,
  aheadOfAiConnector,
  oneUsefulThingConnector,
  aiSupremacyConnector,
  marcusOnAiConnector,
  algorithmicBridgeConnector,
  githubAiBlogConnector,
  nvidiaDevBlogConnector,
  weaviateBlogConnector,
  togetherAiConnector,
  aiBusinessConnector,
  bairBlogConnector,
  aiNewsConnector,
  mlMasteryConnector,
  towardsAiConnector,
  understandingAiConnector,
  analyticsVidhyaConnector,
  turingInstituteConnector,
  fastcompanyAiConnector,
  openaiOfficialConnector,
  cbsTechConnector,
  cnbcTechConnector,
  ytTwoMinutePapersConnector,
  ytAiExplainedConnector,
  ytMattWolfeConnector,
  ytDeepmindConnector,
  ytFireshipConnector
];

