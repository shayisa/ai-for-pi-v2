/**
 * TopicsContext - Topic management state
 *
 * Phase 6c: Extracted from App.tsx
 * Phase 6g.0: Extended with audience selection (selectedAudience, audienceOptions, handlers)
 *
 * Handles:
 * - Selected topics for newsletter
 * - Custom topic input
 * - AI-suggested topics
 * - Trending content and sources
 * - Topic generation loading states
 * - Audience selection for newsletter targeting
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { TrendingTopic } from '../types';
import type { TrendingSource } from '../services/trendingDataService';

/**
 * Audience option type (from App.tsx lines 48-52)
 */
export interface AudienceOption {
  label: string;
  description: string;
}

/**
 * Default audience options (from App.tsx lines 48-52)
 * These are the built-in audience categories for newsletter targeting.
 */
export const DEFAULT_AUDIENCE_OPTIONS: Record<string, AudienceOption> = {
  academics: {
    label: 'Academics',
    description: 'Forensic anthropology & computational archeology professors.',
  },
  business: {
    label: 'Business Leaders',
    description: 'Admins & leaders upskilling in AI.',
  },
  analysts: {
    label: 'Data Analysts',
    description: 'Analysts extracting business intelligence.',
  },
};

interface TopicsState {
  // Selected topics for newsletter generation
  selectedTopics: string[];
  customTopic: string;

  // AI-suggested topics
  suggestedTopics: string[];

  // Trending content
  trendingContent: TrendingTopic[] | null;
  compellingContent: any;
  trendingSources: TrendingSource[];

  // Loading states
  isGeneratingTopics: boolean;
  isFetchingTrending: boolean;

  // Audience selection (Phase 6g.0 - from App.tsx lines 144-148)
  selectedAudience: Record<string, boolean>;
  audienceOptions: Record<string, AudienceOption>;
}

interface TopicsActions {
  // Topic management
  setSelectedTopics: (topics: string[]) => void;
  setCustomTopic: (topic: string) => void;
  addTopic: (topic: string) => void;
  removeTopic: (index: number) => void;
  clearTopics: () => void;

  // Suggested topics
  setSuggestedTopics: (topics: string[]) => void;
  selectSuggestedTopic: (topic: string) => void;

  // Trending content
  setTrendingContent: (content: TrendingTopic[] | null) => void;
  setCompellingContent: (content: any) => void;
  setTrendingSources: (sources: TrendingSource[]) => void;
  addTrendingTopic: (topic: string) => void;

  // Loading states
  setIsGeneratingTopics: (loading: boolean) => void;
  setIsFetchingTrending: (loading: boolean) => void;

  // Audience selection actions (Phase 6g.0 - from App.tsx lines 519, 645-647, 1524)
  setSelectedAudience: (audience: Record<string, boolean>) => void;
  handleAudienceChange: (key: string) => void;
  getAudienceKeys: () => string[];
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

  // Suggested topics state (from App.tsx line 137)
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);

  // Trending content state (from App.tsx lines 138-140)
  const [trendingContent, setTrendingContent] = useState<TrendingTopic[] | null>(null);
  const [compellingContent, setCompellingContent] = useState<any>(null);
  const [trendingSources, setTrendingSources] = useState<TrendingSource[]>([]);

  // Loading states (from App.tsx lines 141-142)
  const [isGeneratingTopics, setIsGeneratingTopics] = useState<boolean>(false);
  const [isFetchingTrending, setIsFetchingTrending] = useState<boolean>(false);

  // Audience selection state (Phase 6g.0 - from App.tsx lines 144-148)
  // Default: all audiences selected
  const [selectedAudience, setSelectedAudience] = useState<Record<string, boolean>>({
    academics: true,
    business: true,
    analysts: true,
  });

  // Audience options - static configuration (from App.tsx lines 48-52)
  const audienceOptions = DEFAULT_AUDIENCE_OPTIONS;

  /**
   * Toggle audience selection
   * Preserves exact behavior from App.tsx handleAudienceChange (lines 645-647)
   */
  const handleAudienceChange = useCallback((key: string) => {
    setSelectedAudience((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  /**
   * Get array of selected audience keys
   * Preserves exact behavior from App.tsx getAudienceKeys (line 519)
   */
  const getAudienceKeys = useCallback(
    () => Object.keys(selectedAudience).filter((key) => selectedAudience[key]),
    [selectedAudience]
  );

  /**
   * Add a topic to selected topics
   * Preserves exact behavior from App.tsx handleAddTopic (lines 646-651)
   */
  const addTopic = useCallback((topic: string) => {
    const trimmed = topic.trim();
    if (trimmed && !selectedTopics.includes(trimmed)) {
      setSelectedTopics((prev) => [...prev, trimmed]);
      setCustomTopic('');
    }
  }, [selectedTopics]);

  /**
   * Remove a topic by index
   * Preserves exact behavior from App.tsx handleRemoveTopic (lines 653-655)
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
   * Preserves exact behavior from App.tsx handleSelectSuggestedTopic (lines 657-661)
   */
  const selectSuggestedTopic = useCallback((suggestion: string) => {
    if (!selectedTopics.includes(suggestion)) {
      setSelectedTopics((prev) => [...prev, suggestion]);
    }
  }, [selectedTopics]);

  /**
   * Add a trending topic
   * Preserves exact behavior from App.tsx handleAddTrendingTopic (lines 663-667)
   */
  const addTrendingTopic = useCallback((topic: string) => {
    const trimmed = topic.trim();
    if (trimmed && !selectedTopics.includes(trimmed)) {
      setSelectedTopics((prev) => [...prev, trimmed]);
    }
  }, [selectedTopics]);

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
    // Audience state (Phase 6g.0)
    selectedAudience,
    audienceOptions,
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
    // Audience actions (Phase 6g.0)
    setSelectedAudience,
    handleAudienceChange,
    getAudienceKeys,
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
 * Hook for audience selection (Phase 6g.0)
 * Provides audience selection state and actions for newsletter targeting.
 */
export const useAudienceSelection = () => {
  const {
    selectedAudience,
    audienceOptions,
    setSelectedAudience,
    handleAudienceChange,
    getAudienceKeys,
  } = useTopics();

  return {
    selectedAudience,
    audienceOptions,
    setSelectedAudience,
    handleAudienceChange,
    getAudienceKeys,
    // Derived: whether any audience is selected (from App.tsx line 1524)
    hasSelectedAudience: getAudienceKeys().length > 0,
  };
};

export default TopicsContext;
