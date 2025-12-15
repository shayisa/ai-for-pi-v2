import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLinkIcon } from './IconComponents';
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
                    return (
                        <motion.a
                            key={source.id}
                            variants={staggerItem}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block py-4 group hover:bg-pearl transition-colors -mx-6 px-6"
                        >
                            <div className="flex items-start gap-4">
                                {/* Category Badge */}
                                <span className="font-sans text-caption text-slate bg-pearl px-2 py-1 flex-shrink-0 mt-0.5">
                                    {style.label}
                                </span>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-sans text-ui font-medium text-ink group-hover:text-editorial-navy transition-colors line-clamp-2">
                                        {source.title}
                                    </p>
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

                                {/* External Link Icon */}
                                <ExternalLinkIcon className="h-4 w-4 text-silver flex-shrink-0 group-hover:text-editorial-navy transition-colors" />
                            </div>
                        </motion.a>
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
