import React, { useState, useCallback, useEffect } from 'react';
import type { Newsletter, NewsletterSection, TrendingTopic, GoogleSettings, GapiAuthData, Preset, HistoryItem, PromptOfTheDay, Subscriber, SubscriberList } from './types';
import { Header } from './components/Header';
import { NewsletterPreview } from './components/NewsletterPreview';
import { ImageEditorModal } from './components/ImageEditorModal';
import { Spinner } from './components/Spinner';
import { SparklesIcon, SearchIcon, LightbulbIcon, PlusIcon, XIcon, DriveIcon, SheetIcon, SendIcon, RefreshIcon, TypeIcon, ImageIcon, HistoryIcon, SettingsIcon, CodeIcon } from './components/IconComponents'; // Added new icons
import { generateNewsletterContent, generateImage, generateTopicSuggestions, generateTrendingTopics, generateTrendingTopicsWithSources, generateCompellingTrendingContent, savePresetsToCloud, loadPresetsFromCloud } from './services/claudeService';
import { InspirationSources } from './components/InspirationSources';
import * as trendingDataService from './services/trendingDataService';
import type { TrendingSource } from './services/trendingDataService';
import { SettingsModal } from './components/SettingsModal'; // SettingsModal is now only for initial sign-in/out feedback.
import * as googleApi from './services/googleApiService';
import { getIdToken } from './services/googleApiService';
import { supabase, IS_SUPABASE_CONFIGURED } from './lib/supabase';
import { fileToBase64 } from './utils/fileUtils';
import { PresetsManager } from './components/PresetsManager';
import { HistoryPanel } from './components/HistoryPanel';
import { PromptOfTheDayEditor } from './components/PromptOfTheDayEditor';
import { extractStrictJson } from './utils/stringUtils';
import { SideNavigation } from './components/SideNavigation'; // New
import { DiscoverTopicsPage } from './pages/DiscoverTopicsPage'; // New
import { DefineTonePage } from './pages/DefineTonePage'; // New
import { ImageStylePage } from './pages/ImageStylePage'; // New
import { GenerateNewsletterPage } from './pages/GenerateNewsletterPage'; // New
import { HistoryContentPage } from './pages/HistoryContentPage'; // New
import { SubscriberManagementPage } from './pages/SubscriberManagementPage'; // New
import { AuthenticationPage } from './pages/AuthenticationPage'; // New


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

export type ActivePage = 'authentication' | 'discoverTopics' | 'defineTone' | 'imageStyle' | 'generateNewsletter' | 'history' | 'subscriberManagement';


type ErrorState = {
    message: string;
    onRetry?: () => void;
};

