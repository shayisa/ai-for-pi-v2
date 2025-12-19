/**
 * NewsletterContext - Newsletter generation and draft management
 *
 * Phase 6e: Extracted from App.tsx
 * Phase 6g.0: Extended with tone/flavor/imageStyle settings
 *
 * CRITICAL FEATURES (MUST PRESERVE):
 * - 2-second debounced draft auto-save (DO NOT MODIFY TIMING)
 * - Format version detection (v1 legacy vs v2 enhanced)
 * - Workflow actions tracking (Drive save, Gmail send)
 *
 * Handles:
 * - Newsletter content (v1 and v2 formats)
 * - Enhanced newsletter format toggle
 * - Prompt of the Day
 * - Draft auto-save to SQLite
 * - Generation loading/progress state
 * - Workflow status (saved to Drive, sent via email)
 * - Custom audience configurations
 * - Tone, flavor, and image style selection
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Newsletter, EnhancedNewsletter, PromptOfTheDay, AudienceConfig } from '../types';
import * as draftApi from '../services/draftClientService';
import * as enhancedNewsletterService from '../services/enhancedNewsletterService';
import * as audienceApi from '../services/audienceClientService';
import { useAuth } from './AuthContext';

/**
 * Tone execution rules - research-backed guidance for AI generation
 * Based on analysis of 77+ award-winning newsletters
 */
export interface ToneExecutionRules {
  sentenceConstruction: string[];  // How to build sentences
  wordsToUse: string[];           // Preferred language patterns
  wordsToAvoid: string[];         // Language to avoid
  punctuationStyle: string;       // Punctuation guidance
}

/**
 * Tone option type - enhanced with execution rules
 * Phase 13.1: Research-backed tone system
 */
export interface ToneOption {
  label: string;
  description: string;
  sampleOutput: string;
  executionRules: ToneExecutionRules;
}

/**
 * Flavor option type (from App.tsx lines 62-68)
 */
export interface FlavorOption {
  label: string;
  description: string;
}

/**
 * Image style option type (from App.tsx lines 71-108)
 */
export interface ImageStyleOption {
  label: string;
  description: string;
}

/**
 * Default tone options - Phase 13.1: Research-backed 8-tone system
 * Based on analysis of 77+ award-winning newsletters including Morning Brew,
 * Wait But Why, Lenny's Newsletter, Blackbird Spyplane, and more.
 */
export const DEFAULT_TONE_OPTIONS: Record<string, ToneOption> = {
  warm: {
    label: 'Warm',
    description: 'Friendly, accepting, and celebratory. Perfect for community and support content.',
    sampleOutput: "Welcome! We're so glad you're here. Here's what helped me, and I think it'll help you too.",
    executionRules: {
      sentenceConstruction: [
        'Use positive framing: "Here\'s what helped" not "Don\'t do this"',
        'Include gratitude: "Thanks for being here"',
        'Celebrate wins and progress',
      ],
      wordsToUse: ['welcome', 'glad', 'excited', 'appreciate', 'together'],
      wordsToAvoid: ['unfortunately', 'problem', 'issue', 'failed'],
      punctuationStyle: 'Occasional exclamation points (use carefully), warm ellipses',
    },
  },
  confident: {
    label: 'Confident',
    description: 'Sure, direct, and authoritative. No hedging. Perfect for business and leadership.',
    sampleOutput: "This works. We've proven it with 50+ companies. Here's exactly what you need to do.",
    executionRules: {
      sentenceConstruction: [
        'Short, declarative sentences',
        'Active voice only',
        'Imperative mood: "Do this" not "You might consider"',
      ],
      wordsToUse: ['proven', 'works', 'results', 'exactly', "here's how"],
      wordsToAvoid: ['seems', 'might', 'perhaps', 'appears', 'arguably', 'I think'],
      punctuationStyle: 'Periods. Short sentences. Direct.',
    },
  },
  witty: {
    label: 'Witty',
    description: 'Clever, humorous, and engaging. Insider jokes that reward knowledge.',
    sampleOutput: 'This tool is impossibly good. The algorithm finally learned to be useful (only took 10 years).',
    executionRules: {
      sentenceConstruction: [
        'Unexpected word choices and wordplay',
        'Timing through sentence length variation',
        'Deadpan delivery followed by punchline',
      ],
      wordsToUse: ['impossibly', 'finally', 'actually', 'somehow'],
      wordsToAvoid: ['LOL', 'hilarious', 'funny thing is', 'haha'],
      punctuationStyle: 'Parentheticals for asides, em dashes for timing',
    },
  },
  empathetic: {
    label: 'Empathetic',
    description: 'Understanding, validating, and supportive. Perfect for wellness and difficult topics.',
    sampleOutput: "I know this is hard. You're not alone in this—most people struggle with exactly what you're facing.",
    executionRules: {
      sentenceConstruction: [
        'Acknowledge feelings first, then information',
        'Use second person: "You" and "your"',
        'Validate before advising',
      ],
      wordsToUse: ['understand', 'feel', 'struggle', 'not alone', 'valid'],
      wordsToAvoid: ['just', 'simply', 'obviously', 'easy', 'should have'],
      punctuationStyle: 'Gentle pauses with em dashes, ellipses for reflection',
    },
  },
  analytical: {
    label: 'Analytical',
    description: 'Thoughtful, intellectual, and nuanced. Multiple perspectives examined.',
    sampleOutput:
      'On the surface, this seems like a simple efficiency gain. But actually, the second-order effects reveal something unexpected...',
    executionRules: {
      sentenceConstruction: [
        'Complex sentence structures with clear logic',
        'Transitional language: "However," "Conversely," "Moreover"',
        '"On the surface... but actually..." pattern',
      ],
      wordsToUse: ['however', 'conversely', 'notably', 'interestingly', 'reveals'],
      wordsToAvoid: ['obviously', 'clearly', 'everyone knows'],
      punctuationStyle: 'Colons for explanations, semicolons for related ideas',
    },
  },
  urgent: {
    label: 'Urgent',
    description: 'Fast-paced, action-focused, FOMO-inducing. For breaking news and launches.',
    sampleOutput: "This changes everything. You need to know this now. Here's what's happening—and why it matters.",
    executionRules: {
      sentenceConstruction: [
        'Short sentences. Very short.',
        'Time-specific framing',
        'Direct calls to action',
      ],
      wordsToUse: ['now', 'immediately', 'breaking', 'just announced', 'this changes'],
      wordsToAvoid: ['eventually', 'sometime', 'might want to consider'],
      punctuationStyle: 'Periods for punch. Em dashes for speed. Exclamation points (sparingly).',
    },
  },
  introspective: {
    label: 'Introspective',
    description: 'Reflective, questioning, and contemplative. For essays and personal development.',
    sampleOutput:
      "I've been thinking about this all week. Why do we believe this? What if we're asking the wrong question entirely?",
    executionRules: {
      sentenceConstruction: [
        'Questions without immediate answers',
        'First person reflection: "I\'ve been thinking..."',
        'Exploration over conclusions',
      ],
      wordsToUse: ['wondering', 'perhaps', 'what if', "I've noticed", 'makes me think'],
      wordsToAvoid: ['definitely', 'certainly', 'the answer is', 'everyone should'],
      punctuationStyle: 'Question marks for genuine inquiry, ellipses for trailing thoughts...',
    },
  },
  serious: {
    label: 'Serious',
    description: 'Formal, grave, and respectful. For crisis, investigative, or policy content.',
    sampleOutput:
      'This matter demands your attention. The implications extend beyond the immediate situation, affecting how we understand...',
    executionRules: {
      sentenceConstruction: [
        'Formal without being cold',
        'Acknowledge stakes clearly',
        'Measured, deliberate pacing',
      ],
      wordsToUse: ['significant', 'implications', 'important to understand', 'deserves attention'],
      wordsToAvoid: ['joke', 'fun', 'exciting', 'cool', 'awesome'],
      punctuationStyle: 'Conservative punctuation, no exclamation points, formal structure',
    },
  },
};

/**
 * Default flavor options (from App.tsx lines 62-68)
 */
export const DEFAULT_FLAVOR_OPTIONS: Record<string, FlavorOption> = {
  includeHumor: { label: 'Include light humor', description: 'Sprinkle in a few witty remarks or jokes.' },
  useSlang: { label: 'Use conversational slang', description: 'Makes the tone more relaxed and authentic.' },
  useJargon: { label: 'Incorporate technical jargon', description: 'For expert audiences who know the lingo.' },
  useAnalogies: {
    label: 'Use relatable analogies',
    description: 'Simplify complex topics for a broader audience.',
  },
  citeData: { label: 'Cite data and statistics', description: 'Add authority with facts and figures.' },
};

/**
 * Default image style options (from App.tsx lines 71-108)
 */
export const DEFAULT_IMAGE_STYLE_OPTIONS: Record<string, ImageStyleOption> = {
  photorealistic: {
    label: 'Photorealistic',
    description: 'Life-like, detailed images.',
  },
  vector: {
    label: 'Vector Illustration',
    description: 'Clean, flat, scalable graphics.',
  },
  watercolor: {
    label: 'Watercolor',
    description: 'Soft, blended, artistic style.',
  },
  pixel: {
    label: 'Pixel Art',
    description: 'Retro, blocky, 8-bit aesthetic.',
  },
  minimalist: {
    label: 'Minimalist Line Art',
    description: 'Simple, elegant, black & white.',
  },
  cyberpunk: {
    label: 'Cyberpunk',
    description: 'Futuristic, neon-lit, often dystopian.',
  },
  abstract: {
    label: 'Abstract',
    description: 'Non-representational, focusing on forms, colors, and textures.',
  },
  oilPainting: {
    label: 'Oil Painting',
    description: 'Classic, textured, rich brushstrokes.',
  },
  isometric: {
    label: 'Isometric',
    description: 'A 3D perspective, often used for game art or infographics.',
  },
};

// Workflow status for Drive/Gmail operations
interface WorkflowStatus {
  message: string;
  type: 'success' | 'error';
}

// Workflow actions tracking
interface WorkflowActions {
  savedToDrive: boolean;
  sentEmail: boolean;
}

interface NewsletterState {
  // Newsletter content (v1 legacy format)
  newsletter: Newsletter | null;

  // Enhanced newsletter content (v2 format)
  enhancedNewsletter: EnhancedNewsletter | null;

  // Format toggle
  useEnhancedFormat: boolean;

  // Prompt of the Day (included in newsletter)
  promptOfTheDay: PromptOfTheDay | null;

  // Generation status
  loading: string | null;
  progress: number;

  // Workflow tracking
  workflowStatus: WorkflowStatus | null;
  workflowActions: WorkflowActions;

  // Custom audience configs for v2 format
  customAudiences: AudienceConfig[];
  defaultAudiences: AudienceConfig[];

  // Draft tracking
  isDraftLoading: boolean;
  lastDraftSaveTime: Date | null;

  // Tone, flavor, and image style settings (Phase 6g.0 - from App.tsx lines 150-152)
  selectedTone: string;
  selectedFlavors: Record<string, boolean>;
  selectedImageStyle: string;
  toneOptions: Record<string, ToneOption>;
  flavorOptions: Record<string, FlavorOption>;
  imageStyleOptions: Record<string, ImageStyleOption>;
}

interface NewsletterActions {
  // Newsletter setters - use React.SetStateAction to support functional updates
  setNewsletter: React.Dispatch<React.SetStateAction<Newsletter | null>>;
  setEnhancedNewsletter: React.Dispatch<React.SetStateAction<EnhancedNewsletter | null>>;

  // Format toggle
  setUseEnhancedFormat: React.Dispatch<React.SetStateAction<boolean>>;

  // Prompt of the Day
  setPromptOfTheDay: React.Dispatch<React.SetStateAction<PromptOfTheDay | null>>;

  // Generation status
  setLoading: React.Dispatch<React.SetStateAction<string | null>>;
  setProgress: React.Dispatch<React.SetStateAction<number>>;

  // Workflow tracking
  setWorkflowStatus: React.Dispatch<React.SetStateAction<WorkflowStatus | null>>;
  setWorkflowActions: React.Dispatch<React.SetStateAction<WorkflowActions>>;
  resetWorkflowActions: () => void;

  // Custom audiences
  setCustomAudiences: React.Dispatch<React.SetStateAction<AudienceConfig[]>>;
  addCustomAudience: (audience: AudienceConfig) => void;
  removeCustomAudience: (audienceId: string) => void;

  // Clear newsletter content
  clearNewsletter: () => void;

  // Get current newsletter (either v1 or v2 based on format)
  getCurrentNewsletter: () => Newsletter | EnhancedNewsletter | null;

  // Tone, flavor, and image style actions (Phase 6g.0 - from App.tsx lines 150-152, 649-651, 520)
  setSelectedTone: React.Dispatch<React.SetStateAction<string>>;
  setSelectedFlavors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  handleFlavorChange: (key: string) => void;
  setSelectedImageStyle: React.Dispatch<React.SetStateAction<string>>;
  getFlavorKeys: () => string[];
}

