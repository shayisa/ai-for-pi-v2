import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { TrendingTopic } from '../types';
import { InspirationSources } from '../components/InspirationSources';
import { InspirationSourcesPanel, TrendingSource } from '../components/InspirationSourcesPanel';
import { Spinner } from '../components/Spinner';
import { PlusIcon, RefreshIcon, SearchIcon, LightbulbIcon, XIcon, HistoryIcon } from '../components/IconComponents';
import { ArchiveBrowser } from '../components/ArchiveBrowser';
import type { ArchiveContent } from '../services/archiveClientService';
import { fadeInUp, staggerContainer, staggerItem } from '../utils/animations';

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
    trendingContent: TrendingTopic[] | null;
    compellingContent: CompellingContent | null;
    isFetchingTrending: boolean;
    selectedTopics: string[];
    customTopic: string;
    setCustomTopic: (topic: string) => void;
    handleAddTopic: () => void;
    handleRemoveTopic: (index: number) => void;
    suggestedTopics: string[];
    handleSelectSuggestedTopic: (suggestion: string) => void;
    handleGenerateSuggestions: () => Promise<void>;
    isGeneratingTopics: boolean;
    handleAddTrendingTopic: (topic: string) => void;
    hasSelectedAudience: boolean;
    loading: string | null;
    error: { message: string; onRetry?: () => void; } | null;
    fetchTrendingContent: () => Promise<void>;
    audienceOptions: Record<string, { label: string; description: string }>;
    selectedAudience: Record<string, boolean>;
    handleAudienceChange: (key: string) => void;
    trendingSources: TrendingSource[];
    onLoadFromArchive: (content: ArchiveContent, audience: string[]) => void;
}

