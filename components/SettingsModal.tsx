import React, { useState, useEffect } from 'react';
import { XIcon, GoogleIcon, CheckIcon, DriveIcon, SheetIcon, SendIcon } from './IconComponents';
import type { GoogleSettings, GapiAuthData, Newsletter } from '../types';
import { saveApiKey, hasApiKey, getApiKeyStatus, deleteApiKey, validateApiKey, listApiKeyStatuses } from '../services/apiKeyService';
import { LoadFromDriveModal } from './LoadFromDriveModal';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: GoogleSettings) => void;
    initialSettings: GoogleSettings | null;
    authData: GapiAuthData | null;
    onSignIn: () => void;
    onSignOut: () => void;
    isGoogleApiInitialized: boolean;
    newsletter?: Newsletter | null;
    onWorkflowAction?: (action: 'drive' | 'sheet' | 'gmail') => void;
    onLoadFromDrive?: (newsletter: Newsletter, topics: string[]) => void;
    onOpenListSelectionModal?: () => void;
    workflowStatus?: { message: string; type: 'success' | 'error' } | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen, onClose, onSave, initialSettings, authData, onSignIn, onSignOut, isGoogleApiInitialized,
    newsletter, onWorkflowAction, onLoadFromDrive, onOpenListSelectionModal, workflowStatus
}) => {
    const [driveFolderName, setDriveFolderName] = useState(initialSettings?.driveFolderName || 'AI Newsletters');
    const [logSheetName, setLogSheetName] = useState(initialSettings?.logSheetName || 'Newsletter Log');
    const [subscribersSheetName, setSubscribersSheetName] = useState(initialSettings?.subscribersSheetName || 'Newsletter Subscribers');

    // API Key management state
    const [claudeApiKey, setClaudeApiKey] = useState('');
    const [stabilityApiKey, setStabilityApiKey] = useState('');
    const [braveApiKey, setBraveApiKey] = useState('');
    const [googleApiKey, setGoogleApiKey] = useState('');
    const [googleClientId, setGoogleClientId] = useState('');
    const [claudeKeyStatus, setClaudeKeyStatus] = useState<'valid' | 'invalid' | 'unknown'>('unknown');
    const [stabilityKeyStatus, setStabilityKeyStatus] = useState<'valid' | 'invalid' | 'unknown'>('unknown');
    const [braveKeyStatus, setBraveKeyStatus] = useState<'valid' | 'invalid' | 'unknown'>('unknown');
    const [googleApiKeyStatus, setGoogleApiKeyStatus] = useState<'valid' | 'invalid' | 'unknown'>('unknown');
    const [googleClientIdStatus, setGoogleClientIdStatus] = useState<'valid' | 'invalid' | 'unknown'>('unknown');
    const [isValidatingClaude, setIsValidatingClaude] = useState(false);
    const [isValidatingStability, setIsValidatingStability] = useState(false);
    const [isValidatingBrave, setIsValidatingBrave] = useState(false);
    const [isValidatingGoogleApiKey, setIsValidatingGoogleApiKey] = useState(false);
    const [isValidatingGoogleClientId, setIsValidatingGoogleClientId] = useState(false);
    const [apiKeyMessage, setApiKeyMessage] = useState<string | null>(null);

    // Load from Drive modal state
    const [isLoadFromDriveOpen, setIsLoadFromDriveOpen] = useState(false);
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleKeyDown);
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'auto';
        };
    }, [isOpen, onClose]);

    // Load saved API key statuses when modal opens
    useEffect(() => {
        const loadApiKeyStatuses = async () => {
            if (!isOpen || !authData?.email) {
                return;
            }

            try {
                const statuses = await listApiKeyStatuses(authData.email);
                statuses.forEach(status => {
                    if (status.service === 'claude') {
                        setClaudeKeyStatus(status.isValid ? 'valid' : 'invalid');
                    } else if (status.service === 'stability') {
                        setStabilityKeyStatus(status.isValid ? 'valid' : 'invalid');
                    } else if (status.service === 'brave') {
                        setBraveKeyStatus(status.isValid ? 'valid' : 'invalid');
                    } else if (status.service === 'google_api_key') {
                        setGoogleApiKeyStatus(status.isValid ? 'valid' : 'invalid');
                    } else if (status.service === 'google_client_id') {
                        setGoogleClientIdStatus(status.isValid ? 'valid' : 'invalid');
                    }
                });
            } catch (error) {
                console.error('Error loading API key statuses:', error);
            }
        };

        loadApiKeyStatuses();
    }, [isOpen, authData?.email]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave({
            driveFolderName,
            logSheetName,
            subscribersSheetName,
        });
    };

    const isAuthenticated = !!authData?.access_token;

    return (
        <>
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div 
                className="bg-white border border-border-light rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col relative"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-border-light">
                    <h2 className="text-xl font-semibold text-primary-text">Settings & Integrations</h2>
                    <button onClick={onClose} className="text-secondary-text hover:text-primary-text transition">
                        <XIcon className="h-6 w-6" />
                    </button>
                </div>

                <div className="flex-grow p-6 overflow-y-auto space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-primary-text mb-2">Google Workspace</h3>
                        <p className="text-sm text-secondary-text mb-4">
                            Connect your Google Account to enable workflow actions. The app will find or create the folders and sheets you specify by name.
                        </p>
                        {isAuthenticated ? (
                            <div className="text-center bg-gray-100 p-3 rounded-lg border border-border-light">
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
                                className="w-full flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-primary-text font-semibold py-2 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <GoogleIcon className="h-5 w-5" />
                                Sign in with Google
                            </button>
                        )}
                       
                    </div>

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
                    </div>

                    {/* API Key Management Section */}
                    <div className="border-t border-border-light pt-6 mt-6">
                        <h3 className="text-lg font-semibold text-primary-text mb-2">API Key Management</h3>
                        <p className="text-sm text-secondary-text mb-4">
                            Store and manage your API keys for Claude, Stability, and Brave Search. Keys are stored locally.
                        </p>

                            {/* Claude API Key */}
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-border-light">
                                <div className="flex items-center justify-between mb-2">
                                    <label htmlFor="claudeApiKey" className="block text-sm font-medium text-primary-text">
                                        Claude API Key
                                    </label>
                                    {claudeKeyStatus !== 'unknown' && (
                                        <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                            claudeKeyStatus === 'valid'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                        }`}>
                                            {claudeKeyStatus === 'valid' ? '✓ Valid' : '✗ Invalid'}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        id="claudeApiKey"
                                        value={claudeApiKey}
                                        onChange={(e) => setClaudeApiKey(e.target.value)}
                                        placeholder="sk-ant-..."
                                        className="flex-1 bg-white border border-border-light rounded-lg p-2 focus:ring-2 focus:ring-accent-light-blue focus:outline-none transition text-primary-text"
                                    />
                                    <button
                                        onClick={async () => {
                                            setIsValidatingClaude(true);
                                            try {
                                                if (!authData?.email) {
                                                    setApiKeyMessage('User email is required');
                                                    return;
                                                }
                                                await saveApiKey({ service: 'claude', key: claudeApiKey }, authData.email);
                                                const isValid = await validateApiKey('claude', authData.email);
                                                setClaudeKeyStatus(isValid ? 'valid' : 'invalid');
                                                setApiKeyMessage(isValid ? 'Claude API key saved and validated!' : 'Claude API key saved but validation failed');
                                            } catch (error) {
                                                setClaudeKeyStatus('invalid');
                                                setApiKeyMessage('Failed to save Claude API key');
                                            } finally {
                                                setIsValidatingClaude(false);
                                            }
                                        }}
                                        disabled={isValidatingClaude || !claudeApiKey}
                                        className="bg-accent-light-blue hover:bg-opacity-90 disabled:bg-accent-light-blue/40 text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
                                    >
                                        {isValidatingClaude ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (!authData?.email) {
                                                setApiKeyMessage('User email is required');
                                                return;
                                            }
                                            await deleteApiKey('claude', authData.email);
                                            setClaudeApiKey('');
                                            setClaudeKeyStatus('unknown');
                                            setApiKeyMessage('Claude API key deleted');
                                        }}
                                        className="bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 px-4 rounded-lg transition text-sm"
                                    >
                                        Delete
                                    </button>
                                </div>
                                {claudeKeyStatus !== 'unknown' && (
                                    <p className="text-xs text-secondary-text mt-2">
                                        {claudeKeyStatus === 'valid'
                                            ? '✓ Key is saved and validated'
                                            : '⚠ Key is saved but validation failed'}
                                    </p>
                                )}
                            </div>

                            {/* Brave Search API Key */}
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-border-light">
                                <div className="flex items-center justify-between mb-2">
                                    <label htmlFor="braveApiKey" className="block text-sm font-medium text-primary-text">
                                        Brave Search API Key
                                    </label>
                                    {braveKeyStatus !== 'unknown' && (
                                        <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                            braveKeyStatus === 'valid'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                        }`}>
                                            {braveKeyStatus === 'valid' ? '✓ Valid' : '✗ Invalid'}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        id="braveApiKey"
                                        value={braveApiKey}
                                        onChange={(e) => setBraveApiKey(e.target.value)}
                                        placeholder="BSA..."
                                        className="flex-1 bg-white border border-border-light rounded-lg p-2 focus:ring-2 focus:ring-accent-light-blue focus:outline-none transition text-primary-text"
                                    />
                                    <button
                                        onClick={async () => {
                                            setIsValidatingBrave(true);
                                            try {
                                                if (!authData?.email) {
                                                    setApiKeyMessage('User email is required');
                                                    return;
                                                }
                                                await saveApiKey({ service: 'brave' as any, key: braveApiKey }, authData.email);
                                                const isValid = await validateApiKey('brave' as any, authData.email);
                                                setBraveKeyStatus(isValid ? 'valid' : 'invalid');
                                                setApiKeyMessage(isValid ? 'Brave Search API key saved and validated!' : 'Brave Search API key saved but validation failed');
                                            } catch (error) {
                                                setBraveKeyStatus('invalid');
                                                setApiKeyMessage('Failed to save Brave Search API key');
                                            } finally {
                                                setIsValidatingBrave(false);
                                            }
                                        }}
                                        disabled={isValidatingBrave || !braveApiKey}
                                        className="bg-accent-light-blue hover:bg-opacity-90 disabled:bg-accent-light-blue/40 text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
                                    >
                                        {isValidatingBrave ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (!authData?.email) {
                                                setApiKeyMessage('User email is required');
                                                return;
                                            }
                                            await deleteApiKey('brave' as any, authData.email);
                                            setBraveApiKey('');
                                            setBraveKeyStatus('unknown');
                                            setApiKeyMessage('Brave Search API key deleted');
                                        }}
                                        className="bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 px-4 rounded-lg transition text-sm"
                                    >
                                        Delete
                                    </button>
                                </div>
                                <p className="text-xs text-secondary-text mt-2">
                                    {braveKeyStatus === 'valid'
                                        ? '✓ Key is saved and validated'
                                        : braveKeyStatus === 'invalid'
                                            ? '⚠ Key is saved but validation failed'
                                            : 'Optional: Used for web search grounding in newsletters'}
                                </p>
                            </div>

                            {/* Stability API Key */}
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-border-light">
                                <div className="flex items-center justify-between mb-2">
                                    <label htmlFor="stabilityApiKey" className="block text-sm font-medium text-primary-text">
                                        Stability API Key
                                    </label>
                                    {stabilityKeyStatus !== 'unknown' && (
                                        <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                            stabilityKeyStatus === 'valid'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                        }`}>
                                            {stabilityKeyStatus === 'valid' ? '✓ Valid' : '✗ Invalid'}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        id="stabilityApiKey"
                                        value={stabilityApiKey}
                                        onChange={(e) => setStabilityApiKey(e.target.value)}
                                        placeholder="sk-..."
                                        className="flex-1 bg-white border border-border-light rounded-lg p-2 focus:ring-2 focus:ring-accent-light-blue focus:outline-none transition text-primary-text"
                                    />
                                    <button
                                        onClick={async () => {
                                            setIsValidatingStability(true);
                                            try {
                                                if (!authData?.email) {
                                                    setApiKeyMessage('User email is required');
                                                    return;
                                                }
                                                await saveApiKey({ service: 'stability', key: stabilityApiKey }, authData.email);
                                                const isValid = await validateApiKey('stability', authData.email);
                                                setStabilityKeyStatus(isValid ? 'valid' : 'invalid');
                                                setApiKeyMessage(isValid ? 'Stability API key saved and validated!' : 'Stability API key saved but validation failed');
                                            } catch (error) {
                                                setStabilityKeyStatus('invalid');
                                                setApiKeyMessage('Failed to save Stability API key');
                                            } finally {
                                                setIsValidatingStability(false);
                                            }
                                        }}
                                        disabled={isValidatingStability || !stabilityApiKey}
                                        className="bg-accent-light-blue hover:bg-opacity-90 disabled:bg-accent-light-blue/40 text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
                                    >
                                        {isValidatingStability ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (!authData?.email) {
                                                setApiKeyMessage('User email is required');
                                                return;
                                            }
                                            await deleteApiKey('stability', authData.email);
                                            setStabilityApiKey('');
                                            setStabilityKeyStatus('unknown');
                                            setApiKeyMessage('Stability API key deleted');
                                        }}
                                        className="bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 px-4 rounded-lg transition text-sm"
                                    >
                                        Delete
                                    </button>
                                </div>
                                {stabilityKeyStatus !== 'unknown' && (
                                    <p className="text-xs text-secondary-text mt-2">
                                        {stabilityKeyStatus === 'valid'
                                            ? '✓ Key is saved and validated'
                                            : '⚠ Key is saved but validation failed'}
                                    </p>
                                )}
                            </div>

                            {/* Google Integration Section */}
                            <div className="border-t border-border-light pt-4 mt-4">
                                <h4 className="text-md font-semibold text-primary-text mb-3">Google Integration</h4>
                                <p className="text-xs text-secondary-text mb-3">
                                    Configure Google Cloud credentials for Drive, Sheets, and Gmail integration.
                                </p>

                                {/* Google API Key */}
                                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-border-light">
                                    <div className="flex items-center justify-between mb-2">
                                        <label htmlFor="googleApiKey" className="block text-sm font-medium text-primary-text">
                                            Google API Key
                                        </label>
                                        {googleApiKeyStatus !== 'unknown' && (
                                            <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                                googleApiKeyStatus === 'valid'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-red-100 text-red-700'
                                            }`}>
                                                {googleApiKeyStatus === 'valid' ? '✓ Valid' : '✗ Invalid'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="password"
                                            id="googleApiKey"
                                            value={googleApiKey}
                                            onChange={(e) => setGoogleApiKey(e.target.value)}
                                            placeholder="AIza..."
                                            className="flex-1 bg-white border border-border-light rounded-lg p-2 focus:ring-2 focus:ring-accent-light-blue focus:outline-none transition text-primary-text"
                                        />
                                        <button
                                            onClick={async () => {
                                                setIsValidatingGoogleApiKey(true);
                                                try {
                                                    if (!authData?.email) {
                                                        setApiKeyMessage('User email is required');
                                                        return;
                                                    }
                                                    await saveApiKey({ service: 'google_api_key' as any, key: googleApiKey }, authData.email);
                                                    setGoogleApiKeyStatus('valid');
                                                    setApiKeyMessage('Google API key saved!');
                                                } catch (error) {
                                                    setGoogleApiKeyStatus('invalid');
                                                    setApiKeyMessage('Failed to save Google API key');
                                                } finally {
                                                    setIsValidatingGoogleApiKey(false);
                                                }
                                            }}
                                            disabled={isValidatingGoogleApiKey || !googleApiKey}
                                            className="bg-accent-light-blue hover:bg-opacity-90 disabled:bg-accent-light-blue/40 text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
                                        >
                                            {isValidatingGoogleApiKey ? 'Saving...' : 'Save'}
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!authData?.email) {
                                                    setApiKeyMessage('User email is required');
                                                    return;
                                                }
                                                await deleteApiKey('google_api_key' as any, authData.email);
                                                setGoogleApiKey('');
                                                setGoogleApiKeyStatus('unknown');
                                                setApiKeyMessage('Google API key deleted');
                                            }}
                                            className="bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 px-4 rounded-lg transition text-sm"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                    <p className="text-xs text-secondary-text mt-2">
                                        Get from Google Cloud Console &rarr; APIs & Services &rarr; Credentials
                                    </p>
                                </div>

                                {/* Google OAuth Client ID */}
                                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-border-light">
                                    <div className="flex items-center justify-between mb-2">
                                        <label htmlFor="googleClientId" className="block text-sm font-medium text-primary-text">
                                            Google OAuth Client ID
                                        </label>
                                        {googleClientIdStatus !== 'unknown' && (
                                            <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                                googleClientIdStatus === 'valid'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-red-100 text-red-700'
                                            }`}>
                                                {googleClientIdStatus === 'valid' ? '✓ Valid' : '✗ Invalid'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="password"
                                            id="googleClientId"
                                            value={googleClientId}
                                            onChange={(e) => setGoogleClientId(e.target.value)}
                                            placeholder="123456789-xxx.apps.googleusercontent.com"
                                            className="flex-1 bg-white border border-border-light rounded-lg p-2 focus:ring-2 focus:ring-accent-light-blue focus:outline-none transition text-primary-text text-sm"
                                        />
                                        <button
                                            onClick={async () => {
                                                setIsValidatingGoogleClientId(true);
                                                try {
                                                    if (!authData?.email) {
                                                        setApiKeyMessage('User email is required');
                                                        return;
                                                    }
                                                    await saveApiKey({ service: 'google_client_id' as any, key: googleClientId }, authData.email);
                                                    setGoogleClientIdStatus('valid');
                                                    setApiKeyMessage('Google Client ID saved!');
                                                } catch (error) {
                                                    setGoogleClientIdStatus('invalid');
                                                    setApiKeyMessage('Failed to save Google Client ID');
                                                } finally {
                                                    setIsValidatingGoogleClientId(false);
                                                }
                                            }}
                                            disabled={isValidatingGoogleClientId || !googleClientId}
                                            className="bg-accent-light-blue hover:bg-opacity-90 disabled:bg-accent-light-blue/40 text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
                                        >
                                            {isValidatingGoogleClientId ? 'Saving...' : 'Save'}
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!authData?.email) {
                                                    setApiKeyMessage('User email is required');
                                                    return;
                                                }
                                                await deleteApiKey('google_client_id' as any, authData.email);
                                                setGoogleClientId('');
                                                setGoogleClientIdStatus('unknown');
                                                setApiKeyMessage('Google Client ID deleted');
                                            }}
                                            className="bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 px-4 rounded-lg transition text-sm"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                    <p className="text-xs text-secondary-text mt-2">
                                        OAuth 2.0 Client ID from Google Cloud Console
                                    </p>
                                </div>
                            </div>

                        {apiKeyMessage && (
                            <p className={`text-sm p-3 rounded-lg ${
                                apiKeyMessage.includes('failed') || apiKeyMessage.includes('Invalid')
                                    ? 'bg-red-50 text-red-700'
                                    : 'bg-green-50 text-green-700'
                            }`}>
                                {apiKeyMessage}
                            </p>
                        )}
                    </div>

                    {/* Workflow Actions Section */}
                    {authData?.access_token && (
                        <div className="border-t border-border-light pt-6 mt-6">
                            <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center gap-2">
                                <DriveIcon className="h-5 w-5" />
                                Workflow Actions
                            </h3>
                            <p className="text-sm text-secondary-text mb-4">
                                Automate saving, logging, and sending your newsletters. Or load an existing newsletter from Drive.
                            </p>
                            <div className="flex flex-col gap-3">
                                {/* Load from Drive */}
                                <button
                                    onClick={() => setIsLoadFromDriveOpen(true)}
                                    className="flex items-center gap-2 w-full bg-accent-muted-blue hover:bg-opacity-90 text-white font-semibold py-2 px-3 rounded-lg transition duration-200 text-sm"
                                >
                                    <DriveIcon className="h-5 w-5" />
                                    Load from Drive
                                </button>

                                {/* Newsletter-dependent actions */}
                                <div className={`flex flex-col gap-2 ${!newsletter ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <button
                                        disabled={!newsletter}
                                        onClick={() => onWorkflowAction?.('drive')}
                                        className="flex items-center gap-2 w-full bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-secondary-text text-primary-text font-semibold py-2 px-3 rounded-lg transition duration-200 text-sm"
                                    >
                                        <DriveIcon className="h-5 w-5" />
                                        Save to Drive
                                    </button>
                                    <button
                                        disabled={!newsletter}
                                        onClick={() => onWorkflowAction?.('sheet')}
                                        className="flex items-center gap-2 w-full bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-secondary-text text-primary-text font-semibold py-2 px-3 rounded-lg transition duration-200 text-sm"
                                    >
                                        <SheetIcon className="h-5 w-5" />
                                        Log to Sheet
                                    </button>
                                    <button
                                        disabled={!newsletter}
                                        onClick={() => onOpenListSelectionModal?.()}
                                        className="flex items-center gap-2 w-full bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-secondary-text text-primary-text font-semibold py-2 px-3 rounded-lg transition duration-200 text-sm"
                                    >
                                        <SendIcon className="h-5 w-5" />
                                        Send via Gmail
                                    </button>
                                </div>
                            </div>
                            {!newsletter && <p className="text-center text-xs text-secondary-text mt-3">Generate a newsletter or load one from Drive to enable Save/Send/Log actions.</p>}
                            {workflowStatus && <p className={`text-center text-xs mt-3 ${workflowStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{workflowStatus.message}</p>}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 border-t border-border-light flex justify-end items-center gap-4">
                     <button onClick={onClose} className="text-secondary-text hover:text-primary-text font-medium py-2 px-4 rounded-lg transition">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="bg-accent-light-blue hover:bg-opacity-90 text-white font-semibold py-2 px-4 rounded-lg transition"
                    >
                        Save Settings
                    </button>
                </div>
            </div>
        </div>

        {/* Load from Drive Modal */}
        {authData?.access_token && initialSettings?.driveFolderName && (
            <LoadFromDriveModal
                isOpen={isLoadFromDriveOpen}
                onClose={() => setIsLoadFromDriveOpen(false)}
                onLoad={onLoadFromDrive || (() => {})}
                driveFolderName={initialSettings.driveFolderName}
                accessToken={authData.access_token}
            />
        )}
        </>
    );
};