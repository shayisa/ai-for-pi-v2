import React, { useState, useCallback, useEffect } from 'react';
import type { Newsletter, NewsletterSection, TrendingTopic, GoogleSettings, GapiAuthData, Preset, EnhancedHistoryItem, PromptOfTheDay, Subscriber, SubscriberList, EnhancedNewsletter, EnhancedAudienceSection, AudienceConfig, WriterPersona, MismatchInfo, PerAudienceGenerationParams, MismatchResolution, TopicWithAudienceId } from './types';
import { AppProviders, useNewsletter, useTopics, useAudienceSelection, useTrendingContent, useNavigation, useError, useModals, useAuth, useSettings } from './contexts';
import { Header } from './components/Header';
import { NewsletterPreview } from './components/NewsletterPreview';
import { ImageEditorModal } from './components/ImageEditorModal';
import { Spinner } from './components/Spinner';
import { SparklesIcon, SearchIcon, LightbulbIcon, PlusIcon, XIcon, DriveIcon, SheetIcon, SendIcon, RefreshIcon, TypeIcon, ImageIcon, HistoryIcon, SettingsIcon, CodeIcon } from './components/IconComponents'; // Added new icons
import { generateNewsletterContent, generateImage, generateTopicSuggestions, generateTopicSuggestionsV2, generateTrendingTopics, generateTrendingTopicsWithSources, generateCompellingTrendingContent, generateTrendingTopicsV2, savePresetsToCloud, loadPresetsFromCloud, analyzeTopicAudienceMatch } from './services/claudeService';
import type { ParallelGenConfig } from './services/claudeService';
import { InspirationSources } from './components/InspirationSources';
import * as trendingDataService from './services/trendingDataService';
import type { TrendingSource } from './services/trendingDataService';
import * as archiveClientService from './services/archiveClientService';
import { SettingsModal } from './components/SettingsModal'; // SettingsModal is now only for initial sign-in/out feedback.
import * as googleApi from './services/googleApiService';
import { loadGoogleCredentialsFromBackend, checkGoogleAuthStatus } from './services/googleApiService';
import { fileToBase64 } from './utils/fileUtils';
import { PresetsManager } from './components/PresetsManager';
import { HistoryPanel } from './components/HistoryPanel';
import { PromptOfTheDayEditor } from './components/PromptOfTheDayEditor';
import { extractStrictJson } from './utils/stringUtils';
import { SideNavigation } from './components/SideNavigation'; // New
import { DiscoverTopicsPage } from './pages/DiscoverTopicsPage'; // New
import { ToneAndVisualsPage } from './pages/ToneAndVisualsPage'; // New - replaces DefineTonePage and ImageStylePage
import { GenerateNewsletterPage } from './pages/GenerateNewsletterPage'; // New
import { HistoryContentPage } from './pages/HistoryContentPage'; // New
import { SubscriberManagementPage } from './pages/SubscriberManagementPage'; // New
import { AuthenticationPage } from './pages/AuthenticationPage'; // New
import { LogsPage } from './pages/LogsPage'; // System activity logs
import { KnowledgeBasePage } from './pages/KnowledgeBasePage'; // RAG Knowledge Base
import { ContentCalendarPage } from './pages/ContentCalendarPage'; // Content calendar
import { SentHistoryPage } from './pages/SentHistoryPage'; // Phase 18: Sent email history
import { useHistory } from './hooks/useHistory';
import { usePrompts } from './hooks/usePrompts';
import { usePersonas } from './hooks/usePersonas';
import { useStyleThumbnails } from './hooks/useStyleThumbnails';
import { useTemplates } from './hooks/useTemplates';
import { useSavedTopics } from './hooks/useSavedTopics'; // Phase 15.5
import { useSavedSources } from './hooks/useSavedSources'; // Phase 15.6
import * as draftApi from './services/draftClientService';
import { PersonaEditor } from './components/PersonaEditor';
import { CalendarEntryPickerModal } from './components/CalendarEntryPickerModal';
import { TopicMismatchModal } from './components/TopicMismatchModal';
import { SendEmailModal, SendEmailRecipients } from './components/SendEmailModal';
import * as calendarApi from './services/calendarClientService';
import type { CalendarEntry } from './services/calendarClientService';
import type { SavedPrompt } from './services/promptClientService';
import * as newsletterApi from './services/newsletterClientService';
import * as subscriberApi from './services/subscriberClientService';
import * as enhancedNewsletterService from './services/enhancedNewsletterService';
import * as audienceApi from './services/audienceClientService';
import { isEnhancedNewsletter, convertEnhancedToLegacy } from './utils/newsletterFormatUtils';
import { AudienceConfigEditor } from './components/AudienceConfigEditor';


const audienceOptions: Record<string, { label: string; description: string }> = {
    academics: { label: 'Academics', description: 'Forensic anthropology & computational archeology professors.' },
    business: { label: 'Business Leaders', description: 'Admins & leaders upskilling in AI.' },
    analysts: { label: 'Data Analysts', description: 'Analysts extracting business intelligence.' },
};

// Phase 13.1: Research-backed 8-tone system (from 77+ award-winning newsletters)
const toneOptions: Record<string, { label: string; description: string; sampleOutput: string }> = {
    warm: { label: 'Warm', description: 'Friendly, accepting, and celebratory. Perfect for community and support content.', sampleOutput: "Welcome! We're so glad you're here. Here's what helped me, and I think it'll help you too." },
    confident: { label: 'Confident', description: 'Sure, direct, and authoritative. No hedging. Perfect for business and leadership.', sampleOutput: "This works. We've proven it with 50+ companies. Here's exactly what you need to do." },
    witty: { label: 'Witty', description: 'Clever, humorous, and engaging. Insider jokes that reward knowledge.', sampleOutput: 'This tool is impossibly good. The algorithm finally learned to be useful (only took 10 years).' },
    empathetic: { label: 'Empathetic', description: 'Understanding, validating, and supportive. Perfect for wellness and difficult topics.', sampleOutput: "I know this is hard. You're not alone in this—most people struggle with exactly what you're facing." },
    analytical: { label: 'Analytical', description: 'Thoughtful, intellectual, and nuanced. Multiple perspectives examined.', sampleOutput: 'On the surface, this seems like a simple efficiency gain. But actually, the second-order effects reveal something unexpected...' },
    urgent: { label: 'Urgent', description: 'Fast-paced, action-focused, FOMO-inducing. For breaking news and launches.', sampleOutput: "This changes everything. You need to know this now. Here's what's happening—and why it matters." },
    introspective: { label: 'Introspective', description: 'Reflective, questioning, and contemplative. For essays and personal development.', sampleOutput: "I've been thinking about this all week. Why do we believe this? What if we're asking the wrong question entirely?" },
    serious: { label: 'Serious', description: 'Formal, grave, and respectful. For crisis, investigative, or policy content.', sampleOutput: 'This matter demands your attention. The implications extend beyond the immediate situation, affecting how we understand...' },
};

const flavorOptions: Record<string, { label: string; description: string }> = {
    includeHumor: { label: 'Include light humor', description: 'Sprinkle in a few witty remarks or jokes.' },
    useSlang: { label: 'Use conversational slang', description: 'Makes the tone more relaxed and authentic.' },
    useJargon: { label: 'Incorporate technical jargon', description: 'For expert audiences who know the lingo.' },
    useAnalogies: { label: 'Use relatable analogies', description: 'Simplify complex topics for a broader audience.' },
    citeData: { label: 'Cite data and statistics', description: 'Add authority with facts and figures.' },
};

// Removed sampleImageUrl as per user request.
const imageStyleOptions: Record<string, { label: string; description: string }> = {
    photorealistic: { 
        label: 'Photorealistic', 
        description: 'Life-like, detailed images.'
    },
    vector: { 
        label: 'Vector Illustration', 
        description: 'Clean, flat, scalable graphics.'
    },
    watercolor: { 
        label: 'Watercolor', 
        description: 'Soft, blended, artistic style.'
    },
    pixel: { 
        label: 'Pixel Art', 
        description: 'Retro, blocky, 8-bit aesthetic.'
    },
    minimalist: { 
        label: 'Minimalist Line Art', 
        description: 'Simple, elegant, black & white.'
    },
    cyberpunk: { 
        label: 'Cyberpunk', 
        description: 'Futuristic, neon-lit, often dystopian.'
    },
    abstract: { 
        label: 'Abstract', 
        description: 'Non-representational, focusing on forms, colors, and textures.'
    },
    oilPainting: { 
        label: 'Oil Painting', 
        description: 'Classic, textured, rich brushstrokes.'
    },
    isometric: { 
        label: 'Isometric', 
        description: 'A 3D perspective, often used for game art or infographics.'
    },
};

export type ActivePage = 'authentication' | 'discoverTopics' | 'toneAndVisuals' | 'generateNewsletter' | 'history' | 'subscriberManagement' | 'logs' | 'contentCalendar' | 'knowledgeBase' | 'sentHistory';


type ErrorState = {
    message: string;
    onRetry?: () => void;
};

/**
 * AppContent - Main application content
 *
 * Phase 6a: Renamed from App to prepare for context architecture.
 * State will gradually migrate to contexts in Phases 6a-6e.
 */