export const DiscoverTopicsPage: React.FC<DiscoverTopicsPageProps> = ({
    trendingContent,
    compellingContent,
    isFetchingTrending,
    selectedTopics,
    customTopic,
    setCustomTopic,
    handleAddTopic,
    handleRemoveTopic,
    suggestedTopics,
    handleSelectSuggestedTopic,
    handleGenerateSuggestions,
    isGeneratingTopics,
    handleAddTrendingTopic,
    hasSelectedAudience,
    loading,
    error,
    fetchTrendingContent,
    audienceOptions,
    selectedAudience,
    handleAudienceChange,
    trendingSources,
    onLoadFromArchive,
}) => {
    const isActionLoading = !!loading || isGeneratingTopics;
    const [isArchiveBrowserOpen, setIsArchiveBrowserOpen] = useState(false);

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
                <div className="flex items-baseline gap-3 mb-4">
                    <span className="text-overline text-slate uppercase tracking-widest font-sans">Step 1</span>
                    <h2 className="font-display text-h3 text-ink">Select Target Audience</h2>
                </div>
                <p className="font-sans text-ui text-slate mb-6">
                    Choose your audience to tailor content recommendations
                </p>

                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                    {Object.entries(audienceOptions).map(([key, { label, description }]) => (
                        <motion.label
                            key={key}
                            variants={staggerItem}
                            htmlFor={`audience-${key}`}
                            className={`
                                flex items-start gap-3 p-4 cursor-pointer transition-all duration-200
                                border ${selectedAudience[key] ? 'border-ink bg-pearl' : 'border-border-subtle bg-paper hover:bg-pearl'}
                            `}
                        >
                            <input
                                type="checkbox"
                                id={`audience-${key}`}
                                checked={selectedAudience[key]}
                                onChange={() => handleAudienceChange(key)}
                                className="mt-1 h-4 w-4 border-charcoal bg-paper text-ink focus:ring-ink"
                            />
                            <div>
                                <span className="font-sans text-ui font-medium text-ink">{label}</span>
                                <p className="font-sans text-caption text-slate mt-1">{description}</p>
                            </div>
                        </motion.label>
                    ))}
                </motion.div>
            </section>

            {/* Section 2: What's Trending */}
            <section className="bg-paper border border-border-subtle p-8">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-baseline gap-3">
                        <span className="text-overline text-slate uppercase tracking-widest font-sans">Step 2</span>
                        <h2 className="font-display text-h3 text-ink">What's Trending</h2>
                    </div>
                    <div className="flex gap-2">
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
                ) : compellingContent ? (
                    <div className="space-y-10">
                        {/* Actionable AI Capabilities */}
                        {compellingContent.actionableCapabilities?.length > 0 && (
                            <div>
                                <h3 className="font-sans text-overline text-slate uppercase tracking-widest mb-4">
                                    Actionable Capabilities
                                </h3>
                                <motion.div
                                    variants={staggerContainer}
                                    initial="hidden"
                                    animate="visible"
                                    className="grid grid-cols-1 lg:grid-cols-2 gap-4"
                                >
                                    {compellingContent.actionableCapabilities.map((capability, idx) => (
                                        <motion.article
                                            key={idx}
                                            variants={staggerItem}
                                            className="bg-pearl border border-border-subtle p-6 hover:shadow-editorial transition-shadow"
                                        >
                                            <h4 className="font-display text-h3 text-ink mb-4">{capability.title}</h4>

                                            <dl className="space-y-3 font-sans text-ui">
                                                <div>
                                                    <dt className="text-caption font-semibold text-slate uppercase tracking-wide">What It Is</dt>
                                                    <dd className="text-charcoal mt-1">{capability.whatItIs}</dd>
                                                </div>

                                                <div className="bg-paper p-3 border-l-2 border-editorial-red">
                                                    <dt className="text-caption font-semibold text-editorial-red uppercase tracking-wide">New Capability</dt>
                                                    <dd className="text-charcoal mt-1">{capability.newCapability}</dd>
                                                </div>

                                                <div>
                                                    <dt className="text-caption font-semibold text-slate uppercase tracking-wide">Who Should Care</dt>
                                                    <dd className="text-charcoal mt-1">{capability.whoShouldCare}</dd>
                                                </div>

                                                <div className="bg-paper p-3 border-l-2 border-editorial-sage">
                                                    <dt className="text-caption font-semibold text-editorial-sage uppercase tracking-wide">How to Get Started</dt>
                                                    <dd className="text-charcoal mt-1 whitespace-pre-wrap">{capability.howToGetStarted}</dd>
                                                </div>

                                                <div>
                                                    <dt className="text-caption font-semibold text-slate uppercase tracking-wide">Expected Impact</dt>
                                                    <dd className="text-charcoal mt-1">{capability.expectedImpact}</dd>
                                                </div>
                                            </dl>

                                            <div className="flex gap-3 mt-6 pt-4 border-t border-border-subtle">
                                                {capability.resource && (
                                                    <a
                                                        href={capability.resource}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="editorial-link font-sans text-ui"
                                                    >
                                                        Learn More
                                                    </a>
                                                )}
                                                <button
                                                    onClick={() => handleAddTrendingTopic(capability.title)}
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
                        )}

                        {/* Essential Tools */}
                        {compellingContent.essentialTools?.length > 0 && (
                            <div>
                                <h3 className="font-sans text-overline text-slate uppercase tracking-widest mb-4">
                                    Essential Tools
                                </h3>
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
                                            {tool.link && (
                                                <a
                                                    href={tool.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-sans text-ui text-editorial-navy hover:text-ink transition-colors flex-shrink-0"
                                                >
                                                    Visit
                                                </a>
                                            )}
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
            <InspirationSourcesPanel
                sources={trendingSources}
                isLoading={isFetchingTrending}
            />

            {/* Section 3: Select Topics */}
            <section className="bg-paper border border-border-subtle p-8">
                <div className="flex items-baseline gap-3 mb-4">
                    <span className="text-overline text-slate uppercase tracking-widest font-sans">Step 3</span>
                    <h2 className="font-display text-h3 text-ink">Select Topics</h2>
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

                {/* Suggestions */}
                {suggestedTopics.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-border-subtle">
                        <h4 className="font-sans text-overline text-slate uppercase tracking-widest mb-3">
                            Suggestions
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {suggestedTopics.map((suggestion, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSelectSuggestedTopic(suggestion)}
                                    className="font-sans text-ui text-charcoal bg-pearl hover:bg-border-subtle border border-border-subtle px-3 py-1.5 transition-colors"
                                >
                                    {suggestion}
                                </button>
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
        </motion.div>
    );
};
