import React, { useState, useCallback, useEffect } from 'react';
import type { Newsletter, NewsletterSection, TrendingTopic, GoogleSettings, GapiAuthData, Preset, EnhancedHistoryItem, PromptOfTheDay, Subscriber, SubscriberList, EnhancedNewsletter, EnhancedAudienceSection, AudienceConfig, WriterPersona } from './types';
import { AppProviders, useNewsletter, useTopics, useAudienceSelection, useTrendingContent, useNavigation, useError, useModals, useAuth, useSettings } from './contexts';
import { Header } from './components/Header';
import { NewsletterPreview } from './components/NewsletterPreview';
import { ImageEditorModal } from './components/ImageEditorModal';
import { Spinner } from './components/Spinner';
import { SparklesIcon, SearchIcon, LightbulbIcon, PlusIcon, XIcon, DriveIcon, SheetIcon, SendIcon, RefreshIcon, TypeIcon, ImageIcon, HistoryIcon, SettingsIcon, CodeIcon } from './components/IconComponents'; // Added new icons
import { generateNewsletterContent, generateImage, generateTopicSuggestions, generateTrendingTopics, generateTrendingTopicsWithSources, generateCompellingTrendingContent, savePresetsToCloud, loadPresetsFromCloud } from './services/claudeService';
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
import { ContentCalendarPage } from './pages/ContentCalendarPage'; // Content calendar
import { useHistory } from './hooks/useHistory';
import { usePrompts } from './hooks/usePrompts';
import { usePersonas } from './hooks/usePersonas';
import { useStyleThumbnails } from './hooks/useStyleThumbnails';
import { useTemplates } from './hooks/useTemplates';
import * as draftApi from './services/draftClientService';
import { PersonaEditor } from './components/PersonaEditor';
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