const App: React.FC = () => {
    const [activePage, setActivePage] = useState<ActivePage>('authentication'); // Initial page - authentication first
    const [selectedTopics, setSelectedTopics] = useState<string[]>(['Latest AI tools for data visualization']);
    const [customTopic, setCustomTopic] = useState<string>('');
    const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
    const [loading, setLoading] = useState<string | null>(null);
    const [progress, setProgress] = useState<number>(0);
    const [error, setError] = useState<ErrorState | null>(null);
    const [editingImage, setEditingImage] = useState<{ index: number; src: string; mimeType: string; prompt: string; } | null>(null);

    const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
    const [trendingContent, setTrendingContent] = useState<TrendingTopic[] | null>(null);
    const [compellingContent, setCompellingContent] = useState<any>(null); // New: structured actionable insights
    const [trendingSources, setTrendingSources] = useState<TrendingSource[]>([]);
    const [isGeneratingTopics, setIsGeneratingTopics] = useState<boolean>(false);
    const [isFetchingTrending, setIsFetchingTrending] = useState<boolean>(false);

    const [selectedAudience, setSelectedAudience] = useState<Record<string, boolean>>({
        academics: true,
        business: true,
        analysts: true,
    });
    
    const [selectedTone, setSelectedTone] = useState<string>('professional');
    const [selectedFlavors, setSelectedFlavors] = useState<Record<string, boolean>>({});
    const [selectedImageStyle, setSelectedImageStyle] = useState<string>('photorealistic');

    const [googleSettings, setGoogleSettings] = useState<GoogleSettings | null>(null);
    const [authData, setAuthData] = useState<GapiAuthData | null>(null);
    const [workflowStatus, setWorkflowStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isGoogleApiInitialized, setIsGoogleApiInitialized] = useState(false);
    const [workflowActions, setWorkflowActions] = useState<{ savedToDrive: boolean; sentEmail: boolean }>({ savedToDrive: false, sentEmail: false });

    const [isSettingsOpen, setIsSettingsOpen] = useState(false); // This will now control the modal for initial sign-in/out feedback

    const [presets, setPresets] = useState<Preset[]>([]);
    const [history, setHistory] = useState<HistoryItem[]>([]);

    const [promptOfTheDay, setPromptOfTheDay] = useState<PromptOfTheDay | null>(null);

    // Subscriber management state
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [subscriberLists, setSubscriberLists] = useState<SubscriberList[]>([]);
    const [selectedEmailLists, setSelectedEmailLists] = useState<string[]>([]);

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
        setActivePage('generateNewsletter'); // Navigate to generate page after loading preset
    };

    const handleDeletePreset = (name: string) => {
        const updatedPresets = presets.filter(p => p.name !== name);
        setPresets(updatedPresets);
        localStorage.setItem('newsletterPresets', JSON.stringify(updatedPresets));
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
            await googleApi.signIn();
            // After Google sign-in, Supabase auth will be handled by useEffect watching authData
        } catch (error) {
            console.error('Error signing in:', error);
        }
    };

    const handleGoogleSignOut = async () => {
        try {
            googleApi.signOut();

            // Also sign out from Supabase
            if (IS_SUPABASE_CONFIGURED) {
                try {
                    await supabase.auth.signOut();
                    console.log("Signed out from Supabase");
                } catch (error) {
                    console.error('Error signing out from Supabase:', error);
                }
            }

            setAuthData(null);
            setActivePage('authentication');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const handleAddToHistory = (generatedNewsletter: Newsletter, topics: string[]) => {
        const newItem: HistoryItem = {
            id: Date.now(),
            date: new Date().toLocaleString(),
            subject: generatedNewsletter.subject,
            newsletter: generatedNewsletter,
            topics: topics,
        };
        const updatedHistory = [newItem, ...history].slice(0, 50); // Keep last 50
        setHistory(updatedHistory);
        localStorage.setItem('generationHistory', JSON.stringify(updatedHistory));
    };

    const handleLoadFromHistory = (item: HistoryItem) => {
        setNewsletter(item.newsletter);
        setSelectedTopics(item.topics);
        setPromptOfTheDay(item.newsletter.promptOfTheDay || null); // Load prompt of the day from history
        setActivePage('generateNewsletter'); // Navigate to generate page after loading from history
        // Scroll to the preview
        const previewElement = document.getElementById('newsletter-preview');
        if (previewElement) {
            previewElement.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleLoadFromDrive = (loadedNewsletter: Newsletter, topics: string[]) => {
        setNewsletter(loadedNewsletter);
        setSelectedTopics(topics);
        setPromptOfTheDay(loadedNewsletter.promptOfTheDay || null);
        setActivePage('generateNewsletter'); // Navigate to generate page after loading from Drive
        // Scroll to the preview
        setTimeout(() => {
            const previewElement = document.getElementById('newsletter-preview');
            if (previewElement) {
                previewElement.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);
    };

    const handleClearHistory = () => {
        setHistory([]);
        localStorage.removeItem('generationHistory');
    };

    const getAudienceKeys = useCallback(() => Object.keys(selectedAudience).filter(key => selectedAudience[key]), [selectedAudience]);
    const getFlavorKeys = useCallback(() => Object.keys(selectedFlavors).filter(key => selectedFlavors[key]), [selectedFlavors]);

    // Refresh subscriber lists from Google Sheets
    const refreshSubscriberLists = useCallback(async () => {
        if (!googleSettings || !authData?.access_token) return;
        try {
            const lists = await googleApi.readAllLists(googleSettings.groupListSheetName || 'Group List');
            setSubscriberLists(lists);
        } catch (err) {
            console.error('Error refreshing subscriber lists:', err);
        }
    }, [googleSettings, authData]);

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

        try {
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



    const handleAudienceChange = (key: string) => {
        setSelectedAudience(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleFlavorChange = (key: string) => {
        setSelectedFlavors(prev => ({ ...prev, [key]: !prev[key] }));
    };
    
    const handleAddTopic = () => {
        if (customTopic.trim() && !selectedTopics.includes(customTopic.trim())) {
            setSelectedTopics(prev => [...prev, customTopic.trim()]);
            setCustomTopic('');
        }
    };

    const handleRemoveTopic = (indexToRemove: number) => {
        setSelectedTopics(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const handleSelectSuggestedTopic = (suggestion: string) => {
        if (!selectedTopics.includes(suggestion)) {
            setSelectedTopics(prev => [...prev, suggestion]);
        }
    };

    const handleAddTrendingTopic = (topic: string) => {
        if (topic.trim() && !selectedTopics.includes(topic.trim())) {
            setSelectedTopics(prev => [...prev, topic.trim()]);
        }
    };

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
            setSuggestedTopics(prev => [...new Set([...prev, ...topics])]);
        } catch (e) {
            console.error("Failed to generate topic suggestions:", e);
            const errorMessage = e instanceof SyntaxError
                ? "Failed to parse topic suggestions. The AI returned an invalid format."
                : "Failed to generate topic suggestions due to a network error.";
            setError({ message: errorMessage, onRetry: handleGenerateSuggestions });
        } finally {
            setIsGeneratingTopics(false);
        }
    }, [getAudienceKeys, trendingSources]);

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
        setWorkflowStatus(null);
        setWorkflowActions({ savedToDrive: false, sentEmail: false });

        try {
            const result = await generateNewsletterContent(selectedTopics, audience, selectedTone, flavors, selectedImageStyle);

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

                // Auto-save to Drive after newsletter approval
                if (googleSettings && authData?.access_token) {
                    try {
                        setLoading("Auto-saving to Google Drive...");
                        setProgress(90);
                        await googleApi.saveToDrive(finalNewsletter, googleSettings.driveFolderName, selectedTopics);
                        // Update tracking state
                        setWorkflowActions({ ...workflowActions, savedToDrive: true });
                        // Log to sheet with saved=true flag
                        await googleApi.logToSheet(finalNewsletter, selectedTopics, googleSettings.logSheetName, true, false);
                        setWorkflowStatus({
                            message: `Newsletter auto-saved to Drive and logged to sheet!`,
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

    const handleSaveImageEdit = useCallback((newImageUrl: string) => {
        if (!editingImage || !newsletter) return;

        const updatedSections = [...newsletter.sections];
        updatedSections[editingImage.index].imageUrl = newImageUrl;
        setNewsletter({ ...newsletter, sections: updatedSections });

        setEditingImage(null);
    }, [editingImage, newsletter]);


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

    const handleImageUpload = async (sectionIndex: number, file: File) => {
        try {
            const { base64, mimeType } = await fileToBase64(file);
            const newImageUrl = `data:${mimeType};base64,${base64}`;
            
            setNewsletter(prev => {
                if (!prev) return null;
                const newNewsletter = JSON.parse(JSON.stringify(prev)) as Newsletter;
                if (newNewsletter.sections[sectionIndex]) {
                    newNewsletter.sections[sectionIndex].imageUrl = newImageUrl;
                }
                return newNewsletter;
            });
        } catch (error) {
            console.error("Failed to read uploaded file:", error);
            setError({ message: "Could not process the uploaded image file." });
        }
    };
    
    useEffect(() => {
        const storedSettings = localStorage.getItem('googleSettings');
        if (storedSettings) {
            setGoogleSettings(JSON.parse(storedSettings));
        } else {
            setGoogleSettings({
                driveFolderName: 'AI for PI Newsletters',
                logSheetName: 'AI for PI Newsletter Log',
                subscribersSheetName: 'Newsletter Subscribers',
            });
        }
        
        googleApi.initClient((data) => {
            setAuthData(data);
        }, () => {
            setIsGoogleApiInitialized(true);
            console.log('onInitComplete fired!');
        });

        const storedPresets = localStorage.getItem('newsletterPresets');
        if (storedPresets) {
            setPresets(JSON.parse(storedPresets));
        }

        const storedHistory = localStorage.getItem('generationHistory');
        if (storedHistory) {
            setHistory(JSON.parse(storedHistory));
        }
    }, []);

    // Load subscriber lists when googleSettings or authData changes
    useEffect(() => {
        const loadSubscriberLists = async () => {
            if (!googleSettings || !authData?.access_token) return;
            try {
                const lists = await googleApi.readAllLists(googleSettings.groupListSheetName || 'Group List');
                setSubscriberLists(lists);
            } catch (err) {
                console.error('Error loading subscriber lists:', err);
                setSubscriberLists([]);
            }
        };
        loadSubscriberLists();
    }, [googleSettings, authData]);

    // Load history from Google Sheets when authenticated
    useEffect(() => {
        const loadHistoryFromSheet = async () => {
            if (!googleSettings || !authData?.access_token) return;
            try {
                const sheetHistory = await googleApi.readHistoryFromSheet(googleSettings.logSheetName, googleSettings.driveFolderName);
                if (sheetHistory && sheetHistory.length > 0) {
                    setHistory(sheetHistory);
                    // Also update localStorage to keep it in sync
                    try {
                        localStorage.setItem('generationHistory', JSON.stringify(sheetHistory));
                    } catch (storageErr) {
                        console.warn('Could not update localStorage (quota exceeded), but history loaded from Google Sheets:', storageErr);
                    }
                    console.log(`Loaded ${sheetHistory.length} items from Google Sheets history`);
                }
            } catch (err) {
                console.error('Error loading history from Google Sheets:', err);
                // Silently fall back to localStorage - history will still be available from initial load
            }
        };
        loadHistoryFromSheet();
    }, [googleSettings, authData?.access_token]);


    // Handle authentication state changes - navigate to app when authenticated
    useEffect(() => {
        if (authData?.access_token && activePage === 'authentication') {
            // User just logged in, navigate to first app page
            setActivePage('discoverTopics');
        }
    }, [authData?.access_token]);

    const handleWorkflowAction = async (action: 'drive' | 'sheet' | 'gmail') => {
        if (!newsletter || !googleSettings || !authData?.access_token) return;
        setWorkflowStatus({ message: `Executing ${action} action...`, type: 'success' });
        
        try {
            let resultMessage = '';
            switch (action) {
                case 'drive':
                    resultMessage = await googleApi.saveToDrive(newsletter, googleSettings.driveFolderName, selectedTopics);
                    setWorkflowActions({ ...workflowActions, savedToDrive: true });
                    break;
                case 'sheet':
                    // Log to sheet with current workflow action status
                    resultMessage = await googleApi.logToSheet(newsletter, selectedTopics, googleSettings.logSheetName, workflowActions.savedToDrive, workflowActions.sentEmail);
                    break;
                case 'gmail':
                    // Check if list selection is required
                    if (selectedEmailLists.length === 0) {
                        throw new Error("Please select at least one subscriber list before sending email.");
                    }
                    const emailResult = await googleApi.sendEmail(
                        newsletter,
                        selectedTopics,
                        googleSettings.subscribersSheetName,
                        authData.email,
                        selectedEmailLists
                    );
                    resultMessage = emailResult.message;
                    setWorkflowActions({ ...workflowActions, sentEmail: true });
                    // Auto-log to sheet when email is sent with list names
                    const listNames = emailResult.listNames.join(', ');
                    await googleApi.logToSheet(
                        newsletter,
                        selectedTopics,
                        googleSettings.logSheetName,
                        workflowActions.savedToDrive,
                        true,
                        listNames
                    );
                    resultMessage += ` Also logged to sheet with email tracking.`;
                    break;
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

    // If not authenticated, show the authentication page
    if (!authData?.access_token) {
        return (
            <div className="min-h-screen bg-background text-primary-text font-sans">
                <AuthenticationPage
                    onSignIn={handleGoogleSignIn}
                    isGoogleApiInitialized={isGoogleApiInitialized}
                    isLoading={false}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-primary-text font-sans flex flex-col">
            <Header onSettingsClick={() => setIsSettingsOpen(true)} onSignOut={handleGoogleSignOut} authData={authData} /> {/* Settings button opens settings, sign out on Header */}
            <div className="flex flex-grow">
                <SideNavigation activePage={activePage} setActivePage={setActivePage} />
                <main className="flex-grow container mx-auto p-4 md:p-8 overflow-y-auto">

                    {activePage === 'discoverTopics' && (
                        <DiscoverTopicsPage
                            trendingContent={trendingContent}
                            compellingContent={compellingContent}
                            isFetchingTrending={isFetchingTrending}
                            selectedTopics={selectedTopics}
                            customTopic={customTopic}
                            setCustomTopic={setCustomTopic}
                            handleAddTopic={handleAddTopic}
                            handleRemoveTopic={handleRemoveTopic}
                            suggestedTopics={suggestedTopics}
                            handleSelectSuggestedTopic={handleSelectSuggestedTopic}
                            handleGenerateSuggestions={handleGenerateSuggestions}
                            isGeneratingTopics={isGeneratingTopics}
                            handleAddTrendingTopic={handleAddTrendingTopic}
                            hasSelectedAudience={hasSelectedAudience}
                            loading={loading}
                            error={error}
                            fetchTrendingContent={fetchTrendingContent}
                            audienceOptions={audienceOptions}
                            selectedAudience={selectedAudience}
                            handleAudienceChange={handleAudienceChange}
                            trendingSources={trendingSources}
                        />
                    )}

                    {activePage === 'defineTone' && (
                        <DefineTonePage
                            selectedTone={selectedTone}
                            setSelectedTone={setSelectedTone}
                            toneOptions={toneOptions}
                            selectedFlavors={selectedFlavors}
                            handleFlavorChange={handleFlavorChange}
                            flavorOptions={flavorOptions}
                        />
                    )}

                    {activePage === 'imageStyle' && (
                        <ImageStylePage
                            selectedImageStyle={selectedImageStyle}
                            setSelectedImageStyle={setSelectedImageStyle}
                            imageStyleOptions={imageStyleOptions}
                        />
                    )}
                    
                    {activePage === 'generateNewsletter' && (
                        <GenerateNewsletterPage
                            selectedTopics={selectedTopics}
                            selectedAudience={selectedAudience}
                            selectedTone={selectedTone}
                            selectedFlavors={selectedFlavors}
                            selectedImageStyle={selectedImageStyle}
                            audienceOptions={audienceOptions}
                            toneOptions={toneOptions}
                            flavorOptions={flavorOptions}
                            imageStyleOptions={imageStyleOptions}
                            newsletter={newsletter}
                            onEditImage={(index, src, prompt) => setEditingImage({ index, src, mimeType: 'image/png', prompt })}
                            onImageUpload={handleImageUpload}
                            onReorderSections={handleReorderSections}
                            onUpdate={handleNewsletterUpdate}
                            // Using the derived `isActionLoading` state
                            isLoading={isActionLoading}
                            handleGenerateNewsletter={handleGenerateNewsletter}
                            loading={loading}
                            progress={progress}
                            error={error}
                            hasSelectedAudience={hasSelectedAudience}
                            presets={presets}
                            onSavePreset={handleSavePreset}
                            onLoadPreset={handleLoadPreset}
                            onDeletePreset={handleDeletePreset}
                            onSyncToCloud={handleSyncPresetsToCloud}
                            onLoadFromCloud={handleLoadPresetsFromCloud}
                            isAuthenticated={!!authData?.access_token}
                            promptOfTheDay={promptOfTheDay}
                            onSavePromptOfTheDay={setPromptOfTheDay}
                        />
                    )}

                    {activePage === 'history' && (
                        <HistoryContentPage
                            history={history}
                            onLoad={handleLoadFromHistory}
                            onClear={handleClearHistory}
                        />
                    )}

                    {activePage === 'subscriberManagement' && (
                        <SubscriberManagementPage
                            subscribers={subscribers}
                            subscriberLists={subscriberLists}
                            googleSettings={googleSettings}
                            authData={authData}
                            onListsChanged={refreshSubscriberLists}
                        />
                    )}

                </main>

                {editingImage && (
                    <ImageEditorModal
                        isOpen={!!editingImage}
                        onClose={() => setEditingImage(null)}
                        imageSrc={editingImage.src}
                        imageMimeType={editingImage.mimeType}
                        originalPrompt={editingImage.prompt}
                        onSave={handleSaveImageEdit}
                    />
                )}
                
                {/* Settings modal now includes workflow actions */}
                {isSettingsOpen && (
                    <SettingsModal
                        isOpen={isSettingsOpen}
                        onClose={() => setIsSettingsOpen(false)}
                        onSave={handleSaveSettings}
                        initialSettings={googleSettings}
                        authData={authData}
                        onSignIn={googleApi.signIn}
                        onSignOut={googleApi.signOut}
                        isGoogleApiInitialized={isGoogleApiInitialized}
                        newsletter={newsletter}
                        onWorkflowAction={handleWorkflowAction}
                        onLoadFromDrive={(loadedNewsletter: Newsletter, topics: string[]) => {
                            handleLoadFromDrive(loadedNewsletter, topics);
                            setIsSettingsOpen(false);
                        }}
                        onOpenListSelectionModal={() => handleWorkflowAction('gmail')}
                        workflowStatus={workflowStatus}
                    />
                )}
            </div>
        </div>
    );
};

export default App;