import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Preset } from '../types';
import { SaveIcon, TrashIcon, CloudIcon, RefreshIcon } from './IconComponents';
import { staggerContainer, staggerItem } from '../utils/animations';

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
            setSyncMessage({ type: 'success', text: 'Presets saved to Google Sheets' });
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
            setSyncMessage({ type: 'success', text: 'Presets loaded from Google Sheets' });
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
        <div className="bg-paper border border-border-subtle p-6">
            {/* Header */}
            <div className="flex items-baseline gap-3 mb-4">
                <span className="font-sans text-overline text-slate uppercase tracking-widest">Save</span>
                <h3 className="font-display text-h3 text-ink">Configuration Presets</h3>
            </div>
            <p className="font-serif text-body text-charcoal mb-6">
                Save your current settings as a reusable preset.
            </p>

            {/* Save New Preset */}
            <div className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Enter preset name..."
                    className="flex-grow bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveClick()}
                />
                <button
                    onClick={handleSaveClick}
                    disabled={!presetName.trim()}
                    className="flex items-center justify-center gap-2 bg-ink text-paper font-sans text-ui px-4 py-2 hover:bg-charcoal transition-colors disabled:bg-silver disabled:cursor-not-allowed"
                >
                    <SaveIcon className="h-4 w-4" />
                    <span>Save</span>
                </button>
            </div>

            {/* Google Sheets Sync Buttons */}
            {isAuthenticated && (onSyncToCloud || onLoadFromCloud) && (
                <div className="flex gap-3 mb-6 pb-6 border-b border-border-subtle">
                    {onSyncToCloud && (
                        <button
                            onClick={handleSyncToCloud}
                            disabled={isSyncing}
                            className="flex items-center justify-center gap-2 border border-editorial-navy text-editorial-navy font-sans text-ui px-4 py-2 hover:bg-editorial-navy hover:text-paper transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <CloudIcon className="h-4 w-4" />
                            <span>{isSyncing ? 'Saving...' : 'Save to Cloud'}</span>
                        </button>
                    )}
                    {onLoadFromCloud && (
                        <button
                            onClick={handleLoadFromCloud}
                            disabled={isSyncing}
                            className="flex items-center justify-center gap-2 border border-ink text-ink font-sans text-ui px-4 py-2 hover:bg-ink hover:text-paper transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshIcon className="h-4 w-4" />
                            <span>{isSyncing ? 'Loading...' : 'Load from Cloud'}</span>
                        </button>
                    )}
                </div>
            )}

            {/* Sync Status Message */}
            <AnimatePresence>
                {syncMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`mb-6 p-3 font-sans text-ui border-l-2 ${
                            syncMessage.type === 'success'
                                ? 'bg-pearl text-ink border-ink'
                                : 'bg-red-50 text-editorial-red border-editorial-red'
                        }`}
                    >
                        {syncMessage.text}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Presets List */}
            {presets.length > 0 ? (
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="space-y-2"
                >
                    <p className="font-sans text-caption text-slate mb-3">
                        {presets.length} {presets.length === 1 ? 'preset' : 'presets'} saved
                    </p>
                    {presets.map((preset) => (
                        <motion.div
                            key={preset.name}
                            variants={staggerItem}
                            className="flex items-center justify-between gap-3 py-3 px-4 bg-pearl border border-border-subtle group hover:border-ink transition-colors"
                        >
                            <div className="flex flex-col gap-1">
                                <span className="font-sans text-ui font-medium text-ink">{preset.name}</span>
                                {preset.settings.personaId && (
                                    <span className="font-sans text-caption text-slate">
                                        with persona
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => onLoad(preset)}
                                    className="font-sans text-caption text-editorial-navy hover:underline"
                                >
                                    Load
                                </button>
                                <button
                                    onClick={() => onDelete(preset.name)}
                                    className="text-slate hover:text-editorial-red transition-colors"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            ) : (
                <p className="font-sans text-ui text-slate text-center py-8">
                    No presets saved yet. Create one above.
                </p>
            )}
        </div>
    );
};
