import React from 'react';
import { ExternalLinkIcon } from './IconComponents';

export interface TrendingSource {
    id: string;
    title: string;
    url: string;
    author?: string;
    publication?: string;
    date?: string;
    category: 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev';
    summary?: string;
}

interface InspirationSourcesPanelProps {
    sources: TrendingSource[];
    isLoading?: boolean;
}

const categoryColors: Record<string, { bg: string; text: string; label: string }> = {
    hackernews: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'HackerNews' },
    arxiv: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'ArXiv' },
    github: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'GitHub' },
    reddit: { bg: 'bg-red-100', text: 'text-red-700', label: 'Reddit' },
    dev: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Dev.to' },
};

export const InspirationSourcesPanel: React.FC<InspirationSourcesPanelProps> = ({
    sources,
    isLoading = false,
}) => {
    if (isLoading) {
        return (
            <div className="bg-white rounded-xl border border-border-light p-6">
                <h3 className="text-lg font-semibold text-primary-text mb-4">Inspiration Sources</h3>
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="animate-pulse h-12 bg-gray-200 rounded"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (!sources || sources.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-border-light p-6">
                <h3 className="text-lg font-semibold text-primary-text mb-4">Inspiration Sources</h3>
                <p className="text-secondary-text text-sm">No sources available. Click refresh to fetch trending topics.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-border-light p-6">
            <h3 className="text-lg font-semibold text-primary-text mb-4">Inspiration Sources</h3>
            <p className="text-xs text-secondary-text mb-4">
                Fresh trending topics from {sources.length} sources across AI communities
            </p>

            <div className="space-y-3 max-h-96 overflow-y-auto">
                {sources.map((source) => {
                    const colors = categoryColors[source.category];
                    return (
                        <a
                            key={source.id}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-3 rounded-lg border border-border-light hover:bg-gray-50 transition group"
                        >
                            <div className="flex items-start gap-3">
                                {/* Category Badge */}
                                <div className={`${colors.bg} ${colors.text} px-2 py-1 rounded text-xs font-medium flex-shrink-0 mt-0.5`}>
                                    {colors.label}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-primary-text group-hover:text-accent-light-blue truncate">
                                        {source.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {source.author && (
                                            <span className="text-xs text-secondary-text">{source.author}</span>
                                        )}
                                        {source.date && (
                                            <span className="text-xs text-secondary-text">• {source.date}</span>
                                        )}
                                    </div>
                                    {source.summary && (
                                        <p className="text-xs text-secondary-text mt-1 line-clamp-1">
                                            {source.summary}
                                        </p>
                                    )}
                                </div>

                                {/* External Link Icon */}
                                <ExternalLinkIcon className="h-4 w-4 text-secondary-text flex-shrink-0 group-hover:text-accent-light-blue" />
                            </div>
                        </a>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-4 border-t border-border-light">
                <p className="text-xs text-secondary-text">
                    Click any source to explore the full article. These are refreshed each time you click "Refresh Trending Topics".
                </p>
            </div>
        </div>
    );
};
