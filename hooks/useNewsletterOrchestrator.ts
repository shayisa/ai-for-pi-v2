/**
 * useNewsletterOrchestrator Hook
 *
 * Phase 6g.8: Consolidates multi-state handlers that span multiple contexts.
 *
 * These handlers need to atomically update state across:
 * - NewsletterContext (newsletter, enhancedNewsletter, useEnhancedFormat, promptOfTheDay)
 * - TopicsContext (selectedTopics, selectedAudience, trendingContent, compellingContent, trendingSources)
 * - UIContext (activePage)
 * - NewsletterSettings (selectedTone, selectedFlavors, selectedImageStyle)
 *
 * Handlers:
 * - loadPreset: Load a saved preset, updating audience, tone, flavors, imageStyle, topics
 * - loadFromHistory: Load a newsletter from history with v1/v2 format detection
 * - loadFromDrive: Load a newsletter imported from Google Drive
 * - loadSavedPrompt: Load a saved prompt into the Prompt of the Day editor
 * - loadFromArchive: Load trending content from a saved archive
 */

import { useCallback } from 'react';
import type { Preset, Newsletter, EnhancedNewsletter, PromptOfTheDay, EnhancedHistoryItem } from '../types';
import type { SavedPrompt } from '../services/promptClientService';
import type { ArchiveContent } from '../services/archiveClientService';
import type { TrendingSource } from '../services/trendingDataService';
import { useNewsletter, useNewsletterSettings } from '../contexts';
import { useTopics, useTrendingContent, useAudienceSelection } from '../contexts';
import { useNavigation } from '../contexts';
import { isEnhancedNewsletter } from '../utils/newsletterFormatUtils';

interface UseNewsletterOrchestratorReturn {
  // Preset management
  loadPreset: (preset: Preset) => void;

  // History/Drive loading with format detection
  loadFromHistory: (item: EnhancedHistoryItem) => void;
  loadFromDrive: (
    newsletter: Newsletter | EnhancedNewsletter,
    topics: string[],
    formatVersion?: 'v1' | 'v2'
  ) => void;

  // Prompt library
  loadSavedPrompt: (savedPrompt: SavedPrompt) => void;

  // Archive loading (skips API calls)
  loadFromArchive: (content: ArchiveContent, audience: string[]) => void;
}

