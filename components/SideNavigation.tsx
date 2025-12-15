import React from 'react';
import { motion } from 'framer-motion';
import { ActivePage } from '../App';

interface SideNavigationProps {
    activePage: ActivePage;
    setActivePage: (page: ActivePage) => void;
}

interface NavSection {
    label: string;
    items: { id: string; label: string; description?: string }[];
}

export const SideNavigation: React.FC<SideNavigationProps> = ({ activePage, setActivePage }) => {
    const navSections: NavSection[] = [
        {
            label: 'Create',
            items: [
                { id: 'discoverTopics', label: 'Discover Topics', description: 'Find trending content' },
                { id: 'toneAndVisuals', label: 'Tone & Visuals', description: 'Voice & visual direction' },
                { id: 'generateNewsletter', label: 'Generate', description: 'Create newsletter' },
            ]
        },
        {
            label: 'Manage',
            items: [
                { id: 'history', label: 'History', description: 'Past newsletters' },
                { id: 'subscriberManagement', label: 'Subscribers', description: 'Mailing lists' },
                { id: 'logs', label: 'Logs', description: 'System activity' },
            ]
        }
    ];

    return (
        <nav className="w-56 bg-pearl border-r border-border-subtle sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
            <div className="py-6">
                {navSections.map((section, sectionIndex) => (
                    <div key={section.label} className={sectionIndex > 0 ? 'mt-8' : ''}>
                        {/* Section Label */}
                        <div className="px-5 mb-3">
                            <span className="text-overline text-slate uppercase tracking-widest font-sans font-semibold">
                                {section.label}
                            </span>
                        </div>

                        {/* Section Items */}
                        <ul className="space-y-0.5">
                            {section.items.map((item) => {
                                const isActive = activePage === item.id;
                                return (
                                    <li key={item.id}>
                                        <button
                                            onClick={() => setActivePage(item.id as ActivePage)}
                                            className={`
                                                relative w-full text-left px-5 py-2.5
                                                font-sans text-ui transition-colors duration-150
                                                ${isActive
                                                    ? 'text-ink font-semibold bg-paper'
                                                    : 'text-charcoal hover:text-ink hover:bg-paper/50'
                                                }
                                            `}
                                        >
                                            {/* Active Indicator */}
                                            {isActive && (
                                                <motion.div
                                                    layoutId="activeNavIndicator"
                                                    className="absolute left-0 top-0 bottom-0 w-0.5 bg-editorial-red"
                                                    initial={false}
                                                    transition={{
                                                        type: 'spring',
                                                        stiffness: 500,
                                                        damping: 35
                                                    }}
                                                />
                                            )}

                                            <span className="block">{item.label}</span>
                                            {item.description && !isActive && (
                                                <span className="block text-caption text-silver mt-0.5">
                                                    {item.description}
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 px-5 py-4 border-t border-border-subtle bg-pearl">
                <p className="text-caption text-silver font-sans">
                    Powered by Claude AI
                </p>
            </div>
        </nav>
    );
};