type NewsletterContextValue = NewsletterState & NewsletterActions;

const NewsletterContext = createContext<NewsletterContextValue | null>(null);

interface NewsletterProviderProps {
  children: ReactNode;
}

export const NewsletterProvider: React.FC<NewsletterProviderProps> = ({ children }) => {
  const { authData } = useAuth();

  // Newsletter content state (from App.tsx lines 131, 229)
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [enhancedNewsletter, setEnhancedNewsletter] = useState<EnhancedNewsletter | null>(null);

  // Format toggle (from App.tsx line 228)
  const [useEnhancedFormat, setUseEnhancedFormat] = useState<boolean>(true);

  // Prompt of the Day (from App.tsx line 220)
  const [promptOfTheDay, setPromptOfTheDay] = useState<PromptOfTheDay | null>(null);

  // Generation status (from App.tsx lines 132-133)
  const [loading, setLoading] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  // Workflow tracking (from App.tsx lines 156, 158)
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null);
  const [workflowActions, setWorkflowActions] = useState<WorkflowActions>({
    savedToDrive: false,
    sentEmail: false,
  });

  // Custom audiences for v2 format (from App.tsx lines 230-231)
  const [customAudiences, setCustomAudiences] = useState<AudienceConfig[]>([]);
  const [defaultAudiences, setDefaultAudiences] = useState<AudienceConfig[]>([]);

  // Draft tracking
  const [isDraftLoading, setIsDraftLoading] = useState<boolean>(false);
  const [lastDraftSaveTime, setLastDraftSaveTime] = useState<Date | null>(null);

  // Tone, flavor, and image style settings (Phase 6g.0 - from App.tsx lines 150-152)
  // Phase 13.1: Default to 'confident' (research-backed replacement for 'professional')
  const [selectedTone, setSelectedTone] = useState<string>('confident');
  const [selectedFlavors, setSelectedFlavors] = useState<Record<string, boolean>>({});
  const [selectedImageStyle, setSelectedImageStyle] = useState<string>('photorealistic');

  // Options - static configuration (from App.tsx lines 54-108)
  const toneOptions = DEFAULT_TONE_OPTIONS;
  const flavorOptions = DEFAULT_FLAVOR_OPTIONS;
  const imageStyleOptions = DEFAULT_IMAGE_STYLE_OPTIONS;

  /**
   * Reset workflow actions (called when starting new generation)
   */
  const resetWorkflowActions = useCallback(() => {
    setWorkflowActions({ savedToDrive: false, sentEmail: false });
    setWorkflowStatus(null);
  }, []);

  /**
   * Add a custom audience
   * Preserves exact behavior from App.tsx handleAddCustomAudience (lines 1073-1078)
   */
  const addCustomAudience = useCallback((audience: AudienceConfig) => {
    setCustomAudiences((prev) => {
      const newAudiences = [...prev, audience];
      localStorage.setItem('customAudiences', JSON.stringify(newAudiences));
      console.log('[NewsletterContext] Added custom audience:', audience.name);
      return newAudiences;
    });
  }, []);

  /**
   * Remove a custom audience
   * Preserves exact behavior from App.tsx handleRemoveCustomAudience (lines 1080-1085)
   */
  const removeCustomAudience = useCallback((audienceId: string) => {
    setCustomAudiences((prev) => {
      const newAudiences = prev.filter((a) => a.id !== audienceId);
      localStorage.setItem('customAudiences', JSON.stringify(newAudiences));
      console.log('[NewsletterContext] Removed custom audience:', audienceId);
      return newAudiences;
    });
  }, []);

  /**
   * Clear all newsletter content
   */
  const clearNewsletter = useCallback(() => {
    setNewsletter(null);
    setEnhancedNewsletter(null);
    setPromptOfTheDay(null);
    resetWorkflowActions();
  }, [resetWorkflowActions]);

  /**
   * Get current newsletter based on format
   */
  const getCurrentNewsletter = useCallback((): Newsletter | EnhancedNewsletter | null => {
    return useEnhancedFormat ? enhancedNewsletter : newsletter;
  }, [useEnhancedFormat, enhancedNewsletter, newsletter]);

  /**
   * Toggle flavor selection
   * Preserves exact behavior from App.tsx handleFlavorChange (lines 649-651)
   */
  const handleFlavorChange = useCallback((key: string) => {
    setSelectedFlavors((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  /**
   * Get array of selected flavor keys
   * Preserves exact behavior from App.tsx getFlavorKeys (line 520)
   */
  const getFlavorKeys = useCallback(
    () => Object.keys(selectedFlavors).filter((key) => selectedFlavors[key]),
    [selectedFlavors]
  );

  /**
   * Load default audiences for enhanced newsletter format
   * Preserves exact behavior from App.tsx useEffect (lines 1338-1359)
   */
  useEffect(() => {
    const loadDefaultAudiences = async () => {
      try {
        const response = await enhancedNewsletterService.getDefaultAudiences();
        setDefaultAudiences(response.audiences);
        console.log('[NewsletterContext] Loaded default audiences:', response.audiences.length);
      } catch (err) {
        console.warn('[NewsletterContext] Could not load default audiences:', err);
      }
    };
    loadDefaultAudiences();

    // Phase 12.0: Load custom audiences from SQLite first, fall back to localStorage
    const loadCustomAudiences = async () => {
      try {
        const response = await audienceApi.getCustomAudiences();
        if (response.audiences.length > 0) {
          // Convert API response to AudienceConfig format
          const audiences: AudienceConfig[] = response.audiences.map(a => ({
            id: a.id,
            name: a.name,
            description: a.description,
            generated: a.generated ? {
              persona: a.generated.persona,
              relevance_keywords: a.generated.relevance_keywords,
              subreddits: a.generated.subreddits || [],
              arxiv_categories: a.generated.arxiv_categories || [],
              search_templates: a.generated.search_templates || [],
            } : undefined,
            isCustom: true,
          }));
          setCustomAudiences(audiences);
          // Update localStorage cache
          localStorage.setItem('customAudiences', JSON.stringify(audiences));
          console.log('[NewsletterContext] Loaded custom audiences from SQLite:', audiences.length);
          return;
        }
      } catch (err) {
        console.warn('[NewsletterContext] Could not load from SQLite, falling back to localStorage:', err);
      }

      // Fall back to localStorage
      const storedCustomAudiences = localStorage.getItem('customAudiences');
      if (storedCustomAudiences) {
        try {
          setCustomAudiences(JSON.parse(storedCustomAudiences));
          console.log('[NewsletterContext] Loaded custom audiences from localStorage');
        } catch (err) {
          console.warn('[NewsletterContext] Could not parse stored custom audiences');
        }
      }
    };
    loadCustomAudiences();
  }, []);

  /**
   * CRITICAL: Draft auto-save effect
   * Preserves EXACT behavior from App.tsx (lines 1386-1438)
   *
   * DO NOT MODIFY:
   * - 2-second debounce timing
   * - Conditions for skipping save
   * - Content/settings structure
   */
  useEffect(() => {
    // Skip if: no newsletter content, loading, or no auth
    const hasContent = newsletter || enhancedNewsletter;
    if (!hasContent || loading || !authData?.email) return;

    const saveTimer = setTimeout(async () => {
      try {
        const content: draftApi.DraftContent = {
          formatVersion: useEnhancedFormat ? 'v2' : 'v1',
          newsletter: newsletter
            ? {
                subject: newsletter.subject,
                introduction: newsletter.introduction,
                sections: newsletter.sections?.map((s) => ({
                  title: s.title,
                  content: s.content,
                  imagePrompt: s.imagePrompt,
                })),
                conclusion: newsletter.conclusion,
              }
            : undefined,
          enhancedNewsletter: useEnhancedFormat ? enhancedNewsletter : undefined,
        };

        const settings: draftApi.DraftSettings = {
          promptOfTheDay: promptOfTheDay || undefined,
        };

        // Note: selectedTone, selectedImageStyle, selectedAudiences, personaId
        // are now managed in their respective contexts and would need to be
        // passed in from the consuming component. For now, draft saves the
        // newsletter content and promptOfTheDay.

        // Get topics from localStorage as a fallback until TopicsContext integration
        const storedTopics = localStorage.getItem('selectedTopics');
        const topics = storedTopics ? JSON.parse(storedTopics) : [];

        await draftApi.saveDraft(authData.email, content, topics, settings);
        setLastDraftSaveTime(new Date());
        console.log('[NewsletterContext] Draft auto-saved');
      } catch (err) {
        console.warn('[NewsletterContext] Failed to auto-save draft:', err);
        // Non-blocking - don't interrupt user
      }
    }, 2000); // 2-second debounce - DO NOT CHANGE

    return () => clearTimeout(saveTimer);
  }, [
    newsletter,
    enhancedNewsletter,
    useEnhancedFormat,
    promptOfTheDay,
    loading,
    authData?.email,
  ]);

  const value: NewsletterContextValue = {
    // State
    newsletter,
    enhancedNewsletter,
    useEnhancedFormat,
    promptOfTheDay,
    loading,
    progress,
    workflowStatus,
    workflowActions,
    customAudiences,
    defaultAudiences,
    isDraftLoading,
    lastDraftSaveTime,
    // Tone, flavor, and image style state (Phase 6g.0)
    selectedTone,
    selectedFlavors,
    selectedImageStyle,
    toneOptions,
    flavorOptions,
    imageStyleOptions,
    // Actions
    setNewsletter,
    setEnhancedNewsletter,
    setUseEnhancedFormat,
    setPromptOfTheDay,
    setLoading,
    setProgress,
    setWorkflowStatus,
    setWorkflowActions,
    resetWorkflowActions,
    setCustomAudiences,
    addCustomAudience,
    removeCustomAudience,
    clearNewsletter,
    getCurrentNewsletter,
    // Tone, flavor, and image style actions (Phase 6g.0)
    setSelectedTone,
    setSelectedFlavors,
    handleFlavorChange,
    setSelectedImageStyle,
    getFlavorKeys,
  };

  return <NewsletterContext.Provider value={value}>{children}</NewsletterContext.Provider>;
};

/**
 * Hook to access newsletter context
 * Throws error if used outside NewsletterProvider
 */
export const useNewsletter = (): NewsletterContextValue => {
  const context = useContext(NewsletterContext);
  if (!context) {
    throw new Error('useNewsletter must be used within a NewsletterProvider');
  }
  return context;
};

/**
 * Hook for newsletter generation state
 */
export const useNewsletterGeneration = () => {
  const { loading, progress, setLoading, setProgress, resetWorkflowActions } = useNewsletter();

  return {
    loading,
    progress,
    isGenerating: !!loading,
    setLoading,
    setProgress,
    resetWorkflowActions,
  };
};

/**
 * Hook for newsletter format toggle
 */
export const useNewsletterFormat = () => {
  const {
    newsletter,
    enhancedNewsletter,
    useEnhancedFormat,
    setUseEnhancedFormat,
    getCurrentNewsletter,
  } = useNewsletter();

  return {
    newsletter,
    enhancedNewsletter,
    useEnhancedFormat,
    setUseEnhancedFormat,
    currentNewsletter: getCurrentNewsletter(),
    isV2: useEnhancedFormat,
  };
};

/**
 * Hook for workflow actions
 */
export const useWorkflowActions = () => {
  const { workflowStatus, workflowActions, setWorkflowStatus, setWorkflowActions } = useNewsletter();

  return {
    workflowStatus,
    workflowActions,
    setWorkflowStatus,
    setWorkflowActions,
    savedToDrive: workflowActions.savedToDrive,
    sentEmail: workflowActions.sentEmail,
  };
};

/**
 * Hook for custom audiences
 */
export const useCustomAudiences = () => {
  const {
    customAudiences,
    defaultAudiences,
    setCustomAudiences,
    addCustomAudience,
    removeCustomAudience,
  } = useNewsletter();

  return {
    customAudiences,
    defaultAudiences,
    allAudiences: [...defaultAudiences, ...customAudiences],
    setCustomAudiences,
    addCustomAudience,
    removeCustomAudience,
  };
};

/**
 * Hook for tone, flavor, and image style settings (Phase 6g.0)
 * Provides all newsletter styling options and their setters.
 */
export const useNewsletterSettings = () => {
  const {
    selectedTone,
    selectedFlavors,
    selectedImageStyle,
    toneOptions,
    flavorOptions,
    imageStyleOptions,
    setSelectedTone,
    setSelectedFlavors,
    handleFlavorChange,
    setSelectedImageStyle,
    getFlavorKeys,
  } = useNewsletter();

  return {
    // Tone
    selectedTone,
    setSelectedTone,
    toneOptions,
    // Flavors
    selectedFlavors,
    setSelectedFlavors,
    handleFlavorChange,
    flavorOptions,
    getFlavorKeys,
    // Image style
    selectedImageStyle,
    setSelectedImageStyle,
    imageStyleOptions,
  };
};

export default NewsletterContext;