export function useNewsletterOrchestrator(): UseNewsletterOrchestratorReturn {
  // Newsletter state
  const {
    setNewsletter,
    setEnhancedNewsletter,
    setUseEnhancedFormat,
    setPromptOfTheDay,
  } = useNewsletter();

  // Newsletter settings
  const {
    setSelectedTone,
    setSelectedFlavors,
    setSelectedImageStyle,
  } = useNewsletterSettings();

  // Topics state
  const { setSelectedTopics } = useTopics();
  const { setSelectedAudience } = useAudienceSelection();
  const {
    setTrendingContent,
    setCompellingContent,
    setTrendingSources,
  } = useTrendingContent();

  // Navigation
  const { setActivePage } = useNavigation();

  /**
   * Load a preset - updates 6 states atomically
   * Preserves exact behavior from App.tsx handleLoadPreset (lines 258-265)
   */
  const loadPreset = useCallback((preset: Preset) => {
    setSelectedAudience(preset.settings.selectedAudience);
    setSelectedTone(preset.settings.selectedTone);
    setSelectedFlavors(preset.settings.selectedFlavors);
    setSelectedImageStyle(preset.settings.selectedImageStyle);
    setSelectedTopics(preset.settings.selectedTopics || []);
    setActivePage('generateNewsletter');
  }, [
    setSelectedAudience,
    setSelectedTone,
    setSelectedFlavors,
    setSelectedImageStyle,
    setSelectedTopics,
    setActivePage,
  ]);

  /**
   * Load newsletter from history with format detection (v1/v2)
   * Preserves exact behavior from App.tsx handleLoadFromHistory (lines 411-432)
   */
  const loadFromHistory = useCallback((item: EnhancedHistoryItem) => {
    if (item.formatVersion === 'v2' && isEnhancedNewsletter(item.newsletter)) {
      // Load as enhanced (v2) newsletter
      setUseEnhancedFormat(true);
      setEnhancedNewsletter(item.newsletter as EnhancedNewsletter);
      setNewsletter(null);
      setPromptOfTheDay(item.newsletter.promptOfTheDay || null);
    } else {
      // Load as legacy (v1) newsletter
      setUseEnhancedFormat(false);
      setEnhancedNewsletter(null);
      setNewsletter(item.newsletter as Newsletter);
      setPromptOfTheDay((item.newsletter as Newsletter).promptOfTheDay || null);
    }
    setSelectedTopics(item.topics);
    setActivePage('generateNewsletter');

    // Scroll to the preview
    const previewElement = document.getElementById('newsletter-preview');
    if (previewElement) {
      previewElement.scrollIntoView({ behavior: 'smooth' });
    }
  }, [
    setUseEnhancedFormat,
    setEnhancedNewsletter,
    setNewsletter,
    setPromptOfTheDay,
    setSelectedTopics,
    setActivePage,
  ]);

  /**
   * Load newsletter from Drive with format detection (v1/v2)
   * Preserves exact behavior from App.tsx handleLoadFromDrive (lines 462-488)
   */
  const loadFromDrive = useCallback((
    loadedNewsletter: Newsletter | EnhancedNewsletter,
    topics: string[],
    formatVersion: 'v1' | 'v2' = 'v1'
  ) => {
    if (formatVersion === 'v2' && isEnhancedNewsletter(loadedNewsletter)) {
      // Load as enhanced (v2) newsletter
      setUseEnhancedFormat(true);
      setEnhancedNewsletter(loadedNewsletter as EnhancedNewsletter);
      setNewsletter(null);
      setPromptOfTheDay(loadedNewsletter.promptOfTheDay || null);
    } else {
      // Load as legacy (v1) newsletter
      setUseEnhancedFormat(false);
      setEnhancedNewsletter(null);
      setNewsletter(loadedNewsletter as Newsletter);
      setPromptOfTheDay((loadedNewsletter as Newsletter).promptOfTheDay || null);
    }
    setSelectedTopics(topics);
    setActivePage('generateNewsletter');

    // Scroll to the preview with slight delay for render
    setTimeout(() => {
      const previewElement = document.getElementById('newsletter-preview');
      if (previewElement) {
        previewElement.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }, [
    setUseEnhancedFormat,
    setEnhancedNewsletter,
    setNewsletter,
    setPromptOfTheDay,
    setSelectedTopics,
    setActivePage,
  ]);

  /**
   * Load a saved prompt from the library into the Prompt of the Day editor
   * Preserves exact behavior from App.tsx handleLoadSavedPrompt (lines 498-507)
   */
  const loadSavedPrompt = useCallback((savedPrompt: SavedPrompt) => {
    setPromptOfTheDay({
      title: savedPrompt.title,
      summary: savedPrompt.summary,
      examplePrompts: savedPrompt.examplePrompts,
      promptCode: savedPrompt.promptCode,
    });
    // Navigate to generate page where the prompt editor is
    setActivePage('generateNewsletter');
  }, [setPromptOfTheDay, setActivePage]);

  /**
   * Load content from an archive (skips API calls, saves tokens)
   * Preserves exact behavior from App.tsx handleLoadFromArchive (lines 609-639)
   */
  const loadFromArchive = useCallback((content: ArchiveContent, audience: string[]) => {
    console.log('[Orchestrator] Loading from archive...');

    // Set trending sources
    if (content.trendingSources) {
      setTrendingSources(content.trendingSources as TrendingSource[]);
    }

    // Set compelling content
    if (content.compellingContent) {
      setCompellingContent(content.compellingContent);
    }

    // Extract titles for trending topics
    if (content.trendingTopics && content.trendingTopics.length > 0) {
      setTrendingContent(content.trendingTopics);
    }

    // Update selected audience to match the archive's target audience
    if (audience && audience.length > 0) {
      const audienceRecord: Record<string, boolean> = {};
      audience.forEach((key) => {
        audienceRecord[key] = true;
      });
      setSelectedAudience(audienceRecord);
    }

    console.log('[Orchestrator] Archive loaded successfully');
  }, [
    setTrendingSources,
    setCompellingContent,
    setTrendingContent,
    setSelectedAudience,
  ]);

  return {
    loadPreset,
    loadFromHistory,
    loadFromDrive,
    loadSavedPrompt,
    loadFromArchive,
  };
}

export default useNewsletterOrchestrator;
