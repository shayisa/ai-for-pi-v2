import React from 'react';
import { HistoryPanel } from '../components/HistoryPanel';
import { HistoryItem } from '../types';

interface HistoryContentPageProps {
    history: HistoryItem[];
    onLoad: (item: HistoryItem) => void;
    onClear: () => void;
}

export const HistoryContentPage: React.FC<HistoryContentPageProps> = ({ history, onLoad, onClear }) => {
    return (
        <div className="space-y-8">
            <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-light-blue to-accent-salmon mb-6">
                Generation History
            </h1>
            <HistoryPanel
                history={history}
                onLoad={onLoad}
                onClear={onClear}
            />
        </div>
    );
};