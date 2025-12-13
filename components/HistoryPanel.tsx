import React, { useState } from 'react';
import type { HistoryItem } from '../types';
import { HistoryIcon, ChevronDownIcon, TrashIcon } from './IconComponents';

interface HistoryPanelProps {
    history: HistoryItem[];
    onLoad: (item: HistoryItem) => void;
    onClear: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onLoad, onClear }) => {

    if (history.length === 0) {
        return <p className="text-center text-secondary-text mt-8">No generation history yet. Generate a newsletter to see it here!</p>;
    }

    return (
        <div id="history-panel-content" className="p-4 md:p-6 bg-white rounded-2xl shadow-lg border border-border-light">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-light-blue to-accent-salmon flex items-center gap-2">
                    <HistoryIcon className="h-6 w-6" />
                    Generation History
                </h2>
                <button 
                    onClick={onClear} 
                    className="flex items-center gap-2 text-sm text-secondary-text hover:text-accent-salmon font-semibold py-2 px-3 rounded-lg transition duration-200"
                >
                    <TrashIcon className="h-4 w-4"/>
                    Clear History
                </button>
            </div>
            <p className="text-secondary-text mb-6">Review and reload previous newsletters.</p>
            <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {history.map((item) => (
                    <li key={item.id}>
                        <button
                            onClick={() => onLoad(item)}
                            className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-lg border border-border-light hover:border-accent-light-blue"
                        >
                            <p className="font-semibold text-primary-text truncate">{item.subject}</p>
                            <p className="text-xs text-secondary-text">{item.date}</p>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};