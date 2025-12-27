/**
 * DiscoverTopicsPage
 *
 * Phase 6g.6: Migrated from props to contexts/hooks
 *
 * State sources:
 * - Topics: TopicsContext (useSelectedTopics, useTopics)
 * - Trending: TopicsContext (useTrendingContent)
 * - Audience: TopicsContext (useAudienceSelection)
 * - Loading/Error: UIContext (useLoading, useError)
 *
 * Remaining props (API call handlers and multi-state handlers):
 * - handleGenerateSuggestions: API call handler (Claude topic suggestions)
 * - fetchTrendingContent: API call handler (trending + compelling content)
 * - onLoadFromArchive: Multi-state handler (modifies topics, audience, content)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InspirationSourcesPanel, TrendingSource } from '../components/InspirationSourcesPanel';
import { Spinner } from '../components/Spinner';
import { PlusIcon, RefreshIcon, SearchIcon, LightbulbIcon, XIcon, HistoryIcon, SettingsIcon, FolderIcon, BookmarkIcon, BookmarkSolidIcon, ExternalLinkIcon } from '../components/IconComponents';
import { IndexToKBButton, IndexAllToKBButton } from '../components/IndexToKBButton';
import { ArchiveBrowser } from '../components/ArchiveBrowser';
import { TopicLibrary } from '../components/TopicLibrary';
import { SourceLibrary } from '../components/SourceLibrary';
import type { ArchiveContent } from '../services/archiveClientService';
import { fadeInUp, staggerContainer, staggerItem } from '../utils/animations';
import { useSelectedTopics, useTrendingContent, useAudienceSelection, useTopics } from '../contexts';
import { useLoading, useError, useModals, useCustomAudiences } from '../contexts';
import { useSavedTopics } from '../hooks/useSavedTopics';
import { useSavedSources } from '../hooks/useSavedSources';
import { useRagIndexing } from '../hooks/useRagIndexing';
import { checkTrendingCacheStatus } from '../services/claudeService';

interface ActionableCapability {
    title: string;
    whatItIs: string;
    newCapability: string;
    whoShouldCare: string;
    howToGetStarted: string;
    expectedImpact: string;
    resource: string;
}

interface EssentialTool {
    name: string;
    description: string;
    whyNow: string;
    link: string;
}

interface CompellingContent {
    actionableCapabilities: ActionableCapability[];
    essentialTools: EssentialTool[];
}

interface DiscoverTopicsPageProps {
    // API call handlers that must remain as props
    handleGenerateSuggestions: () => Promise<void>;
    fetchTrendingContent: () => Promise<void>;
    // Multi-state handler
    onLoadFromArchive: (content: ArchiveContent, audience: string[]) => void;
}

export const DiscoverTopicsPage: React.FC<DiscoverTopicsPageProps> = ({
    handleGenerateSuggestions,
    fetchTrendingContent,
    onLoadFromArchive,
}) => {
    // Topics state from TopicsContext
    const { topics: selectedTopics, customTopic, setCustomTopic, addTopic, removeTopic } = useSelectedTopics();
    const { suggestedTopics, selectSuggestedTopic, isGeneratingTopics } = useTopics();

    // Trending content from TopicsContext
    // Phase 17: Added trendingCacheMetadata for SWR display
    // Phase 18: Added addTopicWithContext to preserve audienceId
    const {
        trendingContent,
        compellingContent,
        trendingSources,
        trendingCacheMetadata,
        isFetchingTrending,
        addTrendingTopic,
        addTopicWithContext,
    } = useTrendingContent();

    // Audience selection from TopicsContext (Phase 15.2 - hierarchical)
    const {
        selectedAudience,
        audienceOptions,
        audienceCategories,
        handleAudienceChange,
        handleCategoryChange,
        isCategoryFullySelected,
        isCategoryPartiallySelected,
        hasSelectedAudience,
    } = useAudienceSelection();

    // Loading/error from UIContext
    const { loading } = useLoading();
    const { error } = useError();

    // Phase 12.1: Modal actions and custom audiences for Manage Audiences button
    const { openAudienceEditor } = useModals();
    const { customAudiences } = useCustomAudiences();

    // Topic/Source persistence hooks
    const { topics: savedTopics, saveTopic } = useSavedTopics();
    const { saveSource, savedUrls: savedSourceUrls } = useSavedSources();

    // RAG Knowledge Base indexing
    const {
        indexedUrls,
        indexingUrls,
        isIndexed,
        isIndexing,
        indexSource,
        indexSourcesBatch,
        batchProgress,
    } = useRagIndexing();

    // Modal state
    const [isArchiveBrowserOpen, setIsArchiveBrowserOpen] = useState(false);
    const [isTopicLibraryOpen, setIsTopicLibraryOpen] = useState(false);
    const [isSourceLibraryOpen, setIsSourceLibraryOpen] = useState(false);

    // Toast notification state
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Phase 17: Pre-fetch tracking
    const prefetchAttempted = useRef(false);
    const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);

    // Show toast notification
    const showToast = useCallback((message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 2000);
    }, []);

    /**
     * Phase 17: Format cache age for display
     * @param seconds - Cache age in seconds
     * @returns Human-readable string like "2 min ago" or "1 hour ago"
     */
    const formatCacheAge = useCallback((seconds: number): string => {
        if (seconds < 60) return 'just now';
        if (seconds < 3600) {
            const mins = Math.floor(seconds / 60);
            return `${mins} min${mins > 1 ? 's' : ''} ago`;
        }
        const hours = Math.floor(seconds / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }, []);

    /**
     * Phase 17: Pre-fetch trending content on page mount if cache is stale/missing
     */
    useEffect(() => {
        // Only attempt once per page mount
        if (prefetchAttempted.current) return;
        // Need audience selected
        if (!hasSelectedAudience) return;
        // Don't pre-fetch if already loading
        if (isFetchingTrending) return;
        // Don't pre-fetch if we have fresh content
        if (trendingContent && trendingContent.length > 0 && trendingCacheMetadata && !trendingCacheMetadata.isStale) return;

        prefetchAttempted.current = true;

        // Check cache status and pre-fetch if stale or missing
        const doPrefetch = async () => {
            try {
                const audience = Object.keys(selectedAudience).filter(k => selectedAudience[k]);
                const status = await checkTrendingCacheStatus(audience);

                if (status.isStale || status.isMissing) {
                    console.log('[DiscoverTopicsPage] Pre-fetching: cache is', status.isMissing ? 'missing' : 'stale');
                    setIsBackgroundRefreshing(true);
                    await fetchTrendingContent();
                    setIsBackgroundRefreshing(false);
                }
            } catch (err) {
                console.warn('[DiscoverTopicsPage] Pre-fetch check failed:', err);
                setIsBackgroundRefreshing(false);
            }
        };

        doPrefetch();
    }, [hasSelectedAudience, selectedAudience, trendingContent, trendingCacheMetadata, isFetchingTrending, fetchTrendingContent]);

    // Local wrapper for addTopic to use customTopic
    const handleAddTopic = useCallback(() => {
        if (customTopic.trim()) {
            addTopic(customTopic);
        }
    }, [customTopic, addTopic]);

    // Handle saving a topic to library
    const handleSaveTopic = useCallback(async (title: string, category: 'suggested' | 'trending' | 'manual') => {
        try {
            await saveTopic({ title, category });
            showToast('Topic saved to library!');
        } catch (err) {
            console.error('Failed to save topic:', err);
            showToast('Failed to save topic');
        }
    }, [saveTopic, showToast]);

    // Handle saving a source to library
    const handleSaveSource = useCallback(async (source: TrendingSource) => {
        try {
            await saveSource({
                title: source.title,
                url: source.url,
                author: source.author,
                publication: source.publication,
                date: source.date,
                category: source.category,
                summary: source.summary,
            });
            showToast('Source saved to library!');
        } catch (err) {
            console.error('Failed to save source:', err);
            showToast('Failed to save source');
        }
    }, [saveSource, showToast]);

    // Phase 15.6: Handle saving an essential tool to library (as a source)
    const handleSaveTool = useCallback(async (tool: { name: string; description?: string; whyNow?: string; link?: string }) => {
        if (!tool.link) {
            showToast('Cannot save tool without a link');
            return;
        }
        try {
            await saveSource({
                title: tool.name,
                url: tool.link,
                summary: tool.description || tool.whyNow,
                category: 'github', // Default category for tools
                publication: 'Essential Tool',
            });
            showToast('Tool saved to library!');
        } catch (err) {
            console.error('Failed to save tool:', err);
            showToast('Failed to save tool');
        }
    }, [saveSource, showToast]);

    // Handle indexing a source to RAG Knowledge Base
    const handleIndexSource = useCallback(async (source: TrendingSource) => {
        try {
            const result = await indexSource({
                url: source.url,
                title: source.title,
                sourceType: 'trending',
                metadata: {
                    category: source.category,
                    author: source.author,
                    publication: source.publication,
                    date: source.date,
                },
            });
            if (result.success) {
                showToast(result.wasAlreadyIndexed ? 'Already in Knowledge Base' : 'Added to Knowledge Base!');
            } else {
                showToast('Failed to index source');
            }
        } catch (err) {
            console.error('Failed to index source:', err);
            showToast('Failed to index source');
        }
    }, [indexSource, showToast]);

    // Handle batch indexing all inspiration sources
    const handleIndexAllSources = useCallback(async () => {
        const sourcesToIndex = trendingSources
            .filter(s => !isIndexed(s.url))
            .map(s => ({
                url: s.url,
                title: s.title,
                sourceType: 'trending' as const,
                metadata: {
                    category: s.category,
                    author: s.author,
                    publication: s.publication,
                    date: s.date,
                },
            }));

        if (sourcesToIndex.length === 0) {
            showToast('All sources already indexed');
            return;
        }

        const results = await indexSourcesBatch(sourcesToIndex);
        const successCount = results.filter(r => r.success && !r.wasAlreadyIndexed).length;
        const existCount = results.filter(r => r.wasAlreadyIndexed).length;
        showToast(`Indexed ${successCount} new${existCount > 0 ? `, ${existCount} already existed` : ''}`);
    }, [trendingSources, isIndexed, indexSourcesBatch, showToast]);

    // Handle indexing an essential tool
    const handleIndexTool = useCallback(async (tool: EssentialTool) => {
        if (!tool.link) return;
        try {
            const result = await indexSource({
                url: tool.link,
                title: tool.name,
                sourceType: 'tool',
                metadata: {
                    description: tool.description,
                    whyNow: tool.whyNow,
                },
            });
            if (result.success) {
                showToast(result.wasAlreadyIndexed ? 'Tool already in KB' : 'Tool added to KB!');
            }
        } catch (err) {
            console.error('Failed to index tool:', err);
        }
    }, [indexSource, showToast]);

    // Handle indexing a trending topic (from What's Trending section)
    const handleIndexTrendingTopic = useCallback(async (topic: { title: string; resource?: string; audienceId?: string }) => {
        if (!topic.resource) return;
        try {
            const result = await indexSource({
                url: topic.resource,
                title: topic.title,
                sourceType: 'trending',
                metadata: {
                    audienceId: topic.audienceId,
                },
            });
            if (result.success) {
                showToast(result.wasAlreadyIndexed ? 'Already in KB' : 'Added to KB!');
            }
        } catch (err) {
            console.error('Failed to index trending topic:', err);
        }
    }, [indexSource, showToast]);

    // Handle batch indexing all trending topics with resources
    const handleIndexAllTrendingTopics = useCallback(async () => {
        const topicsToIndex = trendingContent
            .filter(t => t.resource && !isIndexed(t.resource))
            .map(t => ({
                url: t.resource!,
                title: t.title,
                sourceType: 'trending' as const,
                metadata: { audienceId: t.audienceId },
            }));

        if (topicsToIndex.length === 0) {
            showToast('All topics already indexed');
            return;
        }

        const results = await indexSourcesBatch(topicsToIndex);
        const successCount = results.filter(r => r.success && !r.wasAlreadyIndexed).length;
        showToast(`Indexed ${successCount} topics`);
    }, [trendingContent, isIndexed, indexSourcesBatch, showToast]);

    // Aliases for props API compatibility
    const handleRemoveTopic = removeTopic;
    const handleSelectSuggestedTopic = selectSuggestedTopic;
    const handleAddTrendingTopic = addTrendingTopic;
    const isActionLoading = !!loading || isGeneratingTopics;

    return (
        <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="space-y-10"
        >
            {/* Page Header */}
            <header className="border-b-2 border-ink pb-6">
                <h1 className="font-display text-h1 text-ink">
                    Discover Topics
                </h1>
                <p className="font-serif text-body text-slate mt-2">
                    Find trending content and select topics for your newsletter
                </p>
            </header>

            {/* Section 1: Audience Selection */}
            <section className="bg-paper border border-border-subtle p-8">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-baseline gap-3">
                        <span className="text-overline text-slate uppercase tracking-widest font-sans">Step 1</span>
                        <h2 className="font-display text-h3 text-ink">Select Target Audience</h2>
                    </div>
                    {/* Phase 12.1: Manage Audiences button - opens AudienceConfigEditor modal */}
                    <button
                        onClick={openAudienceEditor}
                        className="flex items-center gap-2 font-sans text-ui text-editorial-red hover:text-ink transition-colors"
                    >
                        <SettingsIcon className="h-4 w-4" />
                        <span>Manage Audiences</span>
                        {customAudiences.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-editorial-red/10 text-editorial-red text-xs font-medium rounded">
                                {customAudiences.length}
                            </span>
                        )}
                    </button>
                </div>
                <p className="font-sans text-ui text-slate mb-6">
                    Choose your audience to tailor content recommendations
                </p>

                {/* Hierarchical Audience Selection (Phase 15.2) */}
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                    {audienceCategories.map((category) => (
                        <motion.div
                            key={category.id}
                            variants={staggerItem}
                            className="border border-border-subtle bg-paper"
                        >
                            {/* Category Header (selects/deselects all children) */}
                            <label
                                htmlFor={`category-${category.id}`}
                                className={`
                                    flex items-center gap-3 p-4 cursor-pointer transition-all duration-200 border-b
                                    ${isCategoryFullySelected(category.id) ? 'bg-pearl border-ink' : 'border-border-subtle hover:bg-pearl/50'}
                                `}
                            >
                                <input
                                    type="checkbox"
                                    id={`category-${category.id}`}
                                    checked={isCategoryFullySelected(category.id)}
                                    ref={(el) => {
                                        if (el) el.indeterminate = isCategoryPartiallySelected(category.id);
                                    }}
                                    onChange={() => handleCategoryChange(category.id)}
                                    className="h-4 w-4 border-charcoal bg-paper text-ink focus:ring-ink"
                                />
                                <span className="font-sans text-ui font-semibold text-ink">{category.name}</span>
                            </label>

                            {/* Child Specializations */}
                            <div className="divide-y divide-border-subtle">
                                {category.children.map((childId) => {
                                    const option = audienceOptions[childId];
                                    if (!option) return null;
                                    return (
                                        <label
                                            key={childId}
                                            htmlFor={`audience-${childId}`}
                                            className={`
                                                flex items-start gap-3 p-4 pl-8 cursor-pointer transition-all duration-200
                                                ${selectedAudience[childId] ? 'bg-pearl/70' : 'bg-paper hover:bg-pearl/30'}
                                            `}
                                        >
                                            <input
                                                type="checkbox"
                                                id={`audience-${childId}`}
                                                checked={selectedAudience[childId] || false}
                                                onChange={() => handleAudienceChange(childId)}
                                                className="mt-0.5 h-4 w-4 border-charcoal bg-paper text-ink focus:ring-ink"
                                            />
                                            <div>
                                                <span className="font-sans text-ui font-medium text-ink">{option.label}</span>
                                                <p className="font-sans text-caption text-slate mt-1">{option.description}</p>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* Section 2: What's Trending */}
            <section className="bg-paper border border-border-subtle p-8">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-baseline gap-3">
                        <span className="text-overline text-slate uppercase tracking-widest font-sans">Step 2</span>
                        <h2 className="font-display text-h3 text-ink">What's Trending</h2>
                        {/* Phase 17: Cache status indicator */}
                        {trendingCacheMetadata && trendingContent && trendingContent.length > 0 && (
                            <span className="font-sans text-caption text-slate">
                                {trendingCacheMetadata.cached ? (
                                    <>
                                        <span className="opacity-60">Updated </span>
                                        <span>{trendingCacheMetadata.cacheAge ? formatCacheAge(trendingCacheMetadata.cacheAge) : 'recently'}</span>
                                        {(trendingCacheMetadata.isStale || isBackgroundRefreshing) && (
                                            <span className="ml-2 text-editorial-navy animate-pulse">(refreshing...)</span>
                                        )}
                                    </>
                                ) : (
                                    <span className="text-editorial-sage">fresh</span>
                                )}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Index All Trending Topics button */}
                        {trendingContent && trendingContent.filter(t => t.resource).length > 0 && (
                            <IndexAllToKBButton
                                availableCount={trendingContent.filter(t => t.resource).length}
                                indexedCount={trendingContent.filter(t => t.resource && isIndexed(t.resource)).length}
                                isIndexing={batchProgress?.isRunning || false}
                                progress={batchProgress ? batchProgress.completed / batchProgress.total : 0}
                                onIndexAll={handleIndexAllTrendingTopics}
                            />
                        )}
                        <button
                            onClick={() => setIsArchiveBrowserOpen(true)}
                            className="flex items-center gap-2 font-sans text-ui text-editorial-navy hover:text-ink transition-colors"
                            title="Load from saved archives"
                        >
                            <HistoryIcon className="h-4 w-4" />
                            <span>Archives</span>
                        </button>
                        <button
                            onClick={fetchTrendingContent}
                            disabled={isFetchingTrending || !hasSelectedAudience}
                            className="flex items-center gap-2 font-sans text-ui text-ink hover:text-charcoal disabled:text-silver disabled:cursor-not-allowed transition-colors"
                        >
                            <RefreshIcon className="h-4 w-4" />
                            <span>{isFetchingTrending ? 'Fetching...' : 'Refresh'}</span>
                        </button>
                    </div>
                </div>

                {isFetchingTrending ? (
                    <div className="flex items-center gap-3 py-12 justify-center">
                        <Spinner />
                        <span className="font-sans text-ui text-slate">Fetching latest updates...</span>
                    </div>
                ) : trendingContent && trendingContent.length > 0 ? (
                    <div className="space-y-10">
                        {/* Phase 15.3c: Trending Topics from V2 Balanced Generation */}
                        <div>
                            <h3 className="font-sans text-overline text-slate uppercase tracking-widest mb-4">
                                What's Trending
                            </h3>
                            <motion.div
                                variants={staggerContainer}
                                initial="hidden"
                                animate="visible"
                                className="grid grid-cols-1 lg:grid-cols-2 gap-4"
                            >
                                {trendingContent.map((topic, idx) => (
                                    <motion.article
                                        key={topic.id || idx}
                                        variants={staggerItem}
                                        className="bg-pearl border border-border-subtle p-6 hover:shadow-editorial transition-shadow"
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-4">
                                            <h4 className="font-display text-h3 text-ink">{topic.title}</h4>
                                            {topic.audienceId && (
                                                <span className="flex-shrink-0 px-2 py-1 text-xs font-sans bg-editorial-navy/10 text-editorial-navy rounded">
                                                    {topic.audienceId.replace(/-/g, ' ')}
                                                </span>
                                            )}
                                        </div>

                                        <dl className="space-y-3 font-sans text-ui">
                                            {topic.whatItIs && (
                                                <div>
                                                    <dt className="text-caption font-semibold text-slate uppercase tracking-wide">What It Is</dt>
                                                    <dd className="text-charcoal mt-1">{topic.whatItIs}</dd>
                                                </div>
                                            )}

                                            {topic.newCapability && (
                                                <div className="bg-paper p-3 border-l-2 border-editorial-red">
                                                    <dt className="text-caption font-semibold text-editorial-red uppercase tracking-wide">New Capability</dt>
                                                    <dd className="text-charcoal mt-1">{topic.newCapability}</dd>
                                                </div>
                                            )}

                                            {topic.whoShouldCare && (
                                                <div>
                                                    <dt className="text-caption font-semibold text-slate uppercase tracking-wide">Who Should Care</dt>
                                                    <dd className="text-charcoal mt-1">{topic.whoShouldCare}</dd>
                                                </div>
                                            )}

                                            {topic.howToGetStarted && (
                                                <div className="bg-paper p-3 border-l-2 border-editorial-sage">
                                                    <dt className="text-caption font-semibold text-editorial-sage uppercase tracking-wide">How to Get Started</dt>
                                                    <dd className="text-charcoal mt-1 whitespace-pre-wrap">{topic.howToGetStarted}</dd>
                                                </div>
                                            )}

                                            {topic.expectedImpact && (
                                                <div>
                                                    <dt className="text-caption font-semibold text-slate uppercase tracking-wide">Expected Impact</dt>
                                                    <dd className="text-charcoal mt-1">{topic.expectedImpact}</dd>
                                                </div>
                                            )}

                                            {/* Fallback to summary if no rich fields */}
                                            {!topic.whatItIs && !topic.newCapability && topic.summary && (
                                                <div>
                                                    <dd className="text-charcoal">{topic.summary}</dd>
                                                </div>
                                            )}
                                        </dl>

                                        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border-subtle">
                                            {topic.resource && (
                                                <>
                                                    {/* Index to KB button */}
                                                    <IndexToKBButton
                                                        isIndexed={isIndexed(topic.resource)}
                                                        isIndexing={isIndexing(topic.resource)}
                                                        onIndex={() => handleIndexTrendingTopic(topic)}
                                                        size="sm"
                                                    />
                                                    <a
                                                        href={topic.resource}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="editorial-link font-sans text-ui"
                                                    >
                                                        Learn More
                                                    </a>
                                                </>
                                            )}
                                            <button
                                                onClick={() => addTopicWithContext(topic)}
                                                className="flex items-center gap-1 font-sans text-ui text-ink hover:text-charcoal transition-colors ml-auto"
                                            >
                                                <PlusIcon className="h-4 w-4" />
                                                Add Topic
                                            </button>
                                        </div>
                                    </motion.article>
                                ))}
                            </motion.div>
                        </div>

                        {/* Essential Tools - still from compellingContent */}
                        {compellingContent?.essentialTools?.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-sans text-overline text-slate uppercase tracking-widest">
                                        Essential Tools
                                    </h3>
                                    {/* Bulk index tools button */}
                                    <IndexAllToKBButton
                                        availableCount={compellingContent.essentialTools.filter(t => t.link).length}
                                        indexedCount={compellingContent.essentialTools.filter(t => t.link && isIndexed(t.link)).length}
                                        isIndexing={batchProgress?.isRunning || false}
                                        progress={batchProgress ? batchProgress.completed / batchProgress.total : 0}
                                        onIndexAll={async () => {
                                            const toolsToIndex = compellingContent.essentialTools
                                                .filter(t => t.link && !isIndexed(t.link))
                                                .map(t => ({
                                                    url: t.link!,
                                                    title: t.name,
                                                    sourceType: 'tool' as const,
                                                    metadata: { description: t.description, whyNow: t.whyNow },
                                                }));
                                            if (toolsToIndex.length > 0) {
                                                await indexSourcesBatch(toolsToIndex);
                                                showToast(`Indexed ${toolsToIndex.length} tools`);
                                            }
                                        }}
                                    />
                                </div>
                                <motion.div
                                    variants={staggerContainer}
                                    initial="hidden"
                                    animate="visible"
                                    className="space-y-3"
                                >
                                    {compellingContent.essentialTools.map((tool, idx) => (
                                        <motion.div
                                            key={idx}
                                            variants={staggerItem}
                                            className="flex items-start justify-between gap-6 p-5 bg-pearl border border-border-subtle"
                                        >
                                            <div className="flex-1">
                                                <h4 className="font-sans text-ui font-semibold text-ink mb-1">{tool.name}</h4>
                                                <p className="font-sans text-caption text-charcoal mb-2">{tool.description}</p>
                                                <p className="font-sans text-caption text-slate">
                                                    <span className="font-semibold">Why now:</span> {tool.whyNow}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {/* Index to KB button */}
                                                {tool.link && (
                                                    <IndexToKBButton
                                                        isIndexed={isIndexed(tool.link)}
                                                        isIndexing={isIndexing(tool.link)}
                                                        onIndex={() => handleIndexTool(tool)}
                                                    />
                                                )}
                                                {/* Phase 15.6: Save tool button */}
                                                {tool.link && (
                                                    <button
                                                        onClick={() => handleSaveTool(tool)}
                                                        disabled={savedSourceUrls.has(tool.link)}
                                                        className={`p-1.5 rounded-md transition-colors ${
                                                            savedSourceUrls.has(tool.link)
                                                                ? 'text-editorial-navy cursor-default'
                                                                : 'text-slate hover:text-editorial-navy hover:bg-pearl'
                                                        }`}
                                                        title={savedSourceUrls.has(tool.link) ? 'Saved to library' : 'Save to library'}
                                                    >
                                                        {savedSourceUrls.has(tool.link) ? (
                                                            <BookmarkSolidIcon className="h-4 w-4" />
                                                        ) : (
                                                            <BookmarkIcon className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                )}
                                                {tool.link && (
                                                    <a
                                                        href={tool.link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="font-sans text-ui text-editorial-navy hover:text-ink transition-colors"
                                                    >
                                                        Visit
                                                    </a>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            </div>
                        )}
                    </div>
                ) : error ? (
                    <div className="py-8 text-center">
                        <p className="font-sans text-ui text-slate mb-4">{error.message}</p>
                        {error.onRetry === fetchTrendingContent && (
                            <button
                                onClick={error.onRetry}
                                className="flex items-center gap-2 font-sans text-ui text-editorial-red hover:text-ink transition-colors mx-auto"
                            >
                                <RefreshIcon className="h-4 w-4" />
                                Retry
                            </button>
                        )}
                    </div>
                ) : (
                    <p className="font-sans text-ui text-slate py-8 text-center">
                        {hasSelectedAudience
                            ? "Click 'Refresh' to discover trending AI capabilities and tools."
                            : "Select an audience above to see trending content."}
                    </p>
                )}
            </section>

            {/* Inspiration Sources */}
            <div className="relative">
                {/* Saved Sources button */}
                <div className="absolute top-6 right-6 z-10">
                    <button
                        onClick={() => setIsSourceLibraryOpen(true)}
                        className="flex items-center gap-2 font-sans text-ui text-editorial-navy hover:text-ink transition-colors"
                    >
                        <BookmarkIcon className="h-4 w-4" />
                        <span>Saved Sources</span>
                    </button>
                </div>
                <InspirationSourcesPanel
                    sources={trendingSources}
                    isLoading={isFetchingTrending}
                    onSaveSource={handleSaveSource}
                    savedSourceUrls={savedSourceUrls}
                    onIndexSource={handleIndexSource}
                    indexedSourceUrls={indexedUrls}
                    indexingSourceUrls={indexingUrls}
                    onIndexAll={handleIndexAllSources}
                    isBatchIndexing={batchProgress?.isRunning || false}
                    batchIndexProgress={batchProgress ? batchProgress.completed / batchProgress.total : 0}
                />
            </div>

            {/* Section 3: Select Topics */}
            <section className="bg-paper border border-border-subtle p-8">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-baseline gap-3">
                        <span className="text-overline text-slate uppercase tracking-widest font-sans">Step 3</span>
                        <h2 className="font-display text-h3 text-ink">Select Topics</h2>
                    </div>
                    {/* My Library button */}
                    <button
                        onClick={() => setIsTopicLibraryOpen(true)}
                        className="flex items-center gap-2 font-sans text-ui text-editorial-navy hover:text-ink transition-colors"
                    >
                        <FolderIcon className="h-4 w-4" />
                        <span>My Library</span>
                        {savedTopics.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-editorial-navy/10 text-editorial-navy text-xs font-medium rounded">
                                {savedTopics.length}
                            </span>
                        )}
                    </button>
                </div>
                <p className="font-sans text-ui text-slate mb-6">
                    Add topics for your newsletter manually or get AI suggestions
                </p>

                {/* Selected Topics */}
                {selectedTopics.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                        {selectedTopics.map((topic, index) => (
                            <span
                                key={index}
                                className="inline-flex items-center gap-2 bg-ink text-paper font-sans text-ui px-3 py-1.5"
                            >
                                {topic}
                                <button
                                    onClick={() => handleRemoveTopic(index)}
                                    className="text-silver hover:text-paper transition-colors"
                                >
                                    <XIcon className="h-4 w-4" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                {/* Topic Input */}
                <div className="flex gap-3 mb-4">
                    <div className="relative flex-grow">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-silver" />
                        <input
                            type="text"
                            value={customTopic}
                            onChange={(e) => setCustomTopic(e.target.value)}
                            placeholder="Enter a topic..."
                            className="input-editorial w-full pl-10"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()}
                            disabled={isActionLoading}
                        />
                    </div>
                    <button
                        onClick={handleAddTopic}
                        disabled={!customTopic.trim() || isActionLoading}
                        className="p-2.5 bg-ink text-paper hover:bg-charcoal disabled:bg-silver disabled:cursor-not-allowed transition-colors"
                    >
                        <PlusIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Generate Suggestions */}
                <button
                    onClick={handleGenerateSuggestions}
                    disabled={isActionLoading || !hasSelectedAudience}
                    className="flex items-center gap-2 font-sans text-ui text-editorial-navy hover:text-ink disabled:text-silver disabled:cursor-not-allowed transition-colors"
                >
                    <LightbulbIcon className="h-4 w-4" />
                    <span>{isGeneratingTopics ? 'Generating...' : 'Suggest Topics'}</span>
                </button>

                {/* Suggestions (Phase 15.4: with audience badges, Phase 15.5: with source links) */}
                {suggestedTopics.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-border-subtle">
                        <h4 className="font-sans text-overline text-slate uppercase tracking-widest mb-3">
                            Suggestions
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {suggestedTopics.map((suggestion, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-2 font-sans text-ui text-charcoal bg-pearl hover:bg-border-subtle border border-border-subtle px-3 py-1.5 transition-colors"
                                >
                                    <button
                                        onClick={() => handleSelectSuggestedTopic(suggestion)}
                                        className="text-left hover:text-ink transition-colors"
                                    >
                                        {suggestion.title}
                                    </button>
                                    {suggestion.audienceId && (
                                        <span className="flex-shrink-0 px-1.5 py-0.5 text-xs bg-editorial-navy/10 text-editorial-navy rounded capitalize">
                                            {suggestion.audienceId.replace(/-/g, ' ')}
                                        </span>
                                    )}
                                    {suggestion.resource && (
                                        <a
                                            href={suggestion.resource}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex-shrink-0 p-1 text-slate hover:text-editorial-navy transition-colors"
                                            title={`Source: ${suggestion.resource}`}
                                        >
                                            <ExternalLinkIcon className="h-3.5 w-3.5" />
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {error && error.onRetry === handleGenerateSuggestions && (
                    <div className="mt-4">
                        <button
                            onClick={error.onRetry}
                            className="flex items-center gap-2 font-sans text-ui text-editorial-red hover:text-ink transition-colors"
                        >
                            <RefreshIcon className="h-4 w-4" />
                            Retry Suggestions
                        </button>
                    </div>
                )}
            </section>

            {/* Archive Browser Modal */}
            <ArchiveBrowser
                isOpen={isArchiveBrowserOpen}
                onClose={() => setIsArchiveBrowserOpen(false)}
                onLoadArchive={onLoadFromArchive}
            />

            {/* Topic Library Modal */}
            <TopicLibrary
                isOpen={isTopicLibraryOpen}
                onClose={() => setIsTopicLibraryOpen(false)}
                onSelectTopic={(topic) => {
                    addTopic(topic);
                    setIsTopicLibraryOpen(false);
                }}
            />

            {/* Source Library Modal */}
            <SourceLibrary
                isOpen={isSourceLibraryOpen}
                onClose={() => setIsSourceLibraryOpen(false)}
            />

            {/* Toast Notification */}
            <AnimatePresence>
                {toastMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        transition={{ duration: 0.2 }}
                        className="fixed bottom-6 right-6 z-50 bg-ink text-paper px-4 py-3 shadow-lg font-sans text-ui"
                    >
                        {toastMessage}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
