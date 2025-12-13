/**
 * useTopicSelection Hook
 *
 * Manages topic selection state including:
 * - Selected topics list
 * - Custom topic input
 * - AI-generated suggestions
 * - Trending content from real sources
 */

import { useState, useCallback } from 'react';
import type { TrendingTopic } from '../types';
import type { TrendingSource } from '../services/trendingDataService';
import { generateTopicSuggestions, generateCompellingTrendingContent } from '../services/claudeService';
import * as trendingDataService from '../services/trendingDataService';
import { extractStrictJson } from '../utils/stringUtils';

// Error state type (matches App.tsx)
interface ErrorState {
  message: string;
  onRetry?: () => void;
  recoverable?: boolean;
}

interface UseTopicSelectionReturn {
  // State
  selectedTopics: string[];
  customTopic: string;
  suggestedTopics: string[];
  trendingContent: TrendingTopic[] | null;
  compellingContent: any;
  trendingSources: TrendingSource[];
  isGeneratingTopics: boolean;
  isFetchingTrending: boolean;
  error: ErrorState | null;

  // Actions
  setCustomTopic: (topic: string) => void;
  addTopic: () => void;
  removeTopic: (index: number) => void;
  selectSuggestedTopic: (topic: string) => void;
  addTrendingTopic: (topic: string) => void;
  setSelectedTopics: React.Dispatch<React.SetStateAction<string[]>>;

  // Async actions
  generateSuggestions: (audience: string[]) => Promise<void>;
  fetchTrendingContent: (audience: string[]) => Promise<void>;

  // Clear
  clearError: () => void;
}

export function useTopicSelection(initialTopics: string[] = ['Latest AI tools for data visualization']): UseTopicSelectionReturn {
  const [selectedTopics, setSelectedTopics] = useState<string[]>(initialTopics);
  const [customTopic, setCustomTopic] = useState<string>('');
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [trendingContent, setTrendingContent] = useState<TrendingTopic[] | null>(null);
  const [compellingContent, setCompellingContent] = useState<any>(null);
  const [trendingSources, setTrendingSources] = useState<TrendingSource[]>([]);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState<boolean>(false);
  const [isFetchingTrending, setIsFetchingTrending] = useState<boolean>(false);
  const [error, setError] = useState<ErrorState | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const addTopic = useCallback(() => {
    if (customTopic.trim() && !selectedTopics.includes(customTopic.trim())) {
      setSelectedTopics(prev => [...prev, customTopic.trim()]);
      setCustomTopic('');
    }
  }, [customTopic, selectedTopics]);

  const removeTopic = useCallback((indexToRemove: number) => {
    setSelectedTopics(prev => prev.filter((_, index) => index !== indexToRemove));
  }, []);

  const selectSuggestedTopic = useCallback((suggestion: string) => {
    if (!selectedTopics.includes(suggestion)) {
      setSelectedTopics(prev => [...prev, suggestion]);
    }
  }, [selectedTopics]);

  const addTrendingTopic = useCallback((topic: string) => {
    if (topic.trim() && !selectedTopics.includes(topic.trim())) {
      setSelectedTopics(prev => [...prev, topic.trim()]);
    }
  }, [selectedTopics]);

  const generateSuggestions = useCallback(async (audience: string[]) => {
    if (audience.length === 0) {
      setError({ message: "Please select a target audience before generating suggestions.", recoverable: false });
      return;
    }

    setIsGeneratingTopics(true);
    setError(null);

    try {
      // Fetch trending sources if not already available
      let sources = trendingSources;
      if (sources.length === 0) {
        console.log("[TopicSuggestions] Fetching trending sources...");
        try {
          const allSources = await trendingDataService.fetchAllTrendingSources();
          const filteredSources = trendingDataService.filterSourcesByAudience(allSources, audience);
          sources = filteredSources;
          setTrendingSources(filteredSources);
        } catch (err) {
          console.warn("[TopicSuggestions] Could not fetch trending sources:", err);
        }
      }

      // Format sources for the API
      const sourceSummary = sources.length > 0
        ? sources.map(s => `- "${s.title}" from ${s.publication} (${s.category}): ${s.url}`).join('\n')
        : undefined;

      console.log("[TopicSuggestions] Generating suggestions...");
      const result = await generateTopicSuggestions(audience, sourceSummary);
      const rawJsonString = result.text;
      const cleanedJsonString = extractStrictJson(rawJsonString);
      const topics = JSON.parse(cleanedJsonString);

      setSuggestedTopics(prev => [...new Set([...prev, ...topics])]);
    } catch (e) {
      console.error("[TopicSuggestions] Error:", e);
      const errorMessage = e instanceof SyntaxError
        ? "Failed to parse topic suggestions. The AI returned an invalid format."
        : "Failed to generate topic suggestions due to a network error.";
      setError({
        message: errorMessage,
        onRetry: () => generateSuggestions(audience),
        recoverable: true,
      });
    } finally {
      setIsGeneratingTopics(false);
    }
  }, [trendingSources]);

  const fetchTrendingContent = useCallback(async (audience: string[]) => {
    setIsFetchingTrending(true);
    setTrendingContent(null);
    setCompellingContent(null);
    setTrendingSources([]);
    setError(null);

    if (audience.length === 0) {
      setError({ message: "Please select an audience to see trending topics.", recoverable: false });
      setIsFetchingTrending(false);
      return;
    }

    try {
      console.log("[TrendingContent] Generating compelling content...");
      const result = await generateCompellingTrendingContent(audience);
      const rawJsonString = result.text;
      const cleanedJsonString = extractStrictJson(rawJsonString);
      const compellingData = JSON.parse(cleanedJsonString);

      setCompellingContent(compellingData);

      // Extract titles from actionable capabilities
      if (compellingData.actionableCapabilities && Array.isArray(compellingData.actionableCapabilities)) {
        const titles = compellingData.actionableCapabilities.map((item: any) => item.title);
        setTrendingContent(titles.map((title: string) => ({
          title,
          summary: "Actionable AI capability from trending insights"
        })));
      }
    } catch (e) {
      console.error("[TrendingContent] Error:", e);
      const errorMessage = e instanceof SyntaxError
        ? "Could not parse trending insights. The model returned an unexpected format."
        : "Could not load trending insights due to a network error.";
      setError({
        message: errorMessage,
        onRetry: () => fetchTrendingContent(audience),
        recoverable: true,
      });
    } finally {
      setIsFetchingTrending(false);
    }
  }, []);

  return {
    // State
    selectedTopics,
    customTopic,
    suggestedTopics,
    trendingContent,
    compellingContent,
    trendingSources,
    isGeneratingTopics,
    isFetchingTrending,
    error,

    // Actions
    setCustomTopic,
    addTopic,
    removeTopic,
    selectSuggestedTopic,
    addTrendingTopic,
    setSelectedTopics,

    // Async actions
    generateSuggestions,
    fetchTrendingContent,

    // Clear
    clearError,
  };
}