const toneOptions: Record<string, { label: string; description: string; sampleOutput: string }> = {
    professional: { label: 'Professional', description: 'Formal, objective, and authoritative.', sampleOutput: 'Our comprehensive analysis indicates a significant positive trend in Q3 metrics, driven by strategic resource allocation.' },
    casual: { label: 'Casual', description: 'Friendly, relaxed, and conversational.', sampleOutput: 'Hey team! Just wanted to share some awesome news about our latest project—it’s really coming together!' },
    witty: { label: 'Witty', description: 'Clever, humorous, and engaging.', sampleOutput: 'Why did the AI break up with the calculator? Because it just couldn’t count on it anymore!' },
    enthusiastic: { label: 'Enthusiastic', description: 'Excited, passionate, and energetic.', sampleOutput: 'Get ready to be absolutely blown away by the incredible breakthroughs in AI this week!' },
    informative: { label: 'Informative', description: 'Direct, clear, and educational.', sampleOutput: 'The process involves three distinct phases: data acquisition, model training, and iterative validation.' },
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

export type ActivePage = 'authentication' | 'discoverTopics' | 'toneAndVisuals' | 'generateNewsletter' | 'history' | 'subscriberManagement' | 'logs' | 'contentCalendar';


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
    } = useTopics();

    // Audience selection from TopicsContext (Phase 6g.9 Batch 1)
    const {
        selectedAudience,
        setSelectedAudience,
        handleAudienceChange,
        getAudienceKeys,
    } = useAudienceSelection();

    // Trending content from TopicsContext (Phase 6g.9 Batch 1 - combined with Batch 4)
    const {
        trendingContent,
        setTrendingContent,
        compellingContent,
        setCompellingContent,
        trendingSources,
        setTrendingSources,
        isFetchingTrending,
        setIsFetchingTrending,
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

    // Template selection state
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

    // NOTE: Persona editor modal state moved to UIContext (Phase 6g.9 Batch 5)
    // isPersonaEditorOpen, editingPersona are now imported from useModals() above

    // Calendar entry linking state
    const [pendingCalendarEntryId, setPendingCalendarEntryId] = useState<string | null>(null);
    const [pendingCalendarEntryTitle, setPendingCalendarEntryTitle] = useState<string | null>(null);

    // promptOfTheDay now comes from useNewsletter context (removed duplicate useState)

    // Subscriber management state
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [subscriberLists, setSubscriberLists] = useState<SubscriberList[]>([]);
    const [selectedEmailLists, setSelectedEmailLists] = useState<string[]>([]);

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
    const handleStartFromCalendarEntry = useCallback((entry: CalendarEntry) => {
        setPendingCalendarEntryId(entry.id);
        setPendingCalendarEntryTitle(entry.title);  // Store title for display in Generate page
        setSelectedTopics(entry.topics);

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
            // Fetch trending sources for the Inspiration Sources panel
            console.log("Fetching trending sources...");
            try {
                const allSources = await trendingDataService.fetchAllTrendingSources();
                fetchedSources = trendingDataService.filterSourcesByAudience(allSources, audience);
                setTrendingSources(fetchedSources);
                console.log(`Fetched ${fetchedSources.length} trending sources`);
            } catch (err) {
                console.warn("Could not fetch trending sources:", err);
            }

            // Generate COMPELLING, actionable trending content with structured insights
            console.log("Generating compelling trending content with actionable insights...");
            const result = await generateCompellingTrendingContent(audience);
            const rawJsonString = result.text;
            console.log("Raw Compelling Content JSON response:", rawJsonString);
            const cleanedJsonString = extractStrictJson(rawJsonString);
            console.log("Cleaned Compelling Content JSON string for parsing:", cleanedJsonString);

            const compellingData = JSON.parse(cleanedJsonString);
            setCompellingContent(compellingData);

            // Extract titles from actionable capabilities for the old "Add to Topics" feature
            if (compellingData.actionableCapabilities && Array.isArray(compellingData.actionableCapabilities)) {
                const titles = compellingData.actionableCapabilities.map((item: any) => item.title);
                setTrendingContent(titles.map((title: string) => ({ title, summary: "Actionable AI capability from trending insights" })));
            }

            // Auto-save archive after successful fetch
            try {
                const archiveContent = {
                    trendingTopics: compellingData.actionableCapabilities?.map((item: any) => ({
                        title: item.title,
                        summary: item.description || item.whatItIs || ""
                    })) || [],
                    compellingContent: compellingData,
                    trendingSources: fetchedSources
                };
                const savedArchive = await archiveClientService.saveArchive(archiveContent, audience);
                console.log(`[Archive] Auto-saved: ${savedArchive.name} (${savedArchive.id})`);
            } catch (archiveError) {
                console.warn("[Archive] Could not auto-save:", archiveError);
                // Don't show error to user - archive is a background feature
            }
        } catch (e) {
            console.error("Failed to fetch compelling trending content:", e);
            const errorMessage = e instanceof SyntaxError
                ? "Could not parse trending insights. The model returned an unexpected format."
                : "Could not load trending insights due to a network error.";
            setError({ message: errorMessage, onRetry: fetchTrendingContent });
        } finally {
            setIsFetchingTrending(false);
        }
    }, [getAudienceKeys]);

    // Load content from an archive (skips API calls, saves tokens)
    const handleLoadFromArchive = useCallback((content: archiveClientService.ArchiveContent, audience: string[]) => {
        console.log('[Archive] Loading from archive...');

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
        } else if (content.compellingContent?.actionableCapabilities) {
            const titles = content.compellingContent.actionableCapabilities.map((item: any) => item.title);
            setTrendingContent(titles.map((title: string) => ({
                title,
                summary: "Actionable AI capability from archived insights"
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
            // Fetch trending sources if not already available
            let sources = trendingSources;
            if (sources.length === 0) {
                console.log("Fetching trending sources for suggestions...");
                try {
                    const allSources = await trendingDataService.fetchAllTrendingSources();
                    const filteredSources = trendingDataService.filterSourcesByAudience(allSources, audience);
                    sources = filteredSources;
                    setTrendingSources(filteredSources);
                } catch (err) {
                    console.warn("Could not fetch trending sources, will generate suggestions without real data:", err);
                }
            }

            // Format sources for the API
            const sourceSummary = sources.length > 0
                ? sources.map(s => `- "${s.title}" from ${s.publication} (${s.category}): ${s.url}`).join('\n')
                : undefined;

            console.log("Generating suggestions based on sources...");
            const result = await generateTopicSuggestions(audience, sourceSummary);
            const rawJsonString = result.text;
            console.log("Raw Topic Suggestions JSON response:", rawJsonString);
            const cleanedJsonString = extractStrictJson(rawJsonString);
            console.log("Cleaned Topic Suggestions JSON string for parsing:", cleanedJsonString);

            const topics = JSON.parse(cleanedJsonString);
            // Merge with existing suggestions, removing duplicates
            setSuggestedTopics([...new Set([...suggestedTopics, ...topics])]);
        } catch (e) {
            console.error("Failed to generate topic suggestions:", e);
            const errorMessage = e instanceof SyntaxError
                ? "Failed to parse topic suggestions. The AI returned an invalid format."
                : "Failed to generate topic suggestions due to a network error.";
            setError({ message: errorMessage, onRetry: handleGenerateSuggestions });
        } finally {
            setIsGeneratingTopics(false);
        }
    }, [getAudienceKeys, trendingSources, suggestedTopics, setSuggestedTopics, setIsGeneratingTopics, setTrendingSources]);

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

            const result = await enhancedNewsletterService.generateEnhancedNewsletter({
                topics: selectedTopics,
                audiences: selectedAudienceConfigs,
                imageStyle: selectedImageStyle,
                promptOfTheDay: promptOfTheDay, // Include user-supplied prompt if set
                personaId: activePersona?.id,
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
            const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';
            setError({ message: errorMessage, onRetry: handleGenerateEnhancedNewsletter });
        } finally {
            setLoading(null);
            setProgress(0);
        }
    }, [selectedTopics, getAudienceKeys, selectedImageStyle, customAudiences, defaultAudiences, promptOfTheDay]);

    // Unified generation handler that switches between v1 and v2
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
                    // Fetch active subscribers from SQLite
                    const subscriberResponse = await subscriberApi.getSubscribers({ status: 'active' });
                    let subscribers = subscriberResponse.subscribers;

                    // Filter by selected lists if any are selected
                    let listNames: string[] = [];
                    if (selectedEmailLists.length > 0) {
                        subscribers = subscribers.filter(sub => {
                            const subLists = sub.lists ? sub.lists.split(',').map(l => l.trim()) : [];
                            return subLists.some(listId => selectedEmailLists.includes(listId));
                        });

                        // Get list names for logging
                        const allLists = await subscriberApi.getLists();
                        listNames = allLists.lists
                            .filter(l => selectedEmailLists.includes(l.id))
                            .map(l => l.name);
                    }

                    const subscriberEmails = subscribers.map(sub => sub.email);

                    if (subscriberEmails.length === 0) {
                        throw new Error("No active subscribers found. Add subscribers in the Subscriber Management page.");
                    }

                    // Send email using refactored sendEmail (now takes email array directly)
                    const gmailUserEmail = authData?.email || 'shayisa@gmail.com';
                    const emailResult = await googleApi.sendEmail(
                        gmailUserEmail,
                        activeNewsletter,
                        selectedTopics,
                        subscriberEmails,
                        listNames
                    );
                    resultMessage = emailResult.message;
                    setWorkflowActions({ ...workflowActions, sentEmail: true });

                    // Log to SQLite
                    if (activeId) {
                        await newsletterApi.logAction(activeId, 'sent_email', {
                            sent_to_lists: selectedEmailLists,
                            list_names: listNames,
                            recipient_count: emailResult.sentCount || 0
                        });
                    }
                    break;
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
                        />
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