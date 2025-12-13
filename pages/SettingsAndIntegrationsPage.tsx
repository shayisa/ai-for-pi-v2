import React, { useState, useEffect } from 'react';
import { XIcon, GoogleIcon, CheckIcon, DriveIcon, SheetIcon, SendIcon, SettingsIcon } from '../components/IconComponents';
import type { GoogleSettings, GapiAuthData, Newsletter, SubscriberList } from '../types';
import * as googleApi from '../services/googleApiService';

interface SettingsAndIntegrationsPageProps {
    googleSettings: GoogleSettings | null;
    onSaveSettings: (settings: GoogleSettings) => void;
    authData: GapiAuthData | null;
    onSignIn: () => void;
    onSignOut: () => void;
    newsletter: Newsletter | null; // Passed to enable workflow actions
    selectedTopics: string[]; // Passed for logging to sheet/gmail
    workflowStatus: { message: string; type: 'success' | 'error' } | null;
    handleWorkflowAction: (action: 'drive' | 'sheet' | 'gmail') => Promise<void>;
    isGoogleApiInitialized: boolean;
    onLoadNewsletter?: (newsletter: Newsletter, topics: string[]) => void; // For loading from Drive
    subscriberLists: SubscriberList[];
    selectedEmailLists: string[];
    onSelectedEmailListsChange: (listIds: string[]) => void;
}

export const SettingsAndIntegrationsPage: React.FC<SettingsAndIntegrationsPageProps> = ({
    googleSettings,
    onSaveSettings,
    authData,
    onSignIn,
    onSignOut,
    newsletter,
    selectedTopics,
    workflowStatus,
    handleWorkflowAction,
    isGoogleApiInitialized,
    onLoadNewsletter,
    subscriberLists,
    selectedEmailLists,
    onSelectedEmailListsChange,
}) => {
    const [driveFolderName, setDriveFolderName] = useState(googleSettings?.driveFolderName || 'AI Newsletters');
    const [logSheetName, setLogSheetName] = useState(googleSettings?.logSheetName || 'Newsletter Log');
    const [subscribersSheetName, setSubscribersSheetName] = useState(googleSettings?.subscribersSheetName || 'Newsletter Subscribers');
    const [showLoadModal, setShowLoadModal] = useState(false);
    const [driveNewsletters, setDriveNewsletters] = useState<any[]>([]);
    const [isLoadingFromDrive, setIsLoadingFromDrive] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [selectedLoadFile, setSelectedLoadFile] = useState<any | null>(null);
    const [confirmDialogAction, setConfirmDialogAction] = useState<'view' | 'email' | 'sheet' | null>(null);
    const [showListSelectionModal, setShowListSelectionModal] = useState(false);
    const [listSelectionMode, setListSelectionMode] = useState<'all' | 'single' | 'multiple'>('all');
    const [singleSelectedList, setSingleSelectedList] = useState<string>('');
    const [multipleSelectedLists, setMultipleSelectedLists] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (googleSettings) {
            setDriveFolderName(googleSettings.driveFolderName);
            setLogSheetName(googleSettings.logSheetName);
            setSubscribersSheetName(googleSettings.subscribersSheetName);
        }
    }, [googleSettings]);

    // Reset list selection when lists are loaded/changed
    useEffect(() => {
        setListSelectionMode('all');
        setSingleSelectedList('');
        setMultipleSelectedLists(new Set());
    }, [subscriberLists]);

    const handleOpenLoadModal = async () => {
        setShowLoadModal(true);
        setIsLoadingFromDrive(true);
        setLoadError(null);
        setDriveNewsletters([]);

        try {
            const newsletters = await googleApi.listNewslettersFromDrive(driveFolderName);
            setDriveNewsletters(newsletters.sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()));
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'Failed to load newsletters from Drive');
        } finally {
            setIsLoadingFromDrive(false);
        }
    };

    const handleLoadNewsletter = async (fileId: string) => {
        setIsLoadingFromDrive(true);
        try {
            const { newsletter: loadedNewsletter, topics } = await googleApi.loadNewsletterFromDrive(fileId);
            setSelectedLoadFile({ fileId, newsletter: loadedNewsletter, topics });
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'Failed to load newsletter');
            setSelectedLoadFile(null);
        } finally {
            setIsLoadingFromDrive(false);
        }
    };

    const handleConfirmLoadAction = (action: 'view' | 'email' | 'sheet') => {
        if (selectedLoadFile && onLoadNewsletter) {
            onLoadNewsletter(selectedLoadFile.newsletter, selectedLoadFile.topics);
            setShowLoadModal(false);
            setSelectedLoadFile(null);
            setConfirmDialogAction(null);

            // Auto-execute workflow action if selected
            if (action === 'email') {
                setTimeout(() => handleWorkflowAction('gmail'), 300);
            } else if (action === 'sheet') {
                setTimeout(() => handleWorkflowAction('sheet'), 300);
            }
        }
    };

    const handleSave = () => {
        onSaveSettings({
            driveFolderName,
            logSheetName,
            subscribersSheetName,
        });
    };

    const handleOpenListSelectionModal = () => {
        setShowListSelectionModal(true);
        setListSelectionMode('all');
        setSingleSelectedList('');
        setMultipleSelectedLists(new Set());
    };

    const handleConfirmListSelection = async () => {
        let selectedIds: string[] = [];

        if (listSelectionMode === 'all') {
            selectedIds = [];
        } else if (listSelectionMode === 'single' && singleSelectedList) {
            selectedIds = [singleSelectedList];
        } else if (listSelectionMode === 'multiple') {
            selectedIds = Array.from(multipleSelectedLists);
        }

        onSelectedEmailListsChange(selectedIds);
        setShowListSelectionModal(false);

        // Trigger the email workflow
        setTimeout(() => handleWorkflowAction('gmail'), 100);
    };

    const toggleMultipleList = (listId: string) => {
        setMultipleSelectedLists(prev => {
            const newSet = new Set(prev);
            if (newSet.has(listId)) {
                newSet.delete(listId);
            } else {
                newSet.add(listId);
            }
            return newSet;
        });
    };

    const isAuthenticated = !!authData?.access_token;
    const isNewsletterReady = !!newsletter;

    return (
        <div className="space-y-8">
            <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-light-blue to-accent-salmon mb-6">
                Settings & Integrations
            </h1>

            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-border-light">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-muted-blue to-accent-salmon mb-4 flex items-center gap-2">
                    <SettingsIcon className="h-6 w-6" />
                    Google Workspace Configuration
                </h2>
                <p className="text-secondary-text mb-6">
                    Connect your Google Account to enable workflow actions (Save to Drive, Log to Sheet, Send via Gmail). 
                    The app will find or create the specified folders and sheets.
                </p>

                {isAuthenticated ? (
                    <div className="text-center bg-gray-100 p-3 rounded-lg border border-border-light mb-6">
                        <p className="text-sm text-green-600 flex items-center justify-center gap-2"><CheckIcon className="h-5 w-5"/> Connected as</p>
                        <p className="font-medium text-primary-text">{authData.email}</p>
                        <button onClick={onSignOut} className="text-xs text-secondary-text hover:text-red-600 underline mt-2">
                            Disconnect
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={onSignIn}
                        disabled={!isGoogleApiInitialized}
                        className="w-full flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-primary-text font-semibold py-2 px-4 rounded-lg transition mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <GoogleIcon className="h-5 w-5" />
                        Sign in with Google
                    </button>
                )}
               
                <div className={`space-y-4 transition-opacity ${isAuthenticated ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <div>
                        <label htmlFor="driveFolderName" className="block text-sm font-medium text-primary-text mb-1">
                            Google Drive Folder Name
                        </label>
                        <input
                            type="text"
                            id="driveFolderName"
                            value={driveFolderName}
                            onChange={(e) => setDriveFolderName(e.target.value)}
                            placeholder="e.g., AI Newsletters"
                            disabled={!isAuthenticated}
                            className="w-full bg-gray-50 border border-border-light rounded-lg p-2 focus:ring-2 focus:ring-accent-light-blue focus:outline-none transition disabled:bg-gray-100 text-primary-text"
                        />
                         <p className="text-xs text-secondary-text mt-1">The app will save newsletters here. If the folder doesn't exist, it will be created.</p>
                    </div>
                    <div>
                        <label htmlFor="logSheetName" className="block text-sm font-medium text-primary-text mb-1">
                            Newsletter Log Sheet Name
                        </label>
                        <input
                            type="text"
                            id="logSheetName"
                            value={logSheetName}
                            onChange={(e) => setLogSheetName(e.target.value)}
                            placeholder="e.g., Newsletter Log"
                            disabled={!isAuthenticated}
                            className="w-full bg-gray-50 border border-border-light rounded-lg p-2 focus:ring-2 focus:ring-accent-light-blue focus:outline-none transition disabled:bg-gray-100 text-primary-text"
                        />
                         <p className="text-xs text-secondary-text mt-1">A sheet with this name will be found or created to log your newsletters.</p>
                    </div>
                    <div>
                        <label htmlFor="subscribersSheetName" className="block text-sm font-medium text-primary-text mb-1">
                            Subscribers Sheet Name
                        </label>
                        <input
                            type="text"
                            id="subscribersSheetName"
                            value={subscribersSheetName}
                            onChange={(e) => setSubscribersSheetName(e.target.value)}
                            placeholder="e.g., Newsletter Subscribers"
                            disabled={!isAuthenticated}
                            className="w-full bg-gray-50 border border-border-light rounded-lg p-2 focus:ring-2 focus:ring-accent-light-blue focus:outline-none transition disabled:bg-gray-100 text-primary-text"
                        />
                         <p className="text-xs text-secondary-text mt-1">A sheet with this name will be used to get your subscriber list (must contain an 'Email' column).</p>
                    </div>
                    <div className="pt-4 flex justify-end">
                        <button 
                            onClick={handleSave} 
                            className="bg-accent-light-blue hover:bg-opacity-90 text-white font-semibold py-2 px-4 rounded-lg transition"
                        >
                            Save Settings
                        </button>
                    </div>
                </div>
            </div>

            {/* Workflow Actions */}
            <div className="bg-white rounded-2xl p-6 border border-border-light">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-light-blue to-accent-salmon mb-4 flex items-center gap-2">
                    <DriveIcon className="h-6 w-6" />
                    Workflow Actions
                </h2>
                <p className="text-secondary-text mb-6">Automate saving, logging, and sending your generated newsletters. Or load an existing newsletter from Drive to test.</p>
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 flex-wrap">
                    {/* Load from Drive - Always available when authenticated */}
                    <button
                        disabled={!isAuthenticated}
                        onClick={handleOpenLoadModal}
                        className="flex items-center gap-2 bg-accent-muted-blue hover:bg-opacity-90 disabled:bg-gray-100 disabled:text-secondary-text disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                    >
                        <DriveIcon className="h-5 w-5" />
                        Load from Drive
                    </button>

                    {/* Newsletter-dependent actions */}
                    <div className={`flex flex-col sm:flex-row gap-4 ${!isNewsletterReady ? 'opacity-50 pointer-events-none' : ''}`}>
                        <button
                            disabled={!isAuthenticated || !isNewsletterReady}
                            onClick={() => handleWorkflowAction('drive')}
                            className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-secondary-text disabled:cursor-not-allowed text-primary-text font-semibold py-2 px-4 rounded-lg transition duration-200"
                        >
                            <DriveIcon className="h-5 w-5" />
                            Save to Drive
                        </button>
                        <button
                            disabled={!isAuthenticated || !isNewsletterReady}
                            onClick={() => handleWorkflowAction('sheet')}
                            className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-secondary-text disabled:cursor-not-allowed text-primary-text font-semibold py-2 px-4 rounded-lg transition duration-200"
                        >
                            <SheetIcon className="h-5 w-5" />
                            Log to Sheet
                        </button>
                        <button
                            disabled={!isAuthenticated || !isNewsletterReady}
                            onClick={handleOpenListSelectionModal}
                            className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-secondary-text disabled:cursor-not-allowed text-primary-text font-semibold py-2 px-4 rounded-lg transition duration-200"
                        >
                            <SendIcon className="h-5 w-5" />
                            Send via Gmail
                        </button>
                    </div>
                </div>
                {!isAuthenticated && <p className="text-center text-sm text-secondary-text mt-3">Please connect your Google Account above to enable these actions.</p>}
                {!isNewsletterReady && isAuthenticated && <p className="text-center text-sm text-secondary-text mt-3">Generate a newsletter or load one from Drive to enable Save/Send/Log actions.</p>}
                {workflowStatus && <p className={`text-center text-sm mt-3 ${workflowStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{workflowStatus.message}</p>}
            </div>

            {/* Load from Drive Modal */}
            {showLoadModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-96 flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b border-border-light">
                            <h3 className="text-xl font-bold text-primary-text">Load Newsletter from Drive</h3>
                            <button onClick={() => {
                                setShowLoadModal(false);
                                setSelectedLoadFile(null);
                                setConfirmDialogAction(null);
                            }} className="text-secondary-text hover:text-primary-text">
                                <XIcon className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {isLoadingFromDrive && !selectedLoadFile && (
                                <div className="text-center py-8">
                                    <p className="text-secondary-text">Loading newsletters...</p>
                                </div>
                            )}

                            {loadError && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                                    <p className="text-red-600 text-sm">{loadError}</p>
                                </div>
                            )}

                            {!selectedLoadFile ? (
                                driveNewsletters.length > 0 ? (
                                    <div className="space-y-2">
                                        {driveNewsletters.map((file) => (
                                            <button
                                                key={file.fileId}
                                                onClick={() => handleLoadNewsletter(file.fileId)}
                                                disabled={isLoadingFromDrive}
                                                className="w-full text-left p-3 border border-border-light rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                                            >
                                                <div className="font-medium text-primary-text">{file.fileName}</div>
                                                <div className="text-xs text-secondary-text mt-1">
                                                    {new Date(file.modifiedTime).toLocaleString()}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-secondary-text">No newsletters found in Drive</p>
                                    </div>
                                )
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                        <p className="text-green-700 text-sm font-medium">Newsletter loaded successfully!</p>
                                        <p className="text-sm text-green-600 mt-1">{selectedLoadFile.newsletter.subject}</p>
                                    </div>
                                    <p className="text-sm text-secondary-text">What would you like to do?</p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 p-6 border-t border-border-light bg-gray-50">
                            {!selectedLoadFile ? (
                                <button
                                    onClick={() => {
                                        setShowLoadModal(false);
                                        setSelectedLoadFile(null);
                                    }}
                                    className="px-4 py-2 rounded-lg border border-border-light text-primary-text font-medium hover:bg-gray-100 transition"
                                >
                                    Cancel
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => handleConfirmLoadAction('view')}
                                        className="px-4 py-2 rounded-lg border border-border-light text-primary-text font-medium hover:bg-gray-100 transition"
                                    >
                                        Just Load
                                    </button>
                                    <button
                                        onClick={() => handleConfirmLoadAction('email')}
                                        className="px-4 py-2 rounded-lg bg-accent-light-blue text-white font-medium hover:bg-opacity-90 transition flex items-center gap-2"
                                    >
                                        <SendIcon className="h-4 w-4" />
                                        Send Email
                                    </button>
                                    <button
                                        onClick={() => handleConfirmLoadAction('sheet')}
                                        className="px-4 py-2 rounded-lg bg-accent-salmon text-white font-medium hover:bg-opacity-90 transition flex items-center gap-2"
                                    >
                                        <SheetIcon className="h-4 w-4" />
                                        Log to Sheet
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* List Selection Modal for Email Sending */}
            {showListSelectionModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-screen overflow-y-auto">
                        <div className="flex justify-between items-center p-6 border-b border-border-light">
                            <h3 className="text-xl font-bold text-primary-text">Select Subscribers</h3>
                            <button
                                onClick={() => setShowListSelectionModal(false)}
                                className="text-secondary-text hover:text-primary-text"
                            >
                                <XIcon className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Option 1: All Active Subscribers */}
                            <label className="flex items-start gap-3 p-3 border border-border-light rounded-lg hover:bg-gray-50 cursor-pointer">
                                <input
                                    type="radio"
                                    name="listSelection"
                                    value="all"
                                    checked={listSelectionMode === 'all'}
                                    onChange={() => setListSelectionMode('all')}
                                    className="mt-1 w-4 h-4"
                                />
                                <div>
                                    <p className="font-medium text-primary-text">All Active Subscribers</p>
                                    <p className="text-sm text-secondary-text">Send to everyone in the system</p>
                                </div>
                            </label>

                            {/* Option 2: Single List */}
                            <label className="flex items-start gap-3 p-3 border border-border-light rounded-lg hover:bg-gray-50 cursor-pointer">
                                <input
                                    type="radio"
                                    name="listSelection"
                                    value="single"
                                    checked={listSelectionMode === 'single'}
                                    onChange={() => setListSelectionMode('single')}
                                    className="mt-1 w-4 h-4"
                                />
                                <div className="flex-1">
                                    <p className="font-medium text-primary-text">Single List</p>
                                    <p className="text-sm text-secondary-text mb-2">Send to subscribers in one specific list</p>
                                    {listSelectionMode === 'single' && (
                                        <select
                                            value={singleSelectedList}
                                            onChange={(e) => setSingleSelectedList(e.target.value)}
                                            className="w-full bg-gray-50 border border-border-light rounded-lg p-2 text-sm text-primary-text"
                                        >
                                            <option value="">-- Choose a list --</option>
                                            {subscriberLists.map(list => (
                                                <option key={list.id} value={list.id}>
                                                    {list.name} ({list.subscriberCount} subscribers)
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </label>

                            {/* Option 3: Multiple Lists */}
                            <label className="flex items-start gap-3 p-3 border border-border-light rounded-lg hover:bg-gray-50 cursor-pointer">
                                <input
                                    type="radio"
                                    name="listSelection"
                                    value="multiple"
                                    checked={listSelectionMode === 'multiple'}
                                    onChange={() => setListSelectionMode('multiple')}
                                    className="mt-1 w-4 h-4"
                                />
                                <div className="flex-1">
                                    <p className="font-medium text-primary-text">Multiple Lists</p>
                                    <p className="text-sm text-secondary-text mb-2">Send to subscribers in multiple lists</p>
                                    {listSelectionMode === 'multiple' && (
                                        <div className="space-y-2">
                                            {subscriberLists.length === 0 ? (
                                                <p className="text-sm text-secondary-text italic">No lists available yet</p>
                                            ) : (
                                                subscriberLists.map(list => (
                                                    <label key={list.id} className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={multipleSelectedLists.has(list.id)}
                                                            onChange={() => toggleMultipleList(list.id)}
                                                            className="w-4 h-4"
                                                        />
                                                        <span className="text-sm text-primary-text">{list.name} ({list.subscriberCount})</span>
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </label>

                            {/* Info box showing summary */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                                <p className="text-sm text-blue-700 font-medium">
                                    {listSelectionMode === 'all' && '✓ Will send to all active subscribers'}
                                    {listSelectionMode === 'single' && singleSelectedList && `✓ Will send to ${subscriberLists.find(l => l.id === singleSelectedList)?.subscriberCount || 0} subscribers in this list`}
                                    {listSelectionMode === 'single' && !singleSelectedList && '⚠ Please select a list'}
                                    {listSelectionMode === 'multiple' && multipleSelectedLists.size === 0 && '⚠ Please select at least one list'}
                                    {listSelectionMode === 'multiple' && multipleSelectedLists.size > 0 && `✓ Will send to subscribers in ${multipleSelectedLists.size} selected list${multipleSelectedLists.size > 1 ? 's' : ''}`}
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 p-6 border-t border-border-light bg-gray-50">
                            <button
                                onClick={() => setShowListSelectionModal(false)}
                                className="px-4 py-2 rounded-lg border border-border-light text-primary-text font-medium hover:bg-gray-100 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmListSelection}
                                disabled={
                                    (listSelectionMode === 'single' && !singleSelectedList) ||
                                    (listSelectionMode === 'multiple' && multipleSelectedLists.size === 0)
                                }
                                className="px-4 py-2 rounded-lg bg-accent-light-blue text-white font-medium hover:bg-opacity-90 transition disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <SendIcon className="h-4 w-4" />
                                Send Email
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};