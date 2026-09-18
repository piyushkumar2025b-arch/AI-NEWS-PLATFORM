import React from 'react';
import { CategoryInfo, SourceInfo } from '../types.js';
import { Newspaper, X, Globe } from 'lucide-react';

interface CategoryFilterProps {
  categories: CategoryInfo[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  selectedSourceType: string | null;
  onSelectSourceType: (type: string | null) => void;
  selectedRegion?: string | null;
  onSelectRegion?: (region: string | null) => void;
  sources?: SourceInfo[];
  selectedSourceId?: string | null;
  onSelectSourceId?: (sourceId: string | null) => void;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  selectedSourceType,
  onSelectSourceType,
  selectedRegion,
  onSelectRegion,
  sources = [],
  selectedSourceId,
  onSelectSourceId,
}) => {
  const sourceTypes = [
    { id: null, label: 'All Feeds' },
    { id: 'news', label: 'News Publications' },
    { id: 'video', label: 'Videos & Demos' },
    { id: 'podcast', label: 'Podcasts & Audio' },
    { id: 'research', label: 'AI Labs & Papers' },
    { id: 'code', label: 'Models & Repos' },
    { id: 'community', label: 'Discussions & Forums' },
  ];

  const worldRegions = [
    { id: null, label: 'All Global Desks' },
    { id: 'Global', label: 'Global Wires' },
    { id: 'Europe & UK', label: 'Europe & UK' },
    { id: 'Asia-Pacific', label: 'Asia-Pacific' },
    { id: 'Americas', label: 'Americas' },
    { id: 'Middle East & Africa', label: 'Middle East & Africa' },
    { id: 'Global South & Emerging Markets', label: 'Global South' },
  ];

  // Prominent international and world news publications to highlight
  const featuredPlaces = [
    { id: 'reuters_tech', label: 'Reuters Wire' },
    { id: 'financial_times', label: 'Financial Times' },
    { id: 'ap_news_tech', label: 'Associated Press' },
    { id: 'wsj_tech', label: 'Wall Street Journal' },
    { id: 'nikkei_asia', label: 'Nikkei Asia' },
    { id: 'dw_tech', label: 'Deutsche Welle' },
    { id: 'france24_tech', label: 'France 24' },
    { id: 'straits_times', label: 'Straits Times' },
    { id: 'al_jazeera_tech', label: 'Al Jazeera' },
    { id: 'korea_herald', label: 'Korea Herald' },
    { id: 'rest_of_world', label: 'Rest of World' },
    { id: 'sifted_eu', label: 'Sifted EU' },
    { id: 'abc_australia_tech', label: 'ABC Australia' },
    { id: 'telegraph_tech', label: 'The Telegraph' },
    { id: 'bbc_tech', label: 'BBC Tech' },
    { id: 'scmp_tech', label: 'SCMP Tech' },
    { id: 'the_hindu_tech', label: 'The Hindu Tech' },
    { id: 'euronews_next', label: 'Euronews' },
    { id: 'silicon_republic', label: 'Silicon Republic' },
    { id: 'wired', label: 'Wired' },
    { id: 'theverge_ai', label: 'The Verge' },
    { id: 'techcrunch_ai', label: 'TechCrunch' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'deepmind', label: 'DeepMind' },
    { id: 'youtube_twominutepapers', label: 'Two Minute Papers' },
    { id: 'youtube_aiexplained', label: 'AI Explained' },
    { id: 'youtube_fireship', label: 'Fireship' },
    { id: 'toms_hardware', label: "Tom's Hardware" },
    { id: 'nature_ai', label: 'Nature' },
    { id: 'mit_tech_review', label: 'MIT Tech Review' },
    { id: 'engadget', label: 'Engadget' },
    { id: 'arstechnica', label: 'Ars Technica' },
    { id: 'semianalysis', label: 'SemiAnalysis' },
    { id: 'latent_space', label: 'Latent Space' },
    { id: 'meta_ai', label: 'Meta AI' },
    { id: 'apple_ml', label: 'Apple ML Research' },
    { id: 'github_ai_blog', label: 'GitHub AI' },
    { id: 'nvidia_dev_blog', label: 'NVIDIA Dev' },
    { id: 'huggingface', label: 'Hugging Face' },
  ];

  return (
    <div className="space-y-2.5">
      {/* Active Source Filter Banner if selected */}
      {selectedSourceId && onSelectSourceId && (
        <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-1.5 border border-amber-200 text-xs text-amber-900">
          <div className="flex items-center gap-1.5 font-medium">
            <Newspaper className="h-3.5 w-3.5 text-amber-700" />
            <span>Filtering news from: <strong>{sources.find(s => s.id === selectedSourceId)?.name || selectedSourceId}</strong></span>
          </div>
          <button
            onClick={() => onSelectSourceId(null)}
            className="flex items-center gap-1 text-amber-800 hover:text-amber-950 font-semibold px-2 py-0.5 rounded bg-amber-100/70 hover:bg-amber-200/80 transition-colors"
          >
            <X className="h-3 w-3" /> Clear Source Filter
          </button>
        </div>
      )}

      {/* Row 1: Source Types (News Publications, AI Labs, Models, etc.) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {sourceTypes.map((t) => (
          <button
            key={String(t.id)}
            onClick={() => onSelectSourceType(t.id)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              selectedSourceType === t.id
                ? 'bg-stone-900 text-white shadow-xs'
                : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Row 2: World News Desks & Regions */}
      {onSelectRegion && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 whitespace-nowrap mr-1 flex items-center gap-1">
            <Globe className="h-3 w-3 text-blue-600" /> World Desks:
          </span>
          {worldRegions.map((reg) => {
            const isSelected = reg.id === null ? !selectedRegion : selectedRegion === reg.id;
            return (
              <button
                key={String(reg.id)}
                onClick={() => onSelectRegion(reg.id)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                }`}
              >
                {reg.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Row 3: Direct News Places quick filter */}
      {onSelectSourceId && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-600 whitespace-nowrap mr-1 flex items-center gap-1">
            <Newspaper className="h-3 w-3 text-stone-600" /> Places:
          </span>
          <button
            onClick={() => onSelectSourceId(null)}
            className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
              !selectedSourceId
                ? 'bg-stone-800 text-white'
                : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
            }`}
          >
            All News Places
          </button>
          {featuredPlaces.map((fp) => (
            <button
              key={fp.id}
              onClick={() => onSelectSourceId(selectedSourceId === fp.id ? null : fp.id)}
              className={`whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer ${
                selectedSourceId === fp.id
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-900'
              }`}
            >
              {fp.label}
            </button>
          ))}
        </div>
      )}

      {/* Row 3: Categories Taxonomy Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => onSelectCategory(null)}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
            selectedCategory === null
              ? 'bg-stone-700 text-white'
              : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
          }`}
        >
          All Topics
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id === selectedCategory ? null : cat.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-stone-700 text-white'
                : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
            }`}
          >
            <span>{cat.name}</span>
            {cat.count > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  selectedCategory === cat.id ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500'
                }`}
              >
                {cat.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
