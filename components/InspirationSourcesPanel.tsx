import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLinkIcon, BookmarkIcon, BookmarkSolidIcon } from './IconComponents';
import { staggerContainer, staggerItem, skeletonPulse } from '../utils/animations';

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
    onSaveSource?: (source: TrendingSource) => void;
    savedSourceUrls?: Set<string>;
}

const categoryStyles: Record<string, { label: string }> = {
    hackernews: { label: 'HN' },
    arxiv: { label: 'ArXiv' },
    github: { label: 'GitHub' },
    reddit: { label: 'Reddit' },
    dev: { label: 'Dev.to' },
};

export const InspirationSourcesPanel: React.FC<InspirationSourcesPanelProps> = ({
    sources,
    isLoading = false,
    onSaveSource,
    savedSourceUrls,
}) => {
    if (isLoading) {
        return (
            <div className="bg-paper border border-border-subtle p-6">
                <div className="flex items-baseline gap-3 mb-4">
                    <span className="font-sans text-overline text-slate uppercase tracking-widest">Trending</span>
                    <h3 className="font-display text-h3 text-ink">Inspiration Sources</h3>
                </div>
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <motion.div
                            key={i}
                            variants={skeletonPulse}
                            initial="initial"
                            animate="animate"
                            className="h-16 bg-pearl"
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (!sources || sources.length === 0) {
        return (
            <div className="bg-paper border border-border-subtle p-6">
                <div className="flex items-baseline gap-3 mb-4">
                    <span className="font-sans text-overline text-slate uppercase tracking-widest">Trending</span>
                    <h3 className="font-display text-h3 text-ink">Inspiration Sources</h3>
                </div>
                <p className="font-serif text-body text-slate text-center py-8">
                    No sources available. Click refresh to fetch trending topics.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-paper border border-border-subtle p-6">
            {/* Header */}
            <div className="flex items-baseline gap-3 mb-4">
                <span className="font-sans text-overline text-slate uppercase tracking-widest">Trending</span>
                <h3 className="font-display text-h3 text-ink">Inspiration Sources</h3>
            </div>
            <p className="font-serif text-body text-charcoal mb-6">
                Fresh topics from {sources.length} sources across AI communities
            </p>

            {/* Sources List */}
            <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="divide-y divide-border-subtle max-h-96 overflow-y-auto"
            >
                {sources.map((source) => {
                    const style = categoryStyles[source.category];
                    const isSaved = savedSourceUrls?.has(source.url) || false;
                    return (
                        <motion.div
                            key={source.id}
                            variants={staggerItem}
                            className="py-4 group hover:bg-pearl transition-colors -mx-6 px-6"
                        >
                            <div className="flex items-start gap-4">
                                {/* Category Badge */}
                                <span className="font-sans text-caption text-slate bg-pearl px-2 py-1 flex-shrink-0 mt-0.5">
                                    {style.label}
                                </span>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-sans text-ui font-medium text-ink hover:text-editorial-navy transition-colors line-clamp-2 block"
                                    >
                                        {source.title}
                                    </a>
                                    <div className="flex items-center gap-2 mt-1">
                                        {source.author && (
                                            <span className="font-sans text-caption text-slate">{source.author}</span>
                                        )}
                                        {source.date && (
                                            <span className="font-sans text-caption text-silver">{source.date}</span>
                                        )}
                                    </div>
                                    {source.summary && (
                                        <p className="font-serif text-caption text-slate mt-1 line-clamp-1">
                                            {source.summary}
                                        </p>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {/* Save Button */}
                                    {onSaveSource && (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (!isSaved) {
                                                    onSaveSource(source);
                                                }
                                            }}
                                            className={`p-1 transition-colors ${
                                                isSaved
                                                    ? 'text-editorial-navy cursor-default'
                                                    : 'text-slate hover:text-editorial-navy'
                                            }`}
                                            title={isSaved ? 'Saved to library' : 'Save to library'}
                                            disabled={isSaved}
                                        >
                                            {isSaved ? (
                                                <BookmarkSolidIcon className="h-4 w-4" />
                                            ) : (
                                                <BookmarkIcon className="h-4 w-4" />
                                            )}
                                        </button>
                                    )}
                                    {/* External Link Icon */}
                                    <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1 text-silver hover:text-editorial-navy transition-colors"
                                        title="Open in new tab"
                                    >
                                        <ExternalLinkIcon className="h-4 w-4" />
                                    </a>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-border-subtle">
                <p className="font-sans text-caption text-slate">
                    Click any source to explore the full article. Refreshed each time you click "Refresh Trending Topics".
                </p>
            </div>
        </div>
    );
};
