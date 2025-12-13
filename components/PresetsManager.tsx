import React, { useState } from 'react';
import type { Preset } from '../types';
import { SaveIcon, TrashIcon, CloudIcon, RefreshIcon } from './IconComponents';

interface PresetsManagerProps {
    presets: Preset[];
    onSave: (name: string) => void;
    onLoad: (preset: Preset) => void;
    onDelete: (name: string) => void;
    onSyncToCloud?: () => Promise<void>;
    onLoadFromCloud?: () => Promise<void>;
    isAuthenticated?: boolean;
}

export const PresetsManager: React.FC<PresetsManagerProps> = ({
    presets,
    onSave,
    onLoad,
    onDelete,
    onSyncToCloud,
    onLoadFromCloud,
    isAuthenticated
}) => {
    const [presetName, setPresetName] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSaveClick = () => {
        if (presetName.trim()) {
            onSave(presetName.trim());
            setPresetName('');
        }
    };

    const handleSyncToCloud = async () => {
        if (!onSyncToCloud) return;
        setIsSyncing(true);
        setSyncMessage(null);
        try {
            await onSyncToCloud();
            setSyncMessage({ type: 'success', text: 'Presets saved to Google Sheets!' });
            setTimeout(() => setSyncMessage(null), 3000);
        } catch (error) {
            setSyncMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Failed to sync presets'
            });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleLoadFromCloud = async () => {
        if (!onLoadFromCloud) return;
        setIsSyncing(true);
        setSyncMessage(null);
        try {
            await onLoadFromCloud();
            setSyncMessage({ type: 'success', text: 'Presets loaded from Google Sheets!' });
            setTimeout(() => setSyncMessage(null), 3000);
        } catch (error) {
            setSyncMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Failed to load presets'
            });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-border-light">
            <h3 className="text-lg font-semibold text-primary-text mb-3">Configuration Presets</h3>
            <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Enter preset name..."
                    className="flex-grow bg-white border border-border-light rounded-lg py-2 px-3 focus:ring-2 focus:ring-accent-yellow focus:outline-none transition duration-200 text-primary-text"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveClick()}
                />
                <button
                    onClick={handleSaveClick}
                    disabled={!presetName.trim()}
                    className="flex items-center justify-center gap-2 bg-accent-yellow hover:bg-opacity-90 disabled:bg-accent-yellow/40 disabled:text-secondary-text disabled:cursor-not-allowed text-primary-text font-semibold py-2 px-4 rounded-lg transition duration-200"
                >
                    <SaveIcon className="h-4 w-4" />
                    <span>Save</span>
                </button>
            </div>

            {/* Google Sheets Sync Buttons */}
            {isAuthenticated && (onSyncToCloud || onLoadFromCloud) && (
                <div className="flex gap-2 mb-4">
                    {onSyncToCloud && (
                        <button
                            onClick={handleSyncToCloud}
                            disabled={isSyncing}
                            className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition duration-200 text-sm"
                        >
                            <CloudIcon className="h-4 w-4" />
                            <span>{isSyncing ? 'Saving...' : 'Save to Cloud'}</span>
                        </button>
                    )}
                    {onLoadFromCloud && (
                        <button
                            onClick={handleLoadFromCloud}
                            disabled={isSyncing}
                            className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition duration-200 text-sm"
                        >
                            <RefreshIcon className="h-4 w-4" />
                            <span>{isSyncing ? 'Loading...' : 'Load from Cloud'}</span>
                        </button>
                    )}
                </div>
            )}

            {/* Sync Status Message */}
            {syncMessage && (
                <div
                    className={`mb-4 p-3 rounded-lg text-sm font-medium ${
                        syncMessage.type === 'success'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                >
                    {syncMessage.text}
                </div>
            )}

            {presets.length > 0 && (
                 <div className="space-y-2">
                    {presets.map((preset) => (
                        <div key={preset.name} className="flex items-center justify-between gap-2 p-2 bg-gray-100 rounded-md border border-border-light">
                            <span className="text-sm font-medium text-primary-text">{preset.name}</span>
                            <div className="flex items-center gap-2">
                                <button onClick={() => onLoad(preset)} className="text-sm text-accent-light-blue hover:underline">Load</button>
                                <button onClick={() => onDelete(preset.name)} className="text-secondary-text hover:text-accent-salmon">
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};