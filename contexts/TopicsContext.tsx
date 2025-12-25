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

interface TopicsState {
  // Selected topics for newsletter generation
  selectedTopics: string[];
  customTopic: string;

  // AI-suggested topics (Phase 15.4: with audience association)
  suggestedTopics: SuggestedTopic[];

  // Trending content
  trendingContent: TrendingTopic[] | null;
  compellingContent: any;
  trendingSources: TrendingSource[];

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

  // Suggested topics (Phase 15.4: with audience association)
  setSuggestedTopics: (topics: SuggestedTopic[]) => void;
  selectSuggestedTopic: (topic: string | SuggestedTopic) => void;

  // Trending content
  setTrendingContent: (content: TrendingTopic[] | null) => void;
  setCompellingContent: (content: any) => void;
  setTrendingSources: (sources: TrendingSource[]) => void;
  addTrendingTopic: (topic: string) => void;

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

  // Suggested topics state (Phase 15.4: with audience association)
  const [suggestedTopics, setSuggestedTopics] = useState<SuggestedTopic[]>([]);

  // Trending content state (from App.tsx lines 138-140)
  const [trendingContent, setTrendingContent] = useState<TrendingTopic[] | null>(null);
  const [compellingContent, setCompellingContent] = useState<any>(null);
  const [trendingSources, setTrendingSources] = useState<TrendingSource[]>([]);

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
   */
  const removeTopic = useCallback((indexToRemove: number) => {
    setSelectedTopics((prev) => prev.filter((_, index) => index !== indexToRemove));
  }, []);

  /**
   * Clear all topics
   */
  const clearTopics = useCallback(() => {
    setSelectedTopics([]);
  }, []);

  /**
   * Select a suggested topic (add to selected)
   * Phase 15.4: Accepts both string and SuggestedTopic
   */
  const selectSuggestedTopic = useCallback(
    (suggestion: string | SuggestedTopic) => {
      const title = typeof suggestion === 'string' ? suggestion : suggestion.title;
      if (!selectedTopics.includes(title)) {
        setSelectedTopics((prev) => [...prev, title]);
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

  const value: TopicsContextValue = {
    // State
    selectedTopics,
    customTopic,
    suggestedTopics,
    trendingContent,
    compellingContent,
    trendingSources,
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
    setSuggestedTopics,
    selectSuggestedTopic,
    setTrendingContent,
    setCompellingContent,
    setTrendingSources,
    addTrendingTopic,
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
  };
};

/**
 * Hook for trending content
 */
export const useTrendingContent = () => {
  const {
    trendingContent,
    compellingContent,
    trendingSources,
    isFetchingTrending,
    setTrendingContent,
    setCompellingContent,
    setTrendingSources,
    setIsFetchingTrending,
    addTrendingTopic,
  } = useTopics();

  return {
    trendingContent,
    compellingContent,
    trendingSources,
    isFetchingTrending,
    setTrendingContent,
    setCompellingContent,
    setTrendingSources,
    setIsFetchingTrending,
    addTrendingTopic,
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
