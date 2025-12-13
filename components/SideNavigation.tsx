import React from 'react';
import { ActivePage } from '../App';
import { SparklesIcon, SearchIcon, TypeIcon, ImageIcon, HistoryIcon, UsersIcon } from './IconComponents';

interface SideNavigationProps {
    activePage: ActivePage;
    setActivePage: (page: ActivePage) => void;
}

export const SideNavigation: React.FC<SideNavigationProps> = ({ activePage, setActivePage }) => {
    const navItems = [
        { id: 'discoverTopics', label: 'Discover Topics', icon: SearchIcon },
        { id: 'defineTone', label: 'Define Tone', icon: TypeIcon },
        { id: 'imageStyle', label: 'Image Style', icon: ImageIcon },
        { id: 'generateNewsletter', label: 'Generate Newsletter', icon: SparklesIcon },
        { id: 'history', label: 'History', icon: HistoryIcon },
        { id: 'subscriberManagement', label: 'Subscribers', icon: UsersIcon },
    ];

    return (
        <nav className="w-64 bg-gray-50 backdrop-blur-md border-r border-border-light p-4 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
            <ul className="space-y-2">
                {navItems.map((item) => {
                    const IconComponent = item.icon;
                    return (
                        <li key={item.id}>
                            <button
                                onClick={() => setActivePage(item.id as ActivePage)}
                                className={`flex items-center gap-3 w-full p-3 rounded-lg transition-colors duration-200
                                    ${activePage === item.id 
                                        ? 'bg-accent-salmon text-white shadow-md' 
                                        : 'text-secondary-text hover:bg-gray-100 hover:text-primary-text'
                                    }`}
                            >
                                <IconComponent className="h-5 w-5" />
                                <span className="font-semibold">{item.label}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
};