/**
 * TopicsContext - Topic management state
 *
 * Phase 6c: Extracted from App.tsx
 * Phase 6g.0: Extended with audience selection (selectedAudience, audienceOptions, handlers)
 * Phase 15.2: Updated for hierarchical audience structure (parent categories + child specializations)
 *
 * Handles:
 * - Selected topics for newsletter
 * - Custom topic input
 * - AI-suggested topics
 * - Trending content and sources
 * - Topic generation loading states
 * - Hierarchical audience selection for newsletter targeting
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { TrendingTopic, AudienceCategory, SuggestedTopic } from '../types';
import type { TrendingSource } from '../services/trendingDataService';

/**
 * Audience option type (extended for hierarchical structure)
 */
export interface AudienceOption {
  label: string;
  description: string;
  parentId?: 'academic' | 'business'; // For child specializations
  isCategory?: boolean; // For parent categories
  children?: string[]; // For parent categories - child specialization IDs
}

/**
 * Hierarchical audience categories (Phase 15.2)
 */
export const AUDIENCE_CATEGORIES: AudienceCategory[] = [
  {
    id: 'academic',
    name: 'Academic',
    children: ['forensic-anthropology', 'computational-archaeology'],
  },
  {
    id: 'business',
    name: 'Business',
    children: ['business-administration', 'business-intelligence'],
  },
];

/**
 * Default audience options (Phase 15.2 - 4 specializations)
 * These are the built-in audience specializations for newsletter targeting.
 */
export const DEFAULT_AUDIENCE_OPTIONS: Record<string, AudienceOption> = {
  // === ACADEMIC SPECIALIZATIONS ===
  'forensic-anthropology': {
    label: 'Forensic Anthropology',
    description:
      'Forensic anthropology researchers specializing in skeletal analysis, trauma interpretation, and victim identification.',
    parentId: 'academic',
  },
  'computational-archaeology': {
    label: 'Computational Archaeology',
    description:
      'Digital archaeology researchers applying LiDAR, photogrammetry, 3D reconstruction, and geospatial analysis.',
    parentId: 'academic',
  },
  // === BUSINESS SPECIALIZATIONS ===
  'business-administration': {
    label: 'Business Administration',
    description:
      'Business administrators seeking workflow automation, document processing, and productivity tools.',
    parentId: 'business',
  },
  'business-intelligence': {
    label: 'Business Intelligence',
    description:
      'Business analytics professionals using predictive analytics, dashboards, and data-driven insights.',
    parentId: 'business',
  },
};

/**
 * Legacy audience ID mapping for backward compatibility
 */
const LEGACY_AUDIENCE_MAPPING: Record<string, string[]> = {
  academics: ['forensic-anthropology', 'computational-archaeology'],
  business: ['business-administration', 'business-intelligence'],
  analysts: ['business-intelligence'],
};

/**
 * Phase 18: Topic context storage
 * Maps topic title to its full context (audienceId, resource, etc.)
 * This enables preserving audience assignment when topics are selected from archives
 */
export interface TopicContext {
  audienceId?: string;
  resource?: string;
  whatItIs?: string;
  newCapability?: string;
}

/**
 * Phase 17: Cache metadata for Stale-While-Revalidate display
 */
export interface TrendingCacheMetadata {
  cached: boolean;
  isStale: boolean;
  cacheAge?: number; // seconds since cached
  fetchedAt?: number; // timestamp when last fetched
}

interface TopicsState {
  // Selected topics for newsletter generation
  selectedTopics: string[];
  customTopic: string;

  // Phase 18: Topic context map (title -> audienceId, resource, etc.)
  topicContextMap: Record<string, TopicContext>;

  // AI-suggested topics (Phase 15.4: with audience association)
  suggestedTopics: SuggestedTopic[];

  // Trending content
  trendingContent: TrendingTopic[] | null;
  compellingContent: any;
  trendingSources: TrendingSource[];

  // Phase 17: Cache metadata for SWR display
  trendingCacheMetadata: TrendingCacheMetadata | null;

  // Loading states
  isGeneratingTopics: boolean;
  isFetchingTrending: boolean;

  // Audience selection (Phase 15.2 - hierarchical)
  selectedAudience: Record<string, boolean>;
  audienceOptions: Record<string, AudienceOption>;
  audienceCategories: AudienceCategory[];
}

interface TopicsActions {
  // Topic management
  setSelectedTopics: (topics: string[]) => void;
  setCustomTopic: (topic: string) => void;
  addTopic: (topic: string) => void;
  removeTopic: (index: number) => void;
  clearTopics: () => void;

  // Phase 18: Topic context management
  addTopicWithContext: (topic: TrendingTopic | SuggestedTopic) => void;
  getTopicContext: (title: string) => TopicContext | undefined;

  // Suggested topics (Phase 15.4: with audience association)
  setSuggestedTopics: (topics: SuggestedTopic[]) => void;
  selectSuggestedTopic: (topic: string | SuggestedTopic) => void;

  // Trending content
  setTrendingContent: (content: TrendingTopic[] | null) => void;
  setCompellingContent: (content: any) => void;
  setTrendingSources: (sources: TrendingSource[]) => void;
  addTrendingTopic: (topic: string) => void;

  // Phase 17: Cache metadata
  setTrendingCacheMetadata: (metadata: TrendingCacheMetadata | null) => void;

  // Loading states
  setIsGeneratingTopics: (loading: boolean) => void;
  setIsFetchingTrending: (loading: boolean) => void;

  // Audience selection actions (Phase 15.2 - hierarchical)
  setSelectedAudience: (audience: Record<string, boolean>) => void;
  handleAudienceChange: (key: string) => void;
  handleCategoryChange: (categoryId: string) => void;
  getAudienceKeys: () => string[];
  isCategoryFullySelected: (categoryId: string) => boolean;
  isCategoryPartiallySelected: (categoryId: string) => boolean;
}

type TopicsContextValue = TopicsState & TopicsActions;

const TopicsContext = createContext<TopicsContextValue | null>(null);

interface TopicsProviderProps {
  children: ReactNode;
  defaultTopics?: string[];
}

export const TopicsProvider: React.FC<TopicsProviderProps> = ({
  children,
  defaultTopics = ['Latest AI tools for data visualization'],
}) => {
  // Topic selection state (from App.tsx lines 129-130)
  const [selectedTopics, setSelectedTopics] = useState<string[]>(defaultTopics);
  const [customTopic, setCustomTopic] = useState<string>('');

  // Phase 18: Topic context map - preserves audienceId, resource when topics are selected
  const [topicContextMap, setTopicContextMap] = useState<Record<string, TopicContext>>({});

  // Suggested topics state (Phase 15.4: with audience association)
  const [suggestedTopics, setSuggestedTopics] = useState<SuggestedTopic[]>([]);

  // Trending content state (from App.tsx lines 138-140)
  const [trendingContent, setTrendingContent] = useState<TrendingTopic[] | null>(null);
  const [compellingContent, setCompellingContent] = useState<any>(null);
  const [trendingSources, setTrendingSources] = useState<TrendingSource[]>([]);

  // Phase 17: Cache metadata for SWR display
  const [trendingCacheMetadata, setTrendingCacheMetadata] = useState<TrendingCacheMetadata | null>(null);

  // Loading states (from App.tsx lines 141-142)
  const [isGeneratingTopics, setIsGeneratingTopics] = useState<boolean>(false);
  const [isFetchingTrending, setIsFetchingTrending] = useState<boolean>(false);

  // Audience selection state (Phase 15.2 - 4 specializations, all selected by default)
  const [selectedAudience, setSelectedAudience] = useState<Record<string, boolean>>({
    'forensic-anthropology': true,
    'computational-archaeology': true,
    'business-administration': true,
    'business-intelligence': true,
  });

  // Audience options - static configuration
  const audienceOptions = DEFAULT_AUDIENCE_OPTIONS;
  const audienceCategories = AUDIENCE_CATEGORIES;

  /**
   * Toggle individual audience specialization
   */
  const handleAudienceChange = useCallback((key: string) => {
    setSelectedAudience((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  /**
   * Toggle entire category (selects/deselects all children)
   */
  const handleCategoryChange = useCallback((categoryId: string) => {
    const category = AUDIENCE_CATEGORIES.find((c) => c.id === categoryId);
    if (!category) return;

    setSelectedAudience((prev) => {
      // Check if category is currently fully selected
      const allSelected = category.children.every((child) => prev[child]);

      // Toggle all children
      const updates: Record<string, boolean> = {};
      category.children.forEach((child) => {
        updates[child] = !allSelected;
      });

      return { ...prev, ...updates };
    });
  }, []);

  /**
   * Check if all children in a category are selected
   */
  const isCategoryFullySelected = useCallback(
    (categoryId: string) => {
      const category = AUDIENCE_CATEGORIES.find((c) => c.id === categoryId);
      if (!category) return false;
      return category.children.every((child) => selectedAudience[child]);
    },
    [selectedAudience]
  );

  /**
   * Check if some (but not all) children in a category are selected
   */
  const isCategoryPartiallySelected = useCallback(
    (categoryId: string) => {
      const category = AUDIENCE_CATEGORIES.find((c) => c.id === categoryId);
      if (!category) return false;
      const selectedCount = category.children.filter((child) => selectedAudience[child]).length;
      return selectedCount > 0 && selectedCount < category.children.length;
    },
    [selectedAudience]
  );

  /**
   * Get array of selected audience keys (specialization IDs only)
   */
  const getAudienceKeys = useCallback(
    () => Object.keys(selectedAudience).filter((key) => selectedAudience[key]),
    [selectedAudience]
  );

  /**
   * Add a topic to selected topics
   */
  const addTopic = useCallback(
    (topic: string) => {
      const trimmed = topic.trim();
      if (trimmed && !selectedTopics.includes(trimmed)) {
        setSelectedTopics((prev) => [...prev, trimmed]);
        setCustomTopic('');
      }
    },
    [selectedTopics]
  );

  /**
   * Remove a topic by index
   * Phase 18: Also removes from context map
   */
  const removeTopic = useCallback((indexToRemove: number) => {
    setSelectedTopics((prev) => {
      const topicToRemove = prev[indexToRemove];
      // Also remove from context map
      if (topicToRemove) {
        setTopicContextMap((prevMap) => {
          const { [topicToRemove]: _, ...rest } = prevMap;
          return rest;
        });
      }
      return prev.filter((_, index) => index !== indexToRemove);
    });
  }, []);

  /**
   * Clear all topics
   * Phase 18: Also clears context map
   */
  const clearTopics = useCallback(() => {
    setSelectedTopics([]);
    setTopicContextMap({});
  }, []);

  /**
   * Select a suggested topic (add to selected)
   * Phase 15.4: Accepts both string and SuggestedTopic
   * Phase 18: Also saves context when SuggestedTopic object is provided
   */
  const selectSuggestedTopic = useCallback(
    (suggestion: string | SuggestedTopic) => {
      const title = typeof suggestion === 'string' ? suggestion : suggestion.title;
      if (!selectedTopics.includes(title)) {
        setSelectedTopics((prev) => [...prev, title]);
        // Phase 18: Save context if full object provided
        if (typeof suggestion !== 'string') {
          setTopicContextMap((prev) => ({
            ...prev,
            [title]: {
              audienceId: suggestion.audienceId,
              resource: suggestion.resource,
            },
          }));
        }
      }
    },
    [selectedTopics]
  );

  /**
   * Add a trending topic
   */
  const addTrendingTopic = useCallback(
    (topic: string) => {
      const trimmed = topic.trim();
      if (trimmed && !selectedTopics.includes(trimmed)) {
        setSelectedTopics((prev) => [...prev, trimmed]);
      }
    },
    [selectedTopics]
  );

  /**
   * Phase 18: Add a topic WITH its full context (audienceId, resource, etc.)
   * Use this when adding topics from archives or trending content
   */
  const addTopicWithContext = useCallback(
    (topic: TrendingTopic | SuggestedTopic) => {
      const title = topic.title.trim();
      if (title && !selectedTopics.includes(title)) {
        setSelectedTopics((prev) => [...prev, title]);
        // Save the context
        setTopicContextMap((prev) => ({
          ...prev,
          [title]: {
            audienceId: topic.audienceId,
            resource: topic.resource,
            whatItIs: 'whatItIs' in topic ? topic.whatItIs : undefined,
            newCapability: 'newCapability' in topic ? topic.newCapability : undefined,
          },
        }));
        console.log(`[TopicsContext] Added topic with context: "${title}" (audience: ${topic.audienceId || 'none'})`);
      }
    },
    [selectedTopics]
  );

  /**
   * Phase 18: Get the saved context for a topic by title
   * Returns undefined if no context was saved
   */
  const getTopicContext = useCallback(
    (title: string): TopicContext | undefined => {
      return topicContextMap[title];
    },
    [topicContextMap]
  );

  const value: TopicsContextValue = {
    // State
    selectedTopics,
    customTopic,
    topicContextMap,  // Phase 18: topic context memory
    suggestedTopics,
    trendingContent,
    compellingContent,
    trendingSources,
    trendingCacheMetadata, // Phase 17
    isGeneratingTopics,
    isFetchingTrending,
    // Audience state (Phase 15.2 - hierarchical)
    selectedAudience,
    audienceOptions,
    audienceCategories,
    // Actions
    setSelectedTopics,
    setCustomTopic,
    addTopic,
    removeTopic,
    clearTopics,
    addTopicWithContext,  // Phase 18: add topic with context
    getTopicContext,      // Phase 18: get context for topic
    setSuggestedTopics,
    selectSuggestedTopic,
    setTrendingContent,
    setCompellingContent,
    setTrendingSources,
    addTrendingTopic,
    setTrendingCacheMetadata, // Phase 17
    setIsGeneratingTopics,
    setIsFetchingTrending,
    // Audience actions (Phase 15.2 - hierarchical)
    setSelectedAudience,
    handleAudienceChange,
    handleCategoryChange,
    getAudienceKeys,
    isCategoryFullySelected,
    isCategoryPartiallySelected,
  };

  return <TopicsContext.Provider value={value}>{children}</TopicsContext.Provider>;
};

/**
 * Hook to access topics context
 * Throws error if used outside TopicsProvider
 */
export const useTopics = (): TopicsContextValue => {
  const context = useContext(TopicsContext);
  if (!context) {
    throw new Error('useTopics must be used within a TopicsProvider');
  }
  return context;
};

/**
 * Hook for just the selected topics
 * Phase 18: Extended with context management
 */
export const useSelectedTopics = () => {
  const {
    selectedTopics,
    setSelectedTopics,
    customTopic,
    setCustomTopic,
    addTopic,
    removeTopic,
    clearTopics,
    topicContextMap,
    addTopicWithContext,
    getTopicContext,
  } = useTopics();

  return {
    topics: selectedTopics,
    setTopics: setSelectedTopics,
    customTopic,
    setCustomTopic,
    addTopic,
    removeTopic,
    clearTopics,
    hasTopics: selectedTopics.length > 0,
    // Phase 18: Topic context
    topicContextMap,
    addTopicWithContext,
    getTopicContext,
  };
};

/**
 * Hook for trending content
 * Phase 17: Extended with cache metadata for SWR display
 * Phase 18: Extended with addTopicWithContext for preserving topic context
 */
export const useTrendingContent = () => {
  const {
    trendingContent,
    compellingContent,
    trendingSources,
    trendingCacheMetadata,
    isFetchingTrending,
    setTrendingContent,
    setCompellingContent,
    setTrendingSources,
    setTrendingCacheMetadata,
    setIsFetchingTrending,
    addTrendingTopic,
    addTopicWithContext,
  } = useTopics();

  return {
    trendingContent,
    compellingContent,
    trendingSources,
    trendingCacheMetadata, // Phase 17
    isFetchingTrending,
    setTrendingContent,
    setCompellingContent,
    setTrendingSources,
    setTrendingCacheMetadata, // Phase 17
    setIsFetchingTrending,
    addTrendingTopic,
    addTopicWithContext,  // Phase 18: add with full context
  };
};

/**
 * Hook for hierarchical audience selection (Phase 15.2)
 * Provides audience selection state and actions with category support.
 */
export const useAudienceSelection = () => {
  const {
    selectedAudience,
    audienceOptions,
    audienceCategories,
    setSelectedAudience,
    handleAudienceChange,
    handleCategoryChange,
    getAudienceKeys,
    isCategoryFullySelected,
    isCategoryPartiallySelected,
  } = useTopics();

  return {
    selectedAudience,
    audienceOptions,
    audienceCategories,
    setSelectedAudience,
    handleAudienceChange,
    handleCategoryChange,
    getAudienceKeys,
    isCategoryFullySelected,
    isCategoryPartiallySelected,
    // Derived: whether any audience is selected
    hasSelectedAudience: getAudienceKeys().length > 0,
    // Derived: get specializations for a category
    getSpecializationsForCategory: (categoryId: string) => {
      const category = audienceCategories.find((c) => c.id === categoryId);
      return category ? category.children : [];
    },
  };
};

export default TopicsContext;