const AppContent: React.FC = () => {
    // Setup wizard state - check if Supabase is configured
    const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);

    // Navigation state from UIContext (Phase 6g.9 Batch 2)
    const { activePage, setActivePage } = useNavigation();

    // Error state from UIContext (Phase 6g.9 Batch 2)
    const { error, setError } = useError();

    // Modal states from UIContext (Phase 6g.9 Batch 5)
    const {
        editingImage,
        openImageEditor,
        closeImageEditor,
        isAudienceEditorOpen,
        openAudienceEditor,
        closeAudienceEditor,
        isPersonaEditorOpen,
        editingPersona,
        openPersonaEditor,
        closePersonaEditor,
    } = useModals();

    // Auth state from AuthContext (Phase 6g.9 Batch 3)
    const { authData, setAuthData, isGoogleApiInitialized, setIsGoogleApiInitialized } = useAuth();

    // Settings state from SettingsContext (Phase 6g.9 Batch 3)
    const { googleSettings, saveSettings: setGoogleSettings } = useSettings();

    // Topics state from TopicsContext (Phase 6g.9 Batch 1 - migrated from local state)
    // Phase 18: Added getTopicContext for preserving topic-audience mapping
    const {
        selectedTopics,
        setSelectedTopics,
        customTopic,
        setCustomTopic,
        suggestedTopics,
        setSuggestedTopics,
        addTopic,
        removeTopic,
        selectSuggestedTopic,
        addTrendingTopic,
        isGeneratingTopics,
        setIsGeneratingTopics,
        getTopicContext,  // Phase 18: Get context (audienceId, resource) for topic
    } = useTopics();

    // Audience selection from TopicsContext (Phase 6g.9 Batch 1)
    const {
        selectedAudience,
        setSelectedAudience,
        handleAudienceChange,
        getAudienceKeys,
    } = useAudienceSelection();

    // Trending content from TopicsContext (Phase 6g.9 Batch 1 - combined with Batch 4)
    // Phase 17: Added setTrendingCacheMetadata for SWR display
    const {
        trendingContent,
        setTrendingContent,
        compellingContent,
        setCompellingContent,
        trendingSources,
        setTrendingSources,
        isFetchingTrending,
        setIsFetchingTrending,
        setTrendingCacheMetadata,
    } = useTrendingContent();
    // Newsletter state from context (Phase 6g.8 fix - must use context for GenerateNewsletterPage to work)
    const {
        newsletter,
        setNewsletter,
        enhancedNewsletter,
        setEnhancedNewsletter,
        useEnhancedFormat,
        setUseEnhancedFormat,
        promptOfTheDay,
        setPromptOfTheDay,
        loading,
        setLoading,
        progress,
        setProgress,
        customAudiences,
        setCustomAudiences,
        defaultAudiences,
        // Tone, flavor, image style - Phase 6g.8.2 fix: use context instead of local state
        selectedTone,
        setSelectedTone,
        selectedFlavors,
        setSelectedFlavors,
        selectedImageStyle,
        setSelectedImageStyle,
    } = useNewsletter();

    // NOTE: error, setError, editingImage, setEditingImage moved to UIContext (Phase 6g.9 Batch 2+5)
    // They are now imported from useError() and useModals() above
    // NOTE: Topics, audience, and trending states moved to TopicsContext (Phase 6g.9 Batch 1)
    // They are now imported from useTopics(), useAudienceSelection(), useTrendingContent() above
    // NOTE: selectedTone, selectedFlavors, selectedImageStyle moved to NewsletterContext (Phase 6g.8.2)
    // They are now imported from useNewsletter() above
    // NOTE: authData, setAuthData, isGoogleApiInitialized moved to AuthContext (Phase 6g.9 Batch 3)
    // NOTE: googleSettings moved to SettingsContext (Phase 6g.9 Batch 3)

    const [workflowStatus, setWorkflowStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [workflowActions, setWorkflowActions] = useState<{ savedToDrive: boolean; sentEmail: boolean }>({ savedToDrive: false, sentEmail: false });

    const [isSettingsOpen, setIsSettingsOpen] = useState(false); // This will now control the modal for initial sign-in/out feedback

    const [presets, setPresets] = useState<Preset[]>([]);

    // Newsletter history from SQLite
    const {
        history,
        isLoading: isHistoryLoading,
        addToHistory,
        loadFromHistory: loadHistoryItem,
        deleteFromHistory,
        refreshHistory
    } = useHistory();

    // Saved prompts library from SQLite
    const {
        prompts: savedPrompts,
        isLoading: isPromptsLoading,
        savePrompt: savePromptToLibrary,
        deletePrompt: deletePromptFromLibrary,
    } = usePrompts();

    // Writer personas from SQLite
    const {
        personas,
        activePersona,
        isLoading: isPersonasLoading,
        setActivePersona,
        createPersona,
        updatePersona,
        deletePersona,
        toggleFavorite,
    } = usePersonas();

    // Image style thumbnails from SQLite
    const {
        thumbnails,
        isLoading: isThumbnailsLoading,
        isGenerating: isGeneratingThumbnails,
        generatingStyles,
        progress: thumbnailProgress,
    } = useStyleThumbnails();

    // Newsletter templates from SQLite
    const {
        templates,
        isLoading: isTemplatesLoading,
        createFromNewsletter: createTemplateFromNewsletter,
    } = useTemplates();

    // Phase 15.5: Saved topics for auto-save
    // Phase 18: Also get topics list to look up sourceUrl for library topics
    const { saveTopicsBatch, topics: savedTopicsList } = useSavedTopics();

    // Phase 15.6: Saved sources for auto-save
    const { saveSourcesBatch } = useSavedSources();

    // Template selection state
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

    // NOTE: Persona editor modal state moved to UIContext (Phase 6g.9 Batch 5)
    // isPersonaEditorOpen, editingPersona are now imported from useModals() above

    // Calendar entry linking state
    const [pendingCalendarEntryId, setPendingCalendarEntryId] = useState<string | null>(null);
    const [pendingCalendarEntryTitle, setPendingCalendarEntryTitle] = useState<string | null>(null);

    // Phase 16: Calendar entry picker modal (for explicit linking from Generate page)
    const [showCalendarPicker, setShowCalendarPicker] = useState(false);

    // promptOfTheDay now comes from useNewsletter context (removed duplicate useState)

    // Subscriber management state
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [subscriberLists, setSubscriberLists] = useState<SubscriberList[]>([]);
    const [selectedEmailLists, setSelectedEmailLists] = useState<string[]>([]);

    // Phase 16: V4 per-audience generation state (V4 removed in Phase 19 - simplified to single generation path)
    const [showMismatchModal, setShowMismatchModal] = useState(false);

    // Phase 18: Send Email modal state
    const [showSendEmailModal, setShowSendEmailModal] = useState(false);
    const [mismatchData, setMismatchData] = useState<{
        mismatches: MismatchInfo[];
        selectedAudiences: AudienceConfig[];
    } | null>(null);

    // Enhanced newsletter v2 format state (useEnhancedFormat, enhancedNewsletter, customAudiences, defaultAudiences now from context)
    // NOTE: isAudienceEditorOpen moved to UIContext (Phase 6g.9 Batch 5)
    // It is now imported from useModals() above

    const handleSaveSettings = (settings: GoogleSettings) => {
        setGoogleSettings(settings);
        localStorage.setItem('googleSettings', JSON.stringify(settings));
        // isSettingsOpen is now only for the sign-in modal feedback
        // setIsSettingsOpen(false); 
    };

    const handleSavePreset = (name: string) => {
        const newPreset: Preset = {
            name,
            settings: {
                selectedAudience,
                selectedTone,
                selectedFlavors,
                selectedImageStyle,
                selectedTopics,
                personaId: activePersona?.id, // Phase 12.0: Save persona with preset
            },
        };
        const updatedPresets = presets.filter(p => p.name !== name);
        updatedPresets.unshift(newPreset);
        setPresets(updatedPresets);
        localStorage.setItem('newsletterPresets', JSON.stringify(updatedPresets));
    };

    const handleLoadPreset = (preset: Preset) => {
        setSelectedAudience(preset.settings.selectedAudience);
        setSelectedTone(preset.settings.selectedTone);
        setSelectedFlavors(preset.settings.selectedFlavors);
        setSelectedImageStyle(preset.settings.selectedImageStyle);
        setSelectedTopics(preset.settings.selectedTopics || []);
        // Phase 12.0: Restore persona if saved in preset
        if (preset.settings.personaId) {
            setActivePersona(preset.settings.personaId);
        }
        setActivePage('generateNewsletter'); // Navigate to generate page after loading preset
    };

    const handleDeletePreset = (name: string) => {
        const updatedPresets = presets.filter(p => p.name !== name);
        setPresets(updatedPresets);
        localStorage.setItem('newsletterPresets', JSON.stringify(updatedPresets));
    };

    // Template handlers
    const handleSelectTemplate = (templateId: string | null) => {
        setSelectedTemplateId(templateId);
        if (templateId) {
            const template = templates.find(t => t.id === templateId);
            if (template?.defaultSettings) {
                // Apply template's default settings
                if (template.defaultSettings.tone) setSelectedTone(template.defaultSettings.tone);
                if (template.defaultSettings.imageStyle) setSelectedImageStyle(template.defaultSettings.imageStyle);
                if (template.defaultSettings.audiences) {
                    const audienceRecord: Record<string, boolean> = {};
                    template.defaultSettings.audiences.forEach(key => { audienceRecord[key] = true; });
                    setSelectedAudience(audienceRecord);
                }
                console.log(`[App] Applied template settings: ${template.name}`);
            }
        }
    };

    const handleSaveAsTemplate = async (name: string, description: string) => {
        const currentNewsletter = useEnhancedFormat ? enhancedNewsletter : newsletter;
        if (!currentNewsletter) {
            throw new Error('No newsletter content to save as template');
        }

        // Build sections array based on format
        const sections = useEnhancedFormat && enhancedNewsletter
            ? enhancedNewsletter.audienceSections.map(s => ({
                title: s.title,
                content: s.content,
                imagePrompt: s.imagePrompt,
            }))
            : newsletter?.sections || [];

        await createTemplateFromNewsletter(
            name,
            description,
            {
                introduction: newsletter?.introduction || enhancedNewsletter?.editorsNote?.message || '',
                sections,
                conclusion: newsletter?.conclusion || enhancedNewsletter?.conclusion || '',
                promptOfTheDay,
            },
            {
                tone: selectedTone,
                imageStyle: selectedImageStyle,
                audiences: Object.keys(selectedAudience).filter(k => selectedAudience[k]),
                personaId: activePersona?.id,
            }
        );
        console.log(`[App] Saved template: ${name}`);
    };

    const handleSyncPresetsToCloud = async () => {
        try {
            if (!authData?.access_token) {
                throw new Error('Not authenticated. Please sign in to sync presets to Google Sheets.');
            }
            await savePresetsToCloud(presets, authData.access_token);
        } catch (error) {
            console.error('Error syncing presets to cloud:', error);
            throw error;
        }
    };

    const handleLoadPresetsFromCloud = async () => {
        try {
            if (!authData?.access_token) {
                throw new Error('Not authenticated. Please sign in to load presets from Google Sheets.');
            }
            const result = await loadPresetsFromCloud(authData.access_token);
            if (result.presets && result.presets.length > 0) {
                setPresets(result.presets);
                localStorage.setItem('newsletterPresets', JSON.stringify(result.presets));
            }
        } catch (error) {
            console.error('Error loading presets from cloud:', error);
            throw error;
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            // Use the default email for OAuth flow
            const defaultEmail = 'shayisa@gmail.com';
            await googleApi.signIn(defaultEmail);
            // User will be redirected to Google consent screen
            // On return, OAuth callback will handle the rest
        } catch (error) {
            console.error('Error signing in:', error);
        }
    };

    const handleGoogleSignOut = async () => {
        try {
            const userEmail = authData?.email || 'shayisa@gmail.com';
            await googleApi.signOut(userEmail);
            setAuthData(null);
            setActivePage('authentication');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const handleAddToHistory = async (generatedNewsletter: Newsletter, topics: string[]) => {
        try {
            await addToHistory(generatedNewsletter, topics);
            console.log('[App] Newsletter saved to SQLite');

            // Link to calendar entry if generation was started from calendar
            if (pendingCalendarEntryId && generatedNewsletter.id) {
                try {
                    await calendarApi.linkNewsletter(pendingCalendarEntryId, generatedNewsletter.id);
                    console.log(`[App] Linked newsletter to calendar entry: ${pendingCalendarEntryId}`);

                    // Phase 6: Show confirmation toast when newsletter is linked to calendar
                    setWorkflowStatus({
                        message: `Newsletter linked to calendar entry: ${pendingCalendarEntryTitle || 'Entry'}`,
                        type: 'success'
                    });

                    setPendingCalendarEntryId(null); // Clear after linking
                    setPendingCalendarEntryTitle(null); // Clear title indicator
                } catch (linkErr) {
                    console.warn('[App] Failed to link newsletter to calendar:', linkErr);
                    // Non-critical - don't block the user
                }
            }

            // Clear draft after successful generation (work is now saved in history)
            if (authData?.email) {
                try {
                    await draftApi.deleteDraft(authData.email);
                    console.log('[App] Draft cleared after successful generation');
                } catch (draftErr) {
                    console.warn('[App] Failed to clear draft:', draftErr);
                    // Non-critical - draft will be overwritten or recovered anyway
                }
            }
        } catch (err) {
            console.error('[App] Failed to save newsletter to SQLite:', err);
            // Non-critical - don't show error to user
        }
    };

    // Load newsletter from history with format detection (supports v1 and v2)
    const handleLoadFromHistory = (item: EnhancedHistoryItem) => {
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
    };

    // Handle starting generation from calendar entry (pre-populates settings)
    // Phase 5: Modified to load linked newsletter if present
    const handleStartFromCalendarEntry = useCallback(async (entry: CalendarEntry) => {
        setPendingCalendarEntryId(entry.id);
        setPendingCalendarEntryTitle(entry.title);  // Store title for display in Generate page

        // If entry has a linked newsletter, load it into preview
        if (entry.newsletterId) {
            try {
                const result = await newsletterApi.getNewsletterById(entry.newsletterId);
                if (result.formatVersion === 'v2') {
                    setUseEnhancedFormat(true);
                    setEnhancedNewsletter(result.newsletter as EnhancedNewsletter);
                    setNewsletter(null);
                } else {
                    setUseEnhancedFormat(false);
                    setNewsletter(result.newsletter as Newsletter);
                    setEnhancedNewsletter(null);
                }
                setSelectedTopics(result.topics);
            } catch (err) {
                console.warn('[App] Could not load linked newsletter, starting fresh:', err);
                setSelectedTopics(entry.topics);
            }
        } else {
            setSelectedTopics(entry.topics);
        }

        // Apply saved settings if available
        if (entry.settings) {
            if (entry.settings.selectedAudience) {
                setSelectedAudience(entry.settings.selectedAudience);
            }
            if (entry.settings.selectedTone) {
                setSelectedTone(entry.settings.selectedTone);
            }
            if (entry.settings.selectedFlavors) {
                setSelectedFlavors(entry.settings.selectedFlavors);
            }
            if (entry.settings.selectedImageStyle) {
                setSelectedImageStyle(entry.settings.selectedImageStyle);
            }
            if (entry.settings.personaId) {
                setActivePersona(entry.settings.personaId);
            }
        }

        setActivePage('generateNewsletter');
    }, [setActivePersona]);

    // Phase 3: Handler to view linked newsletter from calendar
    const handleViewLinkedNewsletter = useCallback(async (newsletterId: string, calendarEntry: CalendarEntry) => {
        try {
            const result = await newsletterApi.getNewsletterById(newsletterId);

            // Format detection and state loading
            if (result.formatVersion === 'v2') {
                setUseEnhancedFormat(true);
                setEnhancedNewsletter(result.newsletter as EnhancedNewsletter);
                setNewsletter(null);
            } else {
                setUseEnhancedFormat(false);
                setNewsletter(result.newsletter as Newsletter);
                setEnhancedNewsletter(null);
            }

            setSelectedTopics(result.topics);
            setPendingCalendarEntryId(calendarEntry.id);
            setPendingCalendarEntryTitle(calendarEntry.title);
            setActivePage('generateNewsletter');

            // Toast confirmation
            setWorkflowStatus({ message: `Loaded newsletter: ${result.subject}`, type: 'success' });
        } catch (err) {
            console.error('[App] Failed to load newsletter:', err);
            setError({ message: 'Could not load the linked newsletter.' });
        }
    }, [setError]);

    // Phase 4: Handler to generate new newsletter from calendar (replaces existing link)
    const handleGenerateNewFromCalendar = useCallback((entry: CalendarEntry) => {
        if (entry.newsletterId) {
            const confirmed = window.confirm(
                'This calendar entry already has a linked newsletter.\n\n' +
                'Generating a new newsletter will replace the existing link.\n\nContinue?'
            );
            if (!confirmed) return;
        }

        // Clear existing newsletter and start fresh
        setNewsletter(null);
        setEnhancedNewsletter(null);
        handleStartFromCalendarEntry(entry);
    }, [handleStartFromCalendarEntry]);

    // Phase 16: Handler for explicit calendar entry linking from Generate page
    const handleExplicitCalendarLink = useCallback(async (entryId: string, entryTitle: string) => {
        // Get the current newsletter ID
        const currentNewsletterId = useEnhancedFormat && enhancedNewsletter
            ? enhancedNewsletter.id
            : newsletter?.id;

        if (!currentNewsletterId) {
            console.warn('[App] No newsletter to link');
            return;
        }

        try {
            await calendarApi.linkNewsletter(entryId, currentNewsletterId);
            setPendingCalendarEntryId(entryId);
            setPendingCalendarEntryTitle(entryTitle);
            setWorkflowStatus({
                message: `Newsletter linked to: ${entryTitle}`,
                type: 'success'
            });
            console.log(`[App] Linked newsletter ${currentNewsletterId} to calendar entry ${entryId}`);
        } catch (err) {
            console.error('[App] Failed to link newsletter to calendar:', err);
            setWorkflowStatus({
                message: 'Failed to link newsletter to calendar entry',
                type: 'error'
            });
        }
    }, [newsletter, enhancedNewsletter, useEnhancedFormat]);

    // Load newsletter from Drive with format detection (supports v1 and v2)
    const handleLoadFromDrive = (
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
        // Scroll to the preview
        setTimeout(() => {
            const previewElement = document.getElementById('newsletter-preview');
            if (previewElement) {
                previewElement.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);
    };

    const handleClearHistory = async () => {
        // Note: Full clear not implemented - use individual delete
        // For now, just refresh to sync with SQLite
        await refreshHistory();
    };

    // Load a saved prompt from the library into the Prompt of the Day editor
    const handleLoadSavedPrompt = (savedPrompt: SavedPrompt) => {
        setPromptOfTheDay({
            title: savedPrompt.title,
            summary: savedPrompt.summary,
            examplePrompts: savedPrompt.examplePrompts,
            promptCode: savedPrompt.promptCode,
        });
        // Navigate to generate page where the prompt editor is
        setActivePage('generateNewsletter');
    };

    // Save current prompt of the day to the library
    const handleSavePromptToLibrary = async (prompt: PromptOfTheDay) => {
        await savePromptToLibrary({
            title: prompt.title,
            summary: prompt.summary,
            examplePrompts: prompt.examplePrompts,
            promptCode: prompt.promptCode,
        });
    };

    // NOTE: getAudienceKeys moved to TopicsContext (Phase 6g.9 Batch 1)
    // It is now imported from useAudienceSelection() above
    const getFlavorKeys = useCallback(() => Object.keys(selectedFlavors).filter(key => selectedFlavors[key]), [selectedFlavors]);

    // Refresh subscriber lists from SQLite
    const refreshSubscriberLists = useCallback(async () => {
        try {
            const response = await subscriberApi.getLists();
            setSubscriberLists(response.lists);
        } catch (err) {
            console.error('Error refreshing subscriber lists:', err);
            setSubscriberLists([]);
        }
    }, []);

    const isActionLoading = !!loading || isGeneratingTopics;

    const fetchTrendingContent = useCallback(async () => {
        setIsFetchingTrending(true);
        setTrendingContent(null);
        setCompellingContent(null);
        setTrendingSources([]);
        setTrendingCacheMetadata(null); // Phase 17: Reset cache metadata
        setError(null);

        const audience = getAudienceKeys();
        if (audience.length === 0) {
            setError({ message: "Please select an audience to see trending topics." });
            setIsFetchingTrending(false);
            return;
        }

        // Track fetched sources for archiving
        let fetchedSources: TrendingSource[] = [];

        try {
            // Step 1: Fetch trending sources for the Inspiration Sources panel
            console.log("Fetching trending sources...");
            try {
                const allSources = await trendingDataService.fetchAllTrendingSources();
                fetchedSources = trendingDataService.filterSourcesByAudience(allSources, audience);
                setTrendingSources(fetchedSources);
                console.log(`[Sources] Loaded ${fetchedSources.length} sources (filtered from ${allSources.length} by audience)`);

                // Phase 15.6: Auto-save trending sources to SQLite for persistence
                if (fetchedSources.length > 0) {
                    try {
                        const batchResult = await saveSourcesBatch(
                            fetchedSources.map(s => ({
                                title: s.title,
                                url: s.url,
                                author: s.author,
                                publication: s.publication,
                                date: s.date,
                                category: s.category,
                                summary: s.summary,
                            }))
                        );
                        console.log(`[Sources] Auto-saved ${batchResult.created.length} sources to library (${batchResult.duplicateCount} duplicates skipped)`);
                    } catch (saveErr) {
                        console.warn('[Sources] Failed to auto-save sources:', saveErr);
                        // Non-fatal: sources are still in UI state
                    }
                }
            } catch (err) {
                console.warn("Could not fetch trending sources:", err);
            }

            // Step 2: Phase 15.3b - Use V2 parallel generation for BALANCED trending topics
            // This runs parallel agents per-audience and merges with equal representation
            console.log("[V2] Generating parallel trending topics for balanced audience representation...");
            const v2Result = await generateTrendingTopicsV2(
                audience,
                { mode: 'per-audience', topicsPerAgent: 3 }, // Per-audience mode for best balance
                true // Auto-confirm (skip trade-off display for now)
            );

            if (v2Result.success && v2Result.topics && v2Result.topics.length > 0) {
                // Use V2 balanced topics as the primary trending content
                // Include ALL rich fields for proper UI rendering (Phase 15.3c fix)
                setTrendingContent(v2Result.topics.map(t => ({
                    title: t.title,
                    summary: t.summary,
                    id: t.id,
                    audienceId: t.audienceId,
                    // Rich format fields
                    whatItIs: t.whatItIs,
                    newCapability: t.newCapability,
                    whoShouldCare: t.whoShouldCare,
                    howToGetStarted: t.howToGetStarted,
                    expectedImpact: t.expectedImpact,
                    resource: t.resource,
                })));

                // Phase 17: Set cache metadata for SWR display
                setTrendingCacheMetadata({
                    cached: v2Result.cached || false,
                    isStale: v2Result.isStale || false,
                    cacheAge: v2Result.cacheAge,
                    fetchedAt: Date.now(),
                });

                console.log(`[V2] Generated ${v2Result.topics.length} topics with equal audience representation`);
                if (v2Result.perAudienceResults) {
                    v2Result.perAudienceResults.forEach(r => {
                        console.log(`[V2]   ${r.batchId}: ${r.topicCount} topics (${r.success ? 'success' : 'failed'})`);
                    });
                }
                if (v2Result.totalDurationMs) {
                    console.log(`[V2] Total generation time: ${v2Result.totalDurationMs}ms`);
                }
            } else {
                console.warn("[V2] No topics returned, falling back to compelling content extraction");
            }

            // Step 3: Still generate compelling content for actionable insights panel
            // This provides the detailed capability cards even if V2 topics are used above
            console.log("Generating compelling trending content with actionable insights...");
            const result = await generateCompellingTrendingContent(audience);
            const rawJsonString = result.text;
            const cleanedJsonString = extractStrictJson(rawJsonString);
            const compellingData = JSON.parse(cleanedJsonString);
            setCompellingContent(compellingData);

            // Fallback: If V2 didn't produce topics, use compelling content titles
            if (!v2Result.success || !v2Result.topics || v2Result.topics.length === 0) {
                if (compellingData.actionableCapabilities && Array.isArray(compellingData.actionableCapabilities)) {
                    const titles = compellingData.actionableCapabilities.map((item: any) => item.title);
                    setTrendingContent(titles.map((title: string) => ({ title, summary: "Actionable AI capability from trending insights" })));
                    console.log("[Fallback] Using compelling content titles as trending topics");
                }
            }

            // Auto-save archive after successful fetch
            // Phase 18: Preserve full topic objects including audienceId and resource
            // NOTE: Use length check, not ||, because [] is truthy in JavaScript
            try {
                const archiveContent = {
                    trendingTopics: (v2Result.topics && v2Result.topics.length > 0)
                        ? v2Result.topics
                        : compellingData.actionableCapabilities?.map((item: any) => ({
                            title: item.title,
                            summary: item.description || item.whatItIs || "",
                            // Preserve rich context fields from compellingContent fallback
                            whatItIs: item.whatItIs,
                            newCapability: item.newCapability,
                            whoShouldCare: item.whoShouldCare,
                            howToGetStarted: item.howToGetStarted,
                            expectedImpact: item.expectedImpact,
                            resource: item.resource || item.url,
                        })) || [],
                    compellingContent: compellingData,
                    trendingSources: fetchedSources
                };
                const savedArchive = await archiveClientService.saveArchive(archiveContent, audience);
                console.log(`[Archive] Auto-saved: ${savedArchive.name} (${savedArchive.id})`);
            } catch (archiveError) {
                console.warn("[Archive] Could not auto-save:", archiveError);
            }
        } catch (e) {
            console.error("Failed to fetch trending content:", e);
            const errorMessage = e instanceof SyntaxError
                ? "Could not parse trending insights. The model returned an unexpected format."
                : "Could not load trending insights due to a network error.";
            setError({ message: errorMessage, onRetry: fetchTrendingContent });
        } finally {
            setIsFetchingTrending(false);
        }
    }, [getAudienceKeys, saveSourcesBatch]);

    // Load content from an archive (skips API calls, saves tokens)
    const handleLoadFromArchive = useCallback((content: archiveClientService.ArchiveContent, audience: string[]) => {
        console.log('[Archive] Loading from archive...');
        console.log('[Archive] Received content:', {
            hasTrendingTopics: !!content.trendingTopics,
            trendingTopicsCount: content.trendingTopics?.length || 0,
            hasCompellingContent: !!content.compellingContent,
            hasTrendingSources: !!content.trendingSources,
        });

        // Set trending sources
        if (content.trendingSources) {
            setTrendingSources(content.trendingSources as TrendingSource[]);
        }

        // Set compelling content
        if (content.compellingContent) {
            setCompellingContent(content.compellingContent);
        }

        // Extract trending topics - preserve full rich content when available
        if (content.trendingTopics && content.trendingTopics.length > 0) {
            console.log('[Archive] Setting trendingContent with', content.trendingTopics.length, 'topics:',
                content.trendingTopics.map(t => t.title));
            setTrendingContent(content.trendingTopics);
        } else if (content.compellingContent?.actionableCapabilities) {
            // Fallback: Convert actionableCapabilities to trending topics format
            // PRESERVE all rich content fields, not just title!
            setTrendingContent(content.compellingContent.actionableCapabilities.map((item: any) => ({
                title: item.title,
                summary: item.description || item.whatItIs || "",
                whatItIs: item.whatItIs,
                newCapability: item.newCapability,
                whoShouldCare: item.whoShouldCare,
                howToGetStarted: item.howToGetStarted,
                expectedImpact: item.expectedImpact,
                resource: item.resource || item.url,
            })));
        }

        // Update audience selection to match archive
        if (audience && audience.length > 0) {
            const newAudience: Record<string, boolean> = {};
            Object.keys(selectedAudience).forEach(key => {
                newAudience[key] = audience.includes(key);
            });
            setSelectedAudience(newAudience);
        }

        console.log('[Archive] Content loaded successfully');
    }, [selectedAudience]);

    // NOTE: handleAudienceChange moved to TopicsContext (Phase 6g.9 Batch 1)
    // It is now imported from useAudienceSelection() above

    const handleFlavorChange = (key: string) => {
        setSelectedFlavors(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // NOTE: Topic handlers moved to TopicsContext (Phase 6g.9 Batch 1)
    // addTopic, removeTopic, selectSuggestedTopic, addTrendingTopic are now imported from useTopics() above

    const handleGenerateSuggestions = useCallback(async () => {
        const audience = getAudienceKeys();
        if (audience.length === 0) {
            setError({ message: "Please select a target audience before generating suggestions." });
            return;
        }
        setIsGeneratingTopics(true);
        setError(null);
        try {
            // Phase 15.4: Use V2 parallel per-audience generation
            // This spawns parallel agents per audience, each generating 3 topics
            // Results are merged with equal representation and audience tagging
            console.log("[V2] Generating parallel topic suggestions for balanced audience representation...");
            console.log("[V2] Audiences:", audience);

            const result = await generateTopicSuggestionsV2(audience, 3);

            console.log("[V2] Topic suggestions result:", {
                success: result.success,
                topicCount: result.topics?.length,
                perAudienceResults: result.perAudienceResults,
                totalDurationMs: result.totalDurationMs,
            });

            if (result.success && result.topics && result.topics.length > 0) {
                // Log per-audience breakdown
                if (result.perAudienceResults) {
                    result.perAudienceResults.forEach(r => {
                        console.log(`[V2]   ${r.audienceId}: ${r.topicCount} topics (${r.success ? 'success' : 'failed'})`);
                    });
                }

                // Merge with existing suggestions, removing duplicates by title
                const existingTitles = new Set(suggestedTopics.map(t => t.title));
                const newTopics = result.topics.filter(t => !existingTitles.has(t.title));
                setSuggestedTopics([...suggestedTopics, ...newTopics]);

                console.log(`[V2] Added ${newTopics.length} new suggestions (${result.topics.length - newTopics.length} duplicates skipped)`);

                // Phase 15.5: Auto-save new topics to SQLite for persistence
                if (newTopics.length > 0) {
                    try {
                        const batchResult = await saveTopicsBatch(
                            newTopics.map(t => ({
                                title: t.title,
                                category: 'suggested' as const,
                                sourceUrl: t.resource,
                            }))
                        );
                        console.log(`[V2] Auto-saved ${batchResult.created.length} topics to library (${batchResult.duplicateCount} duplicates in DB skipped)`);
                    } catch (saveErr) {
                        console.warn('[V2] Failed to auto-save topics to library:', saveErr);
                        // Non-fatal: topics are still in UI state, just not persisted
                    }
                }
            } else {
                console.warn("[V2] No topics returned from parallel generation");
                setError({ message: "No topic suggestions were generated. Please try again.", onRetry: handleGenerateSuggestions });
            }
        } catch (e) {
            console.error("Failed to generate topic suggestions:", e);
            const errorMessage = e instanceof Error
                ? `Failed to generate topic suggestions: ${e.message}`
                : "Failed to generate topic suggestions due to a network error.";
            setError({ message: errorMessage, onRetry: handleGenerateSuggestions });
        } finally {
            setIsGeneratingTopics(false);
        }
    }, [getAudienceKeys, suggestedTopics, setSuggestedTopics, setIsGeneratingTopics, saveTopicsBatch]);

    const handleGenerateNewsletter = useCallback(async () => {
        const audience = getAudienceKeys();
        const flavors = getFlavorKeys();

        if (selectedTopics.length === 0) {
            setError({ message: "Please add at least one topic." });
            return;
        }
        if (audience.length === 0) {
            setError({ message: "Please select a target audience for the newsletter." });
            return;
        }
        setLoading("Generating newsletter content...");
        setProgress(10);
        setError(null);
        setNewsletter(null);
        setEnhancedNewsletter(null); // Clear v2 state when generating v1
        setWorkflowStatus(null);
        setWorkflowActions({ savedToDrive: false, sentEmail: false });

        try {
            const result = await generateNewsletterContent(selectedTopics, audience, selectedTone, flavors, selectedImageStyle, activePersona?.id);

            const rawJsonString = result.text;
            console.log("Raw Newsletter Content JSON response:", rawJsonString);
            const cleanedJsonString = extractStrictJson(rawJsonString);
            console.log("Cleaned Newsletter Content JSON string for parsing:", cleanedJsonString);

            const parsedNewsletter: Newsletter = JSON.parse(cleanedJsonString);
            // Generate unique ID for this newsletter
            parsedNewsletter.id = `nl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            // Include prompt of the day if it's set
            if (promptOfTheDay) {
                parsedNewsletter.promptOfTheDay = promptOfTheDay;
            }
            setNewsletter(parsedNewsletter);

            setLoading("Generating images...");
            setProgress(35);
            const imageGenerationPromises = parsedNewsletter.sections.map((section, index) =>
                generateImage(section.imagePrompt, selectedImageStyle)
                    .then(base64Image => ({
                        index,
                        imageUrl: `data:image/png;base64,${base64Image}`
                    }))
                    .catch(e => {
                        console.error(`Failed to generate image for prompt: "${section.imagePrompt}"`, e);
                         // Don't set a global error, let the section show it failed
                        return { index, imageUrl: null };
                    })
            );

            const generatedImages = await Promise.all(imageGenerationPromises);
            setProgress(75);

            let finalNewsletter: Newsletter | null = null;
            setNewsletter(currentNewsletter => {
                if (!currentNewsletter) return null;
                const updatedSections = [...currentNewsletter.sections];
                generatedImages.forEach(imageResult => {
                    if (imageResult) { // imageResult can be null
                        updatedSections[imageResult.index].imageUrl = imageResult.imageUrl;
                    }
                });
                finalNewsletter = { ...currentNewsletter, sections: updatedSections };
                return finalNewsletter;
            });

            // Add to history after images are generated and state is set
            if (finalNewsletter) {
                 handleAddToHistory(finalNewsletter, selectedTopics);

                // Update SQLite with generated imageUrls so they persist when loading from history
                if (finalNewsletter.id) {
                    try {
                        await newsletterApi.updateNewsletterSections(
                            finalNewsletter.id,
                            finalNewsletter.sections,
                            undefined,
                            'v1'
                        );
                        console.log('[Newsletter] Updated SQLite with generated imageUrls');
                    } catch (updateError) {
                        console.warn('[Newsletter] Failed to update SQLite with imageUrls:', updateError);
                    }
                }

                // Auto-save to Drive after newsletter approval
                if (googleSettings && authData?.access_token) {
                    try {
                        setLoading("Auto-saving to Google Drive...");
                        setProgress(90);
                        const userEmail = authData?.email || 'shayisa@gmail.com';
                        await googleApi.saveToDrive(userEmail, finalNewsletter, selectedTopics);
                        // Update tracking state
                        setWorkflowActions({ ...workflowActions, savedToDrive: true });
                        setWorkflowStatus({
                            message: `Newsletter auto-saved to Drive!`,
                            type: 'success'
                        });
                    } catch (autoSaveError) {
                        console.warn("Auto-save to Drive failed:", autoSaveError);
                        // Don't show error to user - this is non-critical
                    }
                }
            }

        } catch (e) {
            console.error(e);
            const errorMessage = e instanceof SyntaxError
                ? "Failed to generate newsletter. The model returned an invalid JSON structure. Please try modifying your topics or settings."
                : "An unexpected network error occurred while generating the newsletter.";
            setError({ message: errorMessage, onRetry: handleGenerateNewsletter });
        } finally {
            setLoading(null);
            setProgress(0);
        }
    }, [selectedTopics, getAudienceKeys, selectedTone, getFlavorKeys, selectedImageStyle, promptOfTheDay]);

    // Enhanced newsletter generation (v2 format)
    const handleGenerateEnhancedNewsletter = useCallback(async () => {
        const audienceKeys = getAudienceKeys();

        if (selectedTopics.length === 0) {
            setError({ message: "Please add at least one topic." });
            return;
        }
        if (audienceKeys.length === 0) {
            setError({ message: "Please select a target audience for the newsletter." });
            return;
        }

        setLoading("Fetching sources and generating enhanced newsletter...");
        setProgress(10);
        setError(null);
        setEnhancedNewsletter(null);
        setNewsletter(null); // Clear legacy newsletter
        setWorkflowStatus(null);
        setWorkflowActions({ savedToDrive: false, sentEmail: false });

        try {
            // Build audience configs from selected audiences
            const selectedAudienceConfigs: AudienceConfig[] = audienceKeys.map(key => {
                // Check custom audiences first
                const customAudience = customAudiences.find(a => a.id === key);
                if (customAudience) return customAudience;

                // Check default audiences
                const defaultAudience = defaultAudiences.find(a => a.id === key);
                if (defaultAudience) return defaultAudience;

                // Fallback to basic config from audienceOptions
                const option = audienceOptions[key];
                return {
                    id: key,
                    name: option?.label || key,
                    description: option?.description || '',
                };
            });

            setLoading("Fetching sources from GDELT, ArXiv, Reddit...");
            setProgress(20);

            // Phase 17: Convert topics to full objects with resource URLs
            // This allows topics with pre-existing sources to skip Brave validation
            // Phase 18: Check topic context map FIRST (preserves audience from archives)
            const topicsWithContext: TopicWithAudienceId[] = selectedTopics.map(topicTitle => {
                // Phase 18: FIRST check topic context map (from addTopicWithContext)
                // This is the primary source for archived topic context
                const savedContext = getTopicContext(topicTitle);

                // Then check suggested topics (from AI generation in current session)
                const suggested = suggestedTopics.find(s => s.title === topicTitle);

                // Also check saved topics library for sourceUrl
                const savedTopic = savedTopicsList.find(s => s.title === topicTitle);

                // Priority for audienceId: context map > suggested > first audience
                const audienceId = savedContext?.audienceId || suggested?.audienceId || audienceKeys[0];

                // Priority for resource: context map > suggested > saved library
                const sourceUrl = savedContext?.resource || suggested?.resource || savedTopic?.sourceUrl;

                // Log if context was found (helps debug audience distribution)
                if (savedContext?.audienceId) {
                    console.log(`[Enhanced] Topic "${topicTitle}" using saved context: audience=${savedContext.audienceId}`);
                }

                return {
                    title: topicTitle,
                    audienceId,
                    summary: suggested?.summary || savedTopic?.description,
                    resource: sourceUrl,
                    whatItIs: savedContext?.whatItIs || suggested?.whatItIs,
                    newCapability: savedContext?.newCapability || suggested?.newCapability,
                    whoShouldCare: suggested?.whoShouldCare,
                    howToGetStarted: suggested?.howToGetStarted,
                    expectedImpact: suggested?.expectedImpact,
                };
            });

            // Phase 18: Log audience distribution to detect single-audience issue
            const audienceDistribution = topicsWithContext.reduce((acc, t) => {
                acc[t.audienceId] = (acc[t.audienceId] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            console.log('[Enhanced] Phase 18: Topic-audience distribution:', audienceDistribution);

            console.log('[Enhanced] Phase 17: Topics with sources:',
                topicsWithContext.filter(t => t.resource).length, 'of', topicsWithContext.length);

            // Phase 14: Pass tone and flavors for quality fix
            const result = await enhancedNewsletterService.generateEnhancedNewsletter({
                topics: topicsWithContext,  // Phase 17: Send full objects with resource URLs
                audiences: selectedAudienceConfigs,
                imageStyle: selectedImageStyle,
                promptOfTheDay: promptOfTheDay, // Include user-supplied prompt if set
                personaId: activePersona?.id,
                tone: selectedTone,
                flavors: getFlavorKeys(),
            });

            setProgress(70);
            setLoading("Processing newsletter...");

            // Set the enhanced newsletter
            setEnhancedNewsletter(result.newsletter);

            // Log source fetch results
            console.log('[Enhanced] Sources fetched:', result.sources);

            setProgress(90);
            setLoading("Generating images...");

            // Generate images for each audience section
            let generatedImages: Array<{ index: number; imageUrl: string | null }> = [];
            if (result.newsletter.audienceSections) {
                const imagePromises = result.newsletter.audienceSections.map(async (section, index) => {
                    if (section.imagePrompt) {
                        try {
                            const base64Image = await generateImage(section.imagePrompt, selectedImageStyle);
                            return { index, imageUrl: `data:image/png;base64,${base64Image}` };
                        } catch (err) {
                            console.error(`Failed to generate image for section ${index}:`, err);
                            return { index, imageUrl: null };
                        }
                    }
                    return { index, imageUrl: null };
                });

                generatedImages = await Promise.all(imagePromises);

                setEnhancedNewsletter(current => {
                    if (!current) return null;
                    const updatedSections = [...current.audienceSections];
                    generatedImages.forEach(img => {
                        if (img.imageUrl && updatedSections[img.index]) {
                            updatedSections[img.index].imageUrl = img.imageUrl;
                        }
                    });
                    return { ...current, audienceSections: updatedSections };
                });
            }

            setProgress(100);

            // Build final newsletter with generated images
            const finalEnhancedNewsletter: EnhancedNewsletter = {
                ...result.newsletter,
                audienceSections: result.newsletter.audienceSections.map((section, idx) => {
                    const generatedImg = generatedImages.find(img => img.index === idx);
                    return generatedImg?.imageUrl
                        ? { ...section, imageUrl: generatedImg.imageUrl }
                        : section;
                })
            };

            // Update SQLite with generated imageUrls so they persist when loading from history
            if (finalEnhancedNewsletter.id) {
                try {
                    await newsletterApi.updateNewsletterSections(
                        finalEnhancedNewsletter.id,
                        undefined,
                        finalEnhancedNewsletter.audienceSections,
                        'v2'
                    );
                    console.log('[Enhanced] Updated SQLite with generated imageUrls');
                } catch (updateError) {
                    console.warn('[Enhanced] Failed to update SQLite with imageUrls:', updateError);
                }
            }

            // Auto-save to Google Drive (matches legacy behavior)
            if (googleSettings && authData?.access_token) {
                try {
                    setLoading("Auto-saving to Google Drive...");
                    const userEmail = authData?.email || 'shayisa@gmail.com';
                    // Convert to legacy format for Drive HTML, but preserve v2 data in embedded JSON
                    const legacyNewsletter = convertEnhancedToLegacy(finalEnhancedNewsletter);
                    await googleApi.saveToDrive(userEmail, legacyNewsletter, selectedTopics, finalEnhancedNewsletter);
                    setWorkflowActions({ ...workflowActions, savedToDrive: true });
                    setWorkflowStatus({
                        message: `Newsletter auto-saved to Drive!`,
                        type: 'success'
                    });
                } catch (autoSaveError) {
                    console.warn("Auto-save to Drive failed:", autoSaveError);
                    // Don't show error to user - this is non-critical
                }
            }

        } catch (e) {
            console.error('Enhanced newsletter generation failed:', e);

            // Phase 15: Handle validation errors with detailed feedback
            let errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';
            let detailsMessage = '';

            // Check if this is an ApiError with validation details
            if (e && typeof e === 'object' && 'invalidTopics' in e) {
                const apiError = e as {
                    message: string;
                    invalidTopics?: string[];
                    suggestions?: string[];
                };
                if (apiError.invalidTopics && apiError.invalidTopics.length > 0) {
                    detailsMessage = `\n\nInvalid/fictional topics: ${apiError.invalidTopics.join(', ')}`;
                }
                if (apiError.suggestions && apiError.suggestions.length > 0) {
                    detailsMessage += `\n\nSuggested alternatives: ${apiError.suggestions.join(', ')}`;
                }
            }

            setError({
                message: errorMessage + detailsMessage,
                onRetry: handleGenerateEnhancedNewsletter
            });
        } finally {
            setLoading(null);
            setProgress(0);
        }
    }, [selectedTopics, suggestedTopics, getAudienceKeys, selectedImageStyle, customAudiences, defaultAudiences, promptOfTheDay, selectedTone, getFlavorKeys, activePersona]);

    // Phase 19: V4 generation removed - simplified to single enhanced path
    // V4 (perAudienceNewsletterGenerator) was removed because it ignored topic.resource
    // All generation now uses enhancedGenerator.ts which properly enforces PRIMARY SOURCEs

    // Handle mismatch resolution (kept for potential future use, but simplified)
    const handleMismatchResolution = useCallback(async (_resolutions: MismatchResolution[]) => {
        console.log('[App] handleMismatchResolution - V4 removed, closing modal');
        setShowMismatchModal(false);
        setMismatchData(null);
    }, []);

    // Unified generation handler that switches between v1 (legacy) and v2/v3 (enhanced)
    // Phase 19: Simplified to single enhanced path (V4 removed)
    const handleGenerate = useCallback(async () => {
        if (useEnhancedFormat) {
            await handleGenerateEnhancedNewsletter();
        } else {
            await handleGenerateNewsletter();
        }
    }, [useEnhancedFormat, handleGenerateEnhancedNewsletter, handleGenerateNewsletter]);

    const handleSaveImageEdit = useCallback((newImageUrl: string) => {
        if (!editingImage) return;

        // Update enhanced newsletter if using enhanced format
        if (useEnhancedFormat && enhancedNewsletter) {
            const updatedSections = [...enhancedNewsletter.audienceSections];
            if (updatedSections[editingImage.index]) {
                updatedSections[editingImage.index].imageUrl = newImageUrl;
            }
            setEnhancedNewsletter({ ...enhancedNewsletter, audienceSections: updatedSections });
        } else if (newsletter) {
            // Update legacy newsletter
            const updatedSections = [...newsletter.sections];
            updatedSections[editingImage.index].imageUrl = newImageUrl;
            setNewsletter({ ...newsletter, sections: updatedSections });
        }

        closeImageEditor();
    }, [editingImage, newsletter, useEnhancedFormat, enhancedNewsletter, closeImageEditor]);


    const handleReorderSections = (newSections: NewsletterSection[]) => {
        if (newsletter) {
            setNewsletter({ ...newsletter, sections: newSections });
        }
    };

    const handleNewsletterUpdate = (field: keyof Newsletter | keyof NewsletterSection, value: string, sectionIndex?: number) => {
        setNewsletter(prev => {
            if (!prev) return null;

            const newNewsletter = JSON.parse(JSON.stringify(prev)) as Newsletter;

            if (sectionIndex !== undefined && sectionIndex >= 0) {
                if (newNewsletter.sections[sectionIndex]) {
                    (newNewsletter.sections[sectionIndex] as any)[field] = value;
                }
            } else {
                (newNewsletter as any)[field] = value;
            }

            return newNewsletter;
        });
    };

    // Handler for updating enhanced newsletter content
    const handleEnhancedNewsletterUpdate = (field: string, value: string, sectionIndex?: number) => {
        setEnhancedNewsletter(prev => {
            if (!prev) return null;

            const newNewsletter = JSON.parse(JSON.stringify(prev)) as EnhancedNewsletter;

            // Handle section-specific updates
            if (field.startsWith('section.') && sectionIndex !== undefined && sectionIndex >= 0) {
                const sectionField = field.replace('section.', '') as keyof EnhancedAudienceSection;
                if (newNewsletter.audienceSections[sectionIndex]) {
                    (newNewsletter.audienceSections[sectionIndex] as any)[sectionField] = value;
                }
            } else if (field === 'editorsNote') {
                newNewsletter.editorsNote = { message: value };
            } else if (field === 'conclusion') {
                newNewsletter.conclusion = value;
            } else {
                (newNewsletter as any)[field] = value;
            }

            return newNewsletter;
        });
    };

    // Handlers for custom audience management
    // Phase 12.0: Save to both localStorage (cache) and SQLite (persistence)
    const handleAddCustomAudience = async (audience: AudienceConfig) => {
        const newAudiences = [...customAudiences, audience];
        setCustomAudiences(newAudiences);
        localStorage.setItem('customAudiences', JSON.stringify(newAudiences));
        console.log('[App] Added custom audience:', audience.name);

        // Persist to SQLite
        try {
            await audienceApi.saveAudience({
                id: audience.id,
                name: audience.name,
                description: audience.description || '',
                generated: audience.generated,
                isCustom: true,
            });
            console.log('[App] Saved custom audience to SQLite:', audience.name);
        } catch (err) {
            console.error('[App] Failed to save audience to SQLite:', err);
            // Continue - localStorage will keep it cached
        }
    };

    const handleRemoveCustomAudience = async (audienceId: string) => {
        const newAudiences = customAudiences.filter(a => a.id !== audienceId);
        setCustomAudiences(newAudiences);
        localStorage.setItem('customAudiences', JSON.stringify(newAudiences));
        console.log('[App] Removed custom audience:', audienceId);

        // Remove from SQLite
        try {
            await audienceApi.deleteAudience(audienceId);
            console.log('[App] Deleted custom audience from SQLite:', audienceId);
        } catch (err) {
            console.error('[App] Failed to delete audience from SQLite:', err);
            // Continue - localStorage already removed it
        }
    };

    const handleImageUpload = async (sectionIndex: number, file: File) => {
        try {
            const { base64, mimeType } = await fileToBase64(file);
            const newImageUrl = `data:${mimeType};base64,${base64}`;

            // Update enhanced newsletter if using enhanced format
            if (useEnhancedFormat && enhancedNewsletter) {
                const updated = JSON.parse(JSON.stringify(enhancedNewsletter)) as EnhancedNewsletter;
                if (updated.audienceSections[sectionIndex]) {
                    updated.audienceSections[sectionIndex].imageUrl = newImageUrl;
                }
                setEnhancedNewsletter(updated);

                // Persist to SQLite
                if (updated.id) {
                    newsletterApi.updateNewsletterSections(updated.id, undefined, updated.audienceSections, 'v2')
                        .catch(err => console.warn('[ImageUpload] Failed to persist to SQLite:', err));
                }
            } else if (newsletter) {
                // Update legacy newsletter
                const updated = JSON.parse(JSON.stringify(newsletter)) as Newsletter;
                if (updated.sections[sectionIndex]) {
                    updated.sections[sectionIndex].imageUrl = newImageUrl;
                }
                setNewsletter(updated);

                // Persist to SQLite
                if (updated.id) {
                    newsletterApi.updateNewsletterSections(updated.id, updated.sections, undefined, 'v1')
                        .catch(err => console.warn('[ImageUpload] Failed to persist to SQLite:', err));
                }
            }
        } catch (error) {
            console.error("Failed to read uploaded file:", error);
            setError({ message: "Could not process the uploaded image file." });
        }
    };

    // Generate image for a section using Stability API
    const handleGenerateSectionImage = async (sectionIndex: number, imagePrompt: string) => {
        try {
            const base64Image = await generateImage(imagePrompt, selectedImageStyle);
            const newImageUrl = `data:image/png;base64,${base64Image}`;

            // Update enhanced newsletter if using enhanced format
            if (useEnhancedFormat && enhancedNewsletter) {
                const updated = JSON.parse(JSON.stringify(enhancedNewsletter)) as EnhancedNewsletter;
                if (updated.audienceSections[sectionIndex]) {
                    updated.audienceSections[sectionIndex].imageUrl = newImageUrl;
                }
                setEnhancedNewsletter(updated);

                // Persist to SQLite
                if (updated.id) {
                    newsletterApi.updateNewsletterSections(updated.id, undefined, updated.audienceSections, 'v2')
                        .catch(err => console.warn('[GenerateImage] Failed to persist to SQLite:', err));
                }
            } else if (newsletter) {
                // Update legacy newsletter
                const updated = JSON.parse(JSON.stringify(newsletter)) as Newsletter;
                if (updated.sections[sectionIndex]) {
                    updated.sections[sectionIndex].imageUrl = newImageUrl;
                }
                setNewsletter(updated);

                // Persist to SQLite
                if (updated.id) {
                    newsletterApi.updateNewsletterSections(updated.id, updated.sections, undefined, 'v1')
                        .catch(err => console.warn('[GenerateImage] Failed to persist to SQLite:', err));
                }
            }
        } catch (error) {
            console.error("Failed to generate image:", error);
            setError({ message: "Could not generate image. Please try again." });
        }
    };

    // Setup is always complete (Supabase removed)
    useEffect(() => {
        setIsSetupComplete(true);
    }, []);

    useEffect(() => {
        // Skip initialization if setup is not complete
        if (isSetupComplete === false) return;

        const storedSettings = localStorage.getItem('googleSettings');
        if (storedSettings) {
            setGoogleSettings(JSON.parse(storedSettings));
        } else {
            setGoogleSettings({
                driveFolderName: 'AI for PI Newsletters',
            });
        }

        // Load Google credentials from backend before initializing Google API client
        // Use a default admin email for initial load (credentials are shared per user in SQLite)
        const initGoogleApi = async () => {
            const defaultEmail = 'shayisa@gmail.com'; // Same as ADMIN_EMAIL

            // Check for OAuth callback parameters in URL
            const urlParams = new URLSearchParams(window.location.search);
            const oauthSuccess = urlParams.get('oauth_success');
            const oauthError = urlParams.get('oauth_error');
            const oauthEmail = urlParams.get('email');

            // Clear URL parameters after reading
            if (oauthSuccess || oauthError) {
                window.history.replaceState({}, document.title, window.location.pathname);
            }

            if (oauthError) {
                console.error('[App] OAuth error:', oauthError);
                alert(`Google sign-in failed: ${oauthError}`);
            }

            if (oauthSuccess && oauthEmail) {
                console.log('[App] OAuth successful for:', oauthEmail);
                // Tokens are already stored in backend, check auth status
                const status = await checkGoogleAuthStatus(oauthEmail);
                if (status.authenticated && status.userInfo) {
                    setAuthData({
                        access_token: 'backend-managed',
                        email: status.userInfo.email,
                        name: status.userInfo.name,
                    });
                    setIsGoogleApiInitialized(true);
                    return;
                }
            }

            // Try to load credentials from backend
            await loadGoogleCredentialsFromBackend(defaultEmail);

            // Initialize Google API client with user email
            googleApi.initClient((data) => {
                setAuthData(data);
            }, () => {
                setIsGoogleApiInitialized(true);
                console.log('onInitComplete fired!');
            }, defaultEmail);
        };

        initGoogleApi();

        const storedPresets = localStorage.getItem('newsletterPresets');
        if (storedPresets) {
            setPresets(JSON.parse(storedPresets));
        }

        // History is now loaded from SQLite via useHistory hook
    }, [isSetupComplete]);

    // Load subscriber lists from SQLite on initial auth
    useEffect(() => {
        const loadSubscriberLists = async () => {
            if (!authData?.access_token) return;
            try {
                const response = await subscriberApi.getLists();
                setSubscriberLists(response.lists);
            } catch (err) {
                console.error('Error loading subscriber lists:', err);
                setSubscriberLists([]);
            }
        };
        loadSubscriberLists();
    }, [authData?.access_token]);

    // Newsletter history is now loaded from SQLite via useHistory hook


    // Handle authentication state changes - navigate to app when authenticated + draft recovery
    useEffect(() => {
        const handleAuthAndDraftRecovery = async () => {
            if (!authData?.access_token || !authData?.email) return;

            // Check for draft recovery when user logs in
            if (activePage === 'authentication') {
                try {
                    const draft = await draftApi.getDraft(authData.email);
                    if (draft) {
                        const savedAt = new Date(draft.lastSavedAt).toLocaleString();
                        const shouldRecover = window.confirm(
                            `Found an unsaved draft from ${savedAt}.\n\nWould you like to recover it?`
                        );

                        if (shouldRecover) {
                            // Restore content based on format version
                            if (draft.content.formatVersion === 'v2' && draft.content.enhancedNewsletter) {
                                setUseEnhancedFormat(true);
                                setEnhancedNewsletter(draft.content.enhancedNewsletter as EnhancedNewsletter);
                                setNewsletter(null);
                            } else if (draft.content.newsletter) {
                                setUseEnhancedFormat(false);
                                setNewsletter({
                                    id: `draft-${Date.now()}`,
                                    subject: draft.content.newsletter.subject || '',
                                    introduction: draft.content.newsletter.introduction || '',
                                    sections: (draft.content.newsletter.sections || []).map(s => ({
                                        title: s.title,
                                        content: s.content,
                                        imagePrompt: s.imagePrompt || '',
                                    })),
                                    conclusion: draft.content.newsletter.conclusion || '',
                                });
                                setEnhancedNewsletter(null);
                            }

                            // Restore topics
                            if (draft.topics?.length > 0) {
                                setSelectedTopics(draft.topics);
                            }

                            // Restore settings
                            if (draft.settings) {
                                if (draft.settings.selectedTone) setSelectedTone(draft.settings.selectedTone);
                                if (draft.settings.selectedImageStyle) setSelectedImageStyle(draft.settings.selectedImageStyle);
                                if (draft.settings.selectedAudiences) {
                                    const audiences: Record<string, boolean> = {};
                                    draft.settings.selectedAudiences.forEach(a => { audiences[a] = true; });
                                    setSelectedAudience(audiences);
                                }
                                if (draft.settings.promptOfTheDay) {
                                    setPromptOfTheDay(draft.settings.promptOfTheDay as PromptOfTheDay);
                                }
                                // Note: persona restoration would require fetching persona by ID
                            }

                            console.log('[App] Draft recovered successfully');
                            setActivePage('generateNewsletter');
                        } else {
                            // User declined - delete the draft
                            await draftApi.deleteDraft(authData.email);
                            console.log('[App] Draft discarded by user');
                            setActivePage('discoverTopics');
                        }
                    } else {
                        // No draft, proceed normally
                        setActivePage('discoverTopics');
                    }
                } catch (err) {
                    console.warn('[App] Draft recovery check failed:', err);
                    setActivePage('discoverTopics');
                }
            }
        };

        handleAuthAndDraftRecovery();
    }, [authData?.access_token, authData?.email]);

    // Default and custom audiences loading now handled by NewsletterContext

    // Auto-save calendar entry settings when editing from calendar
    useEffect(() => {
        if (!pendingCalendarEntryId) return;

        const saveTimer = setTimeout(async () => {
            try {
                await calendarApi.updateEntry(pendingCalendarEntryId, {
                    settings: {
                        selectedAudience,
                        selectedTone,
                        selectedFlavors,
                        selectedImageStyle,
                        personaId: activePersona?.id || null,
                    },
                    topics: selectedTopics,
                });
                console.log(`[App] Auto-saved settings to calendar entry: ${pendingCalendarEntryId}`);
            } catch (err) {
                console.warn('[App] Failed to auto-save calendar settings:', err);
            }
        }, 1000); // Debounce 1 second

        return () => clearTimeout(saveTimer);
    }, [pendingCalendarEntryId, selectedAudience, selectedTone, selectedFlavors, selectedImageStyle, activePersona?.id, selectedTopics]);

    // Draft auto-save effect - saves work in progress every 2 seconds
    useEffect(() => {
        // Skip if: no newsletter content, loading, or no auth
        const hasContent = newsletter || enhancedNewsletter;
        if (!hasContent || loading || !authData?.email) return;

        const saveTimer = setTimeout(async () => {
            try {
                const content: draftApi.DraftContent = {
                    formatVersion: useEnhancedFormat ? 'v2' : 'v1',
                    newsletter: newsletter ? {
                        subject: newsletter.subject,
                        introduction: newsletter.introduction,
                        sections: newsletter.sections?.map(s => ({
                            title: s.title,
                            content: s.content,
                            imagePrompt: s.imagePrompt,
                        })),
                        conclusion: newsletter.conclusion,
                    } : undefined,
                    enhancedNewsletter: useEnhancedFormat ? enhancedNewsletter : undefined,
                };

                const settings: draftApi.DraftSettings = {
                    selectedTone,
                    selectedImageStyle,
                    selectedAudiences: Object.keys(selectedAudience).filter(k => selectedAudience[k]),
                    personaId: activePersona?.id || null,
                    promptOfTheDay: promptOfTheDay || undefined,
                };

                await draftApi.saveDraft(authData.email, content, selectedTopics, settings);
                console.log('[App] Draft auto-saved');
            } catch (err) {
                console.warn('[App] Failed to auto-save draft:', err);
                // Non-blocking - don't interrupt user
            }
        }, 2000); // 2-second debounce

        return () => clearTimeout(saveTimer);
    }, [
        newsletter,
        enhancedNewsletter,
        useEnhancedFormat,
        selectedTopics,
        selectedTone,
        selectedImageStyle,
        selectedAudience,
        activePersona?.id,
        promptOfTheDay,
        loading,
        authData?.email,
    ]);

    const handleWorkflowAction = async (action: 'drive' | 'gmail') => {
        // Support both legacy and enhanced newsletters
        const activeNewsletter = useEnhancedFormat && enhancedNewsletter
            ? convertEnhancedToLegacy(enhancedNewsletter)
            : newsletter;
        const activeId = useEnhancedFormat && enhancedNewsletter
            ? enhancedNewsletter.id
            : newsletter?.id;

        if (!activeNewsletter || !googleSettings || !authData?.access_token) return;
        setWorkflowStatus({ message: `Executing ${action} action...`, type: 'success' });

        try {
            let resultMessage = '';
            switch (action) {
                case 'drive':
                    const driveUserEmail = authData?.email || 'shayisa@gmail.com';
                    // Pass original enhanced newsletter to preserve v2 data in embedded JSON
                    const originalEnhanced = useEnhancedFormat && enhancedNewsletter ? enhancedNewsletter : undefined;
                    resultMessage = await googleApi.saveToDrive(driveUserEmail, activeNewsletter, selectedTopics, originalEnhanced);
                    setWorkflowActions({ ...workflowActions, savedToDrive: true });
                    // Log to SQLite
                    if (activeId) {
                        await newsletterApi.logAction(activeId, 'saved_to_drive', {
                            folder: googleSettings.driveFolderName
                        });
                    }
                    break;
                case 'gmail':
                    // Phase 18: Open SendEmailModal to select recipients
                    setShowSendEmailModal(true);
                    return; // Exit early - modal handles the actual send
            }

            // After successful save/send, delete the draft (Issue 1 fix)
            if (authData?.email) {
                try {
                    await draftApi.deleteDraft(authData.email);
                    console.log(`[App] Draft cleared after successful ${action} action`);
                } catch (draftErr) {
                    console.warn(`[App] Failed to clear draft after ${action}:`, draftErr);
                }
            }

            setWorkflowStatus({ message: resultMessage, type: 'success' });
        } catch (error) {
            console.error(`Error during ${action} action:`, error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            setWorkflowStatus({ message: `Error during ${action} action: ${errorMessage}`, type: 'error' });
        }
    };

    /**
     * Phase 18: Handle send email with selected recipients from modal
     */
    const handleSendWithRecipients = async (recipients: SendEmailRecipients): Promise<void> => {
        // Get active newsletter
        const activeNewsletter = useEnhancedFormat && enhancedNewsletter
            ? convertEnhancedToLegacy(enhancedNewsletter)
            : newsletter;
        const activeId = useEnhancedFormat && enhancedNewsletter
            ? enhancedNewsletter.id
            : newsletter?.id;

        if (!activeNewsletter || !authData?.access_token) {
            throw new Error('No newsletter or authentication available');
        }

        setWorkflowStatus({ message: 'Sending newsletter...', type: 'success' });

        try {
            // Use original enhancedNewsletter for v2 format to preserve all rich content
            const gmailUserEmail = authData?.email || 'shayisa@gmail.com';
            const newsletterForEmail = useEnhancedFormat && enhancedNewsletter
                ? enhancedNewsletter
                : activeNewsletter;

            const emailResult = await googleApi.sendEmail(
                gmailUserEmail,
                newsletterForEmail,
                selectedTopics,
                recipients.emails,
                recipients.listNames
            );

            setWorkflowActions({ ...workflowActions, sentEmail: true });

            // Log to SQLite with enhanced details (Phase 18)
            if (activeId) {
                await newsletterApi.logAction(activeId, 'sent_email', {
                    sent_to_lists: recipients.listIds,
                    list_names: recipients.listNames,
                    recipient_emails: recipients.emails,
                    recipient_count: recipients.totalCount,
                    topics: selectedTopics,
                    subject: activeNewsletter.subject
                });
            }

            // After successful send, delete the draft
            if (authData?.email) {
                try {
                    await draftApi.deleteDraft(authData.email);
                    console.log('[App] Draft cleared after successful email send');
                } catch (draftErr) {
                    console.warn('[App] Failed to clear draft after email send:', draftErr);
                }
            }

            setWorkflowStatus({ message: emailResult.message, type: 'success' });
        } catch (error) {
            console.error('Error sending email:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            setWorkflowStatus({ message: `Error sending email: ${errorMessage}`, type: 'error' });
            throw error; // Re-throw so modal can show error
        }
    };

    const hasSelectedAudience = getAudienceKeys().length > 0;
    console.log('isGoogleApiInitialized:', isGoogleApiInitialized);

    // Show loading while checking setup status
    if (isSetupComplete === null) {
        return (
            <div className="min-h-screen bg-pearl text-ink font-sans flex items-center justify-center">
                <Spinner />
            </div>
        );
    }

    // If not authenticated, show the authentication page
    if (!authData?.access_token) {
        return (
            <div className="min-h-screen bg-pearl text-ink font-sans">
                <AuthenticationPage
                    onSignIn={handleGoogleSignIn}
                    isGoogleApiInitialized={isGoogleApiInitialized}
                    isLoading={false}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-pearl text-ink font-sans flex flex-col">
            <Header onSettingsClick={() => setIsSettingsOpen(true)} onSignOut={handleGoogleSignOut} authData={authData} />
            <div className="flex flex-grow">
                <SideNavigation activePage={activePage} setActivePage={setActivePage} />
                <main className="flex-grow max-w-screen-xl mx-auto px-6 lg:px-12 py-8 overflow-y-auto">

                    {/* Phase 6g.6: DiscoverTopicsPage now uses contexts/hooks (22 props → 3) */}
                    {activePage === 'discoverTopics' && (
                        <DiscoverTopicsPage
                            handleGenerateSuggestions={handleGenerateSuggestions}
                            fetchTrendingContent={fetchTrendingContent}
                            onLoadFromArchive={handleLoadFromArchive}
                        />
                    )}

                    {/* Phase 6g.4: ToneAndVisualsPage now uses contexts directly (21 props → 0) */}
                    {activePage === 'toneAndVisuals' && (
                        <ToneAndVisualsPage />
                    )}
                    
                    {/* Phase 6g.7: GenerateNewsletterPage now uses contexts/hooks (49 props → 17) */}
                    {activePage === 'generateNewsletter' && (
                        <GenerateNewsletterPage
                            // Newsletter editing handlers
                            onEditImage={(index, src, prompt) => openImageEditor(index, src, 'image/png', prompt)}
                            onImageUpload={handleImageUpload}
                            onReorderSections={handleReorderSections}
                            onUpdate={handleNewsletterUpdate}
                            onEnhancedUpdate={handleEnhancedNewsletterUpdate}
                            // Generation and workflow
                            handleGenerateNewsletter={handleGenerate}
                            onSaveToDrive={googleSettings && authData?.access_token ? () => handleWorkflowAction('drive') : undefined}
                            onSendViaGmail={authData?.access_token ? () => handleWorkflowAction('gmail') : undefined}
                            onGenerateImage={handleGenerateSectionImage}
                            // Preset handlers
                            onSavePreset={handleSavePreset}
                            onLoadPreset={handleLoadPreset}
                            onSyncToCloud={handleSyncPresetsToCloud}
                            onLoadFromCloud={handleLoadPresetsFromCloud}
                            // Prompt library
                            onSavePromptToLibrary={handleSavePromptToLibrary}
                            // Templates
                            selectedTemplateId={selectedTemplateId}
                            onSelectTemplate={handleSelectTemplate}
                            onSaveAsTemplate={handleSaveAsTemplate}
                            // Calendar entry tracking (Issue 2 fix)
                            calendarEntryTitle={pendingCalendarEntryTitle}
                            // Phase 16: Calendar entry linking
                            calendarEntryId={pendingCalendarEntryId}
                            onOpenCalendarPicker={() => setShowCalendarPicker(true)}
                        />
                    )}

                    {/* Phase 6g.5: HistoryContentPage now uses contexts/hooks (12 props → 4) */}
                    {activePage === 'history' && (
                        <HistoryContentPage
                            onLoad={handleLoadFromHistory}
                            onClear={handleClearHistory}
                            onLoadPrompt={handleLoadSavedPrompt}
                            onImportFromDrive={handleLoadFromDrive}
                        />
                    )}

                    {activePage === 'subscriberManagement' && (
                        <SubscriberManagementPage
                            onListsChanged={refreshSubscriberLists}
                        />
                    )}

                    {activePage === 'logs' && (
                        <LogsPage />
                    )}

                    {activePage === 'contentCalendar' && (
                        <ContentCalendarPage
                            onStartGeneration={handleStartFromCalendarEntry}
                            onViewNewsletter={handleViewLinkedNewsletter}
                            onGenerateNew={handleGenerateNewFromCalendar}
                        />
                    )}

                    {activePage === 'knowledgeBase' && (
                        <KnowledgeBasePage />
                    )}

                    {activePage === 'sentHistory' && (
                        <SentHistoryPage />
                    )}

                </main>

                {editingImage && (
                    <ImageEditorModal
                        isOpen={!!editingImage}
                        onClose={closeImageEditor}
                        imageSrc={editingImage.src}
                        imageMimeType={editingImage.mimeType}
                        originalPrompt={editingImage.prompt}
                        onSave={handleSaveImageEdit}
                    />
                )}
                
                {/* Settings modal - API keys and Google connection */}
                {isSettingsOpen && (
                    <SettingsModal
                        isOpen={isSettingsOpen}
                        onClose={() => setIsSettingsOpen(false)}
                        onSave={handleSaveSettings}
                        initialSettings={googleSettings}
                        authData={authData}
                        onSignIn={() => googleApi.signIn(authData?.email || 'shayisa@gmail.com')}
                        onSignOut={() => googleApi.signOut(authData?.email || 'shayisa@gmail.com')}
                        isGoogleApiInitialized={isGoogleApiInitialized}
                        onGoogleCredentialsSaved={async () => {
                            // Re-initialize Google API client with new credentials from backend
                            const userEmail = authData?.email || 'shayisa@gmail.com';
                            console.log('[App] Google credentials saved, re-initializing Google API...');
                            await loadGoogleCredentialsFromBackend(userEmail);
                            googleApi.initClient((data) => {
                                setAuthData(data);
                            }, () => {
                                setIsGoogleApiInitialized(true);
                                console.log('[App] Google API re-initialized with new credentials');
                            }, userEmail);
                        }}
                    />
                )}

                {/* Audience Config Editor modal */}
                <AudienceConfigEditor
                    isOpen={isAudienceEditorOpen}
                    onClose={closeAudienceEditor}
                    defaultAudiences={defaultAudiences}
                    customAudiences={customAudiences}
                    onAddAudience={handleAddCustomAudience}
                    onRemoveAudience={handleRemoveCustomAudience}
                />

                {/* Persona Editor modal */}
                <PersonaEditor
                    isOpen={isPersonaEditorOpen}
                    onClose={closePersonaEditor}
                    onSave={async (data) => {
                        if (editingPersona) {
                            await updatePersona(editingPersona.id, data);
                        } else {
                            await createPersona(data);
                        }
                    }}
                    editingPersona={editingPersona}
                />

                {/* Phase 16: Calendar Entry Picker modal (for explicit linking from Generate page) */}
                <CalendarEntryPickerModal
                    isOpen={showCalendarPicker}
                    onClose={() => setShowCalendarPicker(false)}
                    onSelect={(entryId, entryTitle) => {
                        handleExplicitCalendarLink(entryId, entryTitle);
                        setShowCalendarPicker(false);
                    }}
                    currentEntryId={pendingCalendarEntryId}
                />

                {/* Phase 16: Topic-Audience Mismatch Modal */}
                {showMismatchModal && mismatchData && (
                    <TopicMismatchModal
                        isOpen={showMismatchModal}
                        onClose={() => {
                            setShowMismatchModal(false);
                            setMismatchData(null);
                        }}
                        onResolve={handleMismatchResolution}
                        mismatches={mismatchData.mismatches}
                        selectedAudiences={mismatchData.selectedAudiences}
                    />
                )}

                {/* Phase 18: Send Email Modal with recipient selection */}
                <SendEmailModal
                    isOpen={showSendEmailModal}
                    onClose={() => setShowSendEmailModal(false)}
                    newsletterSubject={
                        (useEnhancedFormat && enhancedNewsletter?.subject)
                            || newsletter?.subject
                            || 'Untitled Newsletter'
                    }
                    onConfirm={handleSendWithRecipients}
                />
            </div>
        </div>
    );
};

/**
 * App - Root component with context providers
 *
 * Phase 6: Provider hierarchy wraps AppContent.
 * Provider nesting order: UIProvider → AuthProvider → [future providers]
 */
const App: React.FC = () => (
    <AppProviders>
        <AppContent />
    </AppProviders>
);

export default App;