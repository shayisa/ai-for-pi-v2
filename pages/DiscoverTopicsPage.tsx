import React from 'react';
import type { TrendingTopic } from '../types';
import { InspirationSources } from '../components/InspirationSources';
import { InspirationSourcesPanel, TrendingSource } from '../components/InspirationSourcesPanel';
import { Spinner } from '../components/Spinner';
import { PlusIcon, RefreshIcon, SearchIcon, LightbulbIcon, XIcon } from '../components/IconComponents';

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
}) => {
    const isActionLoading = !!loading || isGeneratingTopics;

    return (
        <div className="space-y-8">
            <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-light-blue to-accent-salmon mb-6">
                Discover & Select Topics
            </h1>

            {/* Audience Selection - Kept here as it influences trending topics */}
            <div className="mb-8 bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-border-light">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-muted-blue to-accent-salmon mb-4">
                    1. Select Target Audience
                </h2>
                <p className="text-secondary-text mb-6">Choose your target audience to tailor content and generate relevant trending topics and suggestions.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {Object.entries(audienceOptions).map(([key, { label, description }]) => (
                        <label key={key} htmlFor={`audience-${key}`} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition cursor-pointer border border-transparent has-[:checked]:border-accent-yellow">
                            <input
                                type="checkbox"
                                id={`audience-${key}`}
                                checked={selectedAudience[key]}
                                onChange={() => handleAudienceChange(key)}
                                className="mt-1 h-4 w-4 rounded border-gray-300 bg-white text-accent-salmon focus:ring-accent-salmon"
                            />
                            <div>
                                <span className="font-medium text-primary-text">{label}</span>
                                <p className="text-sm text-secondary-text">{description}</p>
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            {/* What's New & Trending in AI - Rich Compelling Content */}
            <div className="mb-8 bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-border-light">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-salmon to-accent-muted-blue mb-4 flex items-center gap-2">
                    <LightbulbIcon className="h-6 w-6" />
                    What's New & Trending in AI?
                </h2>
                <p className="text-secondary-text mb-6">Discover the latest and most impactful AI capabilities tailored to your audience. Explore actionable insights and essential tools to level up your AI game.</p>
                <div className="mb-6">
                    <button
                        onClick={fetchTrendingContent}
                        disabled={isFetchingTrending || !hasSelectedAudience}
                        className="flex items-center justify-center gap-2 text-sm bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-secondary-text disabled:cursor-not-allowed text-primary-text font-semibold py-2 px-4 rounded-lg transition duration-200"
                    >
                        <RefreshIcon className="h-4 w-4" />
                        <span>{isFetchingTrending ? 'Fetching...' : 'Update Latest Trend'}</span>
                    </button>
                </div>

                {isFetchingTrending ? (
                    <div className="flex items-center gap-3 text-secondary-text">
                        <Spinner />
                        <span>Fetching latest updates for selected audience...</span>
                    </div>
                ) : compellingContent ? (
                    <div className="space-y-8">
                        {/* Actionable AI Capabilities Section */}
                        {compellingContent.actionableCapabilities && compellingContent.actionableCapabilities.length > 0 && (
                            <div>
                                <h3 className="text-xl font-bold text-accent-muted-blue mb-4">🚀 Actionable AI Capabilities</h3>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {compellingContent.actionableCapabilities.map((capability, idx) => (
                                        <div key={idx} className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-lg border border-border-light hover:border-accent-light-blue transition-all">
                                            <h4 className="font-bold text-lg text-accent-muted-blue mb-3">{capability.title}</h4>

                                            <div className="space-y-3 text-sm">
                                                <div>
                                                    <p className="font-semibold text-gray-700">What It Is:</p>
                                                    <p className="text-secondary-text">{capability.whatItIs}</p>
                                                </div>

                                                <div className="bg-white bg-opacity-50 p-2 rounded">
                                                    <p className="font-semibold text-accent-salmon">✨ New Capability:</p>
                                                    <p className="text-secondary-text">{capability.newCapability}</p>
                                                </div>

                                                <div>
                                                    <p className="font-semibold text-gray-700">Who Should Care:</p>
                                                    <p className="text-secondary-text">{capability.whoShouldCare}</p>
                                                </div>

                                                <div className="bg-green-50 p-2 rounded border border-green-200">
                                                    <p className="font-semibold text-green-700">🎯 How to Get Started:</p>
                                                    <p className="text-secondary-text whitespace-pre-wrap">{capability.howToGetStarted}</p>
                                                </div>

                                                <div>
                                                    <p className="font-semibold text-gray-700">Expected Impact:</p>
                                                    <p className="text-secondary-text">{capability.expectedImpact}</p>
                                                </div>

                                                {capability.resource && (
                                                    <div className="pt-2 flex gap-2">
                                                        <a
                                                            href={capability.resource}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex-1 text-center bg-accent-light-blue hover:bg-blue-600 text-white text-sm font-semibold py-2 px-3 rounded-lg transition duration-200"
                                                        >
                                                            Learn More →
                                                        </a>
                                                        <button
                                                            onClick={() => handleAddTrendingTopic(capability.title)}
                                                            className="flex items-center justify-center gap-1 text-sm bg-gray-200 hover:bg-gray-300 text-primary-text font-semibold py-2 px-3 rounded-lg transition duration-200"
                                                        >
                                                            <PlusIcon className="h-4 w-4" />
                                                            Add to Topics
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Essential Tools & Resources Section */}
                        {compellingContent.essentialTools && compellingContent.essentialTools.length > 0 && (
                            <div>
                                <h3 className="text-xl font-bold text-accent-muted-blue mb-4">🛠️ Essential Tools & Resources</h3>
                                <div className="space-y-3">
                                    {compellingContent.essentialTools.map((tool, idx) => (
                                        <div key={idx} className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-border-light hover:border-accent-salmon transition-all">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-lg text-accent-muted-blue mb-2">{tool.name}</h4>
                                                    <p className="text-secondary-text text-sm mb-2">{tool.description}</p>
                                                    <p className="text-xs bg-yellow-50 text-yellow-800 p-2 rounded-lg border border-yellow-200">
                                                        <span className="font-semibold">Why Now: </span>{tool.whyNow}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2 flex-shrink-0">
                                                    {tool.link && (
                                                        <a
                                                            href={tool.link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="bg-accent-salmon hover:bg-red-600 text-white text-sm font-semibold py-2 px-4 rounded-lg transition duration-200 whitespace-nowrap"
                                                        >
                                                            Visit →
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : error ? (
                    <div>
                        <p className="text-secondary-text mb-4">{error.message}</p>
                        {error.onRetry === fetchTrendingContent && (
                            <button
                                onClick={error.onRetry}
                                className="flex items-center justify-center gap-2 text-sm bg-red-100 hover:bg-red-200 text-red-600 font-semibold py-2 px-3 rounded-lg transition duration-200"
                            >
                                <RefreshIcon className="h-4 w-4" />
                                <span>Retry Fetching Trending Topics</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <p className="text-secondary-text">
                        {hasSelectedAudience
                            ? "Click 'Update Latest Trend' to discover the latest AI capabilities and tools tailored to your audience."
                            : "Please select an audience to see trending topics above."}
                    </p>
                )}
            </div>

            {/* AI Inspiration Sources - Real trending data from web */}
            <InspirationSourcesPanel
                sources={trendingSources}
                isLoading={isFetchingTrending}
            />

            {/* Set Newsletter Topic(s) */}
            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-border-light">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-light-blue to-accent-muted-blue mb-4 flex items-center gap-2">
                    <SearchIcon className="h-6 w-6" />
                    2. Set Newsletter Topic(s)
                </h2>
                <p className="text-secondary-text mb-6">Add specific topics for your newsletter. You can type them manually or get AI suggestions.</p>
                 <div className="flex flex-wrap gap-2 mb-3 empty:mb-0">
                    {selectedTopics.map((topic, index) => (
                        <div key={index} className="flex items-center gap-2 bg-gray-200 text-primary-text text-sm font-medium px-3 py-1 rounded-full">
                            <span>{topic}</span>
                            <button onClick={() => handleRemoveTopic(index)} className="text-secondary-text hover:text-primary-text">
                                <XIcon className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-grow">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            value={customTopic}
                            onChange={(e) => setCustomTopic(e.target.value)}
                            placeholder="Add a custom topic..."
                            className="w-full bg-gray-50 border border-border-light rounded-lg py-2 pl-10 pr-4 focus:ring-2 focus:ring-accent-light-blue focus:outline-none transition duration-200 text-primary-text"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()}
                            disabled={isActionLoading}
                        />
                    </div>
                    <button onClick={handleAddTopic} disabled={!customTopic.trim() || isActionLoading} className="p-2 bg-gray-200 hover:bg-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition text-primary-text">
                        <PlusIcon className="h-5 w-5"/>
                    </button>
                </div>
                 <div className="mt-3">
                    <button
                        onClick={handleGenerateSuggestions}
                        disabled={isActionLoading || !hasSelectedAudience}
                        className="flex items-center justify-center gap-2 text-sm bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-secondary-text disabled:cursor-not-allowed text-primary-text font-semibold py-2 px-4 rounded-lg transition duration-200"
                    >
                        <LightbulbIcon className="h-4 w-4" />
                        <span>{isGeneratingTopics ? 'Suggesting...' : 'Suggest Topics'}</span>
                    </button>
                </div>
                {suggestedTopics.length > 0 && (
                    <div className="mt-6 border-t border-border-light pt-6">
                         <h4 className="text-sm font-semibold text-secondary-text mb-2">Click to add a suggestion:</h4>
                         <div className="flex flex-wrap gap-2" aria-label="Suggested topics">
                            {suggestedTopics.map((suggestion, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSelectSuggestedTopic(suggestion)}
                                    className="bg-gray-50 hover:bg-gray-100 border border-border-light text-primary-text text-sm px-3 py-1 rounded-full transition duration-200"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {error && error.onRetry === handleGenerateSuggestions && (
                    <div className="mt-4 flex justify-center">
                        <button
                            onClick={error.onRetry}
                            className="flex items-center justify-center gap-2 text-sm bg-red-100 hover:bg-red-200 text-red-600 font-semibold py-2 px-3 rounded-lg transition duration-200"
                        >
                            <RefreshIcon className="h-4 w-4" />
                            <span>Retry Suggestions</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};