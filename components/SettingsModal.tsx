import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, GoogleIcon, CheckIcon } from './IconComponents';
import type { GoogleSettings, GapiAuthData } from '../types';
import { saveApiKey, deleteApiKey, validateApiKey, listApiKeyStatuses } from '../services/apiKeyService';
import { modalOverlay, modalContent } from '../utils/animations';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: GoogleSettings) => void;
    initialSettings: GoogleSettings | null;
    authData: GapiAuthData | null;
    onSignIn: () => void;
    onSignOut: () => void;
    isGoogleApiInitialized: boolean;
    onGoogleCredentialsSaved?: () => void; // Called when Google API key or Client ID is saved
}

// Reusable API Key Input Component
interface ApiKeyInputProps {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    status: 'valid' | 'invalid' | 'unknown';
    isValidating: boolean;
    onSave: () => void;
    onDelete: () => void;
    hint?: string;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({
    id,
    label,
    value,
    onChange,
    placeholder,
    status,
    isValidating,
    onSave,
    onDelete,
    hint,
}) => (
    <div className="py-4 border-b border-border-subtle last:border-b-0">
        <div className="flex items-center justify-between mb-3">
            <label htmlFor={id} className="font-sans text-ui font-medium text-ink">
                {label}
            </label>
            {status !== 'unknown' && (
                <span className={`font-sans text-caption px-2 py-0.5 ${
                    status === 'valid'
                        ? 'bg-pearl text-green-700'
                        : 'bg-pearl text-editorial-red'
                }`}>
                    {status === 'valid' ? 'Valid' : 'Invalid'}
                </span>
            )}
        </div>
        <div className="flex gap-2">
            <input
                type="password"
                id={id}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink transition-colors"
            />
            <button
                onClick={onSave}
                disabled={isValidating || !value}
                className="bg-ink text-paper font-sans text-ui px-4 py-2 hover:bg-charcoal transition-colors disabled:bg-silver disabled:cursor-not-allowed"
            >
                {isValidating ? 'Saving...' : 'Save'}
            </button>
            <button
                onClick={onDelete}
                className="border border-editorial-red text-editorial-red font-sans text-ui px-4 py-2 hover:bg-editorial-red hover:text-paper transition-colors"
            >
                Delete
            </button>
        </div>
        {hint && (
            <p className="font-sans text-caption text-slate mt-2">{hint}</p>
        )}
    </div>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen, onClose, onSave, initialSettings, authData, onSignIn, onSignOut, isGoogleApiInitialized, onGoogleCredentialsSaved
}) => {
    const [driveFolderName, setDriveFolderName] = useState(initialSettings?.driveFolderName || 'AI Newsletters');

    // API Key management state
    const [claudeApiKey, setClaudeApiKey] = useState('');
    const [stabilityApiKey, setStabilityApiKey] = useState('');
    const [braveApiKey, setBraveApiKey] = useState('');
    const [googleApiKey, setGoogleApiKey] = useState('');
    const [googleClientId, setGoogleClientId] = useState('');
    const [googleClientSecret, setGoogleClientSecret] = useState('');
    const [claudeKeyStatus, setClaudeKeyStatus] = useState<'valid' | 'invalid' | 'unknown'>('unknown');
    const [stabilityKeyStatus, setStabilityKeyStatus] = useState<'valid' | 'invalid' | 'unknown'>('unknown');
    const [braveKeyStatus, setBraveKeyStatus] = useState<'valid' | 'invalid' | 'unknown'>('unknown');
    const [googleApiKeyStatus, setGoogleApiKeyStatus] = useState<'valid' | 'invalid' | 'unknown'>('unknown');
    const [googleClientIdStatus, setGoogleClientIdStatus] = useState<'valid' | 'invalid' | 'unknown'>('unknown');
    const [googleClientSecretStatus, setGoogleClientSecretStatus] = useState<'valid' | 'invalid' | 'unknown'>('unknown');
    const [isValidatingClaude, setIsValidatingClaude] = useState(false);
    const [isValidatingStability, setIsValidatingStability] = useState(false);
    const [isValidatingBrave, setIsValidatingBrave] = useState(false);
    const [isValidatingGoogleApiKey, setIsValidatingGoogleApiKey] = useState(false);
    const [isValidatingGoogleClientId, setIsValidatingGoogleClientId] = useState(false);
    const [isValidatingGoogleClientSecret, setIsValidatingGoogleClientSecret] = useState(false);
    const [apiKeyMessage, setApiKeyMessage] = useState<string | null>(null);

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
                    } else if (status.service === 'google_client_secret') {
                        setGoogleClientSecretStatus(status.isValid ? 'valid' : 'invalid');
                    }
                });
            } catch (error) {
                console.error('Error loading API key statuses:', error);
            }
        };

        loadApiKeyStatuses();
    }, [isOpen, authData?.email]);

    const handleSave = () => {
        onSave({
            driveFolderName,
        });
    };

    const isAuthenticated = !!authData?.access_token;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    variants={modalOverlay}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <motion.div
                        variants={modalContent}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="bg-paper border border-border-subtle w-full max-w-xl max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-8 py-6 border-b border-border-subtle">
                            <div>
                                <h2 className="font-display text-h2 text-ink">Settings</h2>
                                <p className="font-sans text-caption text-slate mt-1">
                                    Configure integrations and API keys
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-slate hover:text-ink transition-colors p-2"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-grow px-8 py-6 overflow-y-auto space-y-8">

                            {/* Google Workspace Section */}
                            <section>
                                <div className="flex items-baseline gap-3 mb-4">
                                    <span className="font-sans text-overline text-slate uppercase tracking-widest">Connect</span>
                                    <h3 className="font-display text-h3 text-ink">Google Workspace</h3>
                                </div>
                                <p className="font-serif text-body text-charcoal mb-6">
                                    Connect your Google Account to enable workflow actions like saving to Drive and sending via Gmail.
                                </p>

                                {isAuthenticated ? (
                                    <div className="bg-pearl border border-border-subtle p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-ink flex items-center justify-center">
                                                <CheckIcon className="h-4 w-4 text-paper" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-sans text-ui font-medium text-ink">Connected</p>
                                                <p className="font-sans text-caption text-slate">{authData.email}</p>
                                            </div>
                                            <button
                                                onClick={onSignOut}
                                                className="font-sans text-caption text-editorial-red hover:underline"
                                            >
                                                Disconnect
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={onSignIn}
                                        disabled={!isGoogleApiInitialized}
                                        className="w-full flex items-center justify-center gap-3 bg-ink text-paper font-sans text-ui py-3 px-4 hover:bg-charcoal transition-colors disabled:bg-silver disabled:cursor-not-allowed"
                                    >
                                        <GoogleIcon className="h-5 w-5" />
                                        Sign in with Google
                                    </button>
                                )}

                                {/* Workspace Settings */}
                                <div className={`mt-6 transition-opacity ${isAuthenticated ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                    <div>
                                        <label htmlFor="driveFolderName" className="block font-sans text-ui font-medium text-ink mb-2">
                                            Drive Folder Name
                                        </label>
                                        <input
                                            type="text"
                                            id="driveFolderName"
                                            value={driveFolderName}
                                            onChange={(e) => setDriveFolderName(e.target.value)}
                                            placeholder="e.g., AI Newsletters"
                                            disabled={!isAuthenticated}
                                            className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink transition-colors disabled:bg-pearl"
                                        />
                                        <p className="font-sans text-caption text-slate mt-1">
                                            Newsletters will be saved to this Drive folder.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            {/* Divider */}
                            <div className="h-px bg-border-subtle" />

                            {/* API Key Management Section */}
                            <section>
                                <div className="flex items-baseline gap-3 mb-4">
                                    <span className="font-sans text-overline text-slate uppercase tracking-widest">Manage</span>
                                    <h3 className="font-display text-h3 text-ink">API Keys</h3>
                                </div>
                                <p className="font-serif text-body text-charcoal mb-6">
                                    Store your API keys securely. Keys are stored locally on your device.
                                </p>

                                {/* Claude API Key */}
                                <ApiKeyInput
                                    id="claudeApiKey"
                                    label="Claude API Key"
                                    value={claudeApiKey}
                                    onChange={setClaudeApiKey}
                                    placeholder="sk-ant-..."
                                    status={claudeKeyStatus}
                                    isValidating={isValidatingClaude}
                                    hint="Required for newsletter content generation"
                                    onSave={async () => {
                                        setIsValidatingClaude(true);
                                        try {
                                            if (!authData?.email) {
                                                setApiKeyMessage('User email is required');
                                                return;
                                            }
                                            await saveApiKey({ service: 'claude', key: claudeApiKey }, authData.email);
                                            const isValid = await validateApiKey('claude', authData.email);
                                            setClaudeKeyStatus(isValid ? 'valid' : 'invalid');
                                            setApiKeyMessage(isValid ? 'Claude API key saved and validated' : 'Claude API key saved but validation failed');
                                        } catch (error) {
                                            setClaudeKeyStatus('invalid');
                                            setApiKeyMessage('Failed to save Claude API key');
                                        } finally {
                                            setIsValidatingClaude(false);
                                        }
                                    }}
                                    onDelete={async () => {
                                        if (!authData?.email) {
                                            setApiKeyMessage('User email is required');
                                            return;
                                        }
                                        await deleteApiKey('claude', authData.email);
                                        setClaudeApiKey('');
                                        setClaudeKeyStatus('unknown');
                                        setApiKeyMessage('Claude API key deleted');
                                    }}
                                />

                                {/* Brave Search API Key */}
                                <ApiKeyInput
                                    id="braveApiKey"
                                    label="Brave Search API Key"
                                    value={braveApiKey}
                                    onChange={setBraveApiKey}
                                    placeholder="BSA..."
                                    status={braveKeyStatus}
                                    isValidating={isValidatingBrave}
                                    hint="Optional: Used for web search grounding"
                                    onSave={async () => {
                                        setIsValidatingBrave(true);
                                        try {
                                            if (!authData?.email) {
                                                setApiKeyMessage('User email is required');
                                                return;
                                            }
                                            await saveApiKey({ service: 'brave' as any, key: braveApiKey }, authData.email);
                                            const isValid = await validateApiKey('brave' as any, authData.email);
                                            setBraveKeyStatus(isValid ? 'valid' : 'invalid');
                                            setApiKeyMessage(isValid ? 'Brave Search API key saved and validated' : 'Key saved but validation failed');
                                        } catch (error) {
                                            setBraveKeyStatus('invalid');
                                            setApiKeyMessage('Failed to save Brave Search API key');
                                        } finally {
                                            setIsValidatingBrave(false);
                                        }
                                    }}
                                    onDelete={async () => {
                                        if (!authData?.email) {
                                            setApiKeyMessage('User email is required');
                                            return;
                                        }
                                        await deleteApiKey('brave' as any, authData.email);
                                        setBraveApiKey('');
                                        setBraveKeyStatus('unknown');
                                        setApiKeyMessage('Brave Search API key deleted');
                                    }}
                                />

                                {/* Stability API Key */}
                                <ApiKeyInput
                                    id="stabilityApiKey"
                                    label="Stability API Key"
                                    value={stabilityApiKey}
                                    onChange={setStabilityApiKey}
                                    placeholder="sk-..."
                                    status={stabilityKeyStatus}
                                    isValidating={isValidatingStability}
                                    hint="Required for AI image generation"
                                    onSave={async () => {
                                        setIsValidatingStability(true);
                                        try {
                                            if (!authData?.email) {
                                                setApiKeyMessage('User email is required');
                                                return;
                                            }
                                            await saveApiKey({ service: 'stability', key: stabilityApiKey }, authData.email);
                                            const isValid = await validateApiKey('stability', authData.email);
                                            setStabilityKeyStatus(isValid ? 'valid' : 'invalid');
                                            setApiKeyMessage(isValid ? 'Stability API key saved and validated' : 'Key saved but validation failed');
                                        } catch (error) {
                                            setStabilityKeyStatus('invalid');
                                            setApiKeyMessage('Failed to save Stability API key');
                                        } finally {
                                            setIsValidatingStability(false);
                                        }
                                    }}
                                    onDelete={async () => {
                                        if (!authData?.email) {
                                            setApiKeyMessage('User email is required');
                                            return;
                                        }
                                        await deleteApiKey('stability', authData.email);
                                        setStabilityApiKey('');
                                        setStabilityKeyStatus('unknown');
                                        setApiKeyMessage('Stability API key deleted');
                                    }}
                                />

                                {/* Google Integration Subheading */}
                                <div className="mt-6 mb-4">
                                    <h4 className="font-sans text-ui font-semibold text-ink">Google Integration</h4>
                                    <p className="font-sans text-caption text-slate mt-1">
                                        Configure Google Cloud credentials for Drive, Sheets, and Gmail.
                                    </p>
                                </div>

                                {/* Google API Key */}
                                <ApiKeyInput
                                    id="googleApiKey"
                                    label="Google API Key"
                                    value={googleApiKey}
                                    onChange={setGoogleApiKey}
                                    placeholder="AIza..."
                                    status={googleApiKeyStatus}
                                    isValidating={isValidatingGoogleApiKey}
                                    hint="From Google Cloud Console → APIs & Services → Credentials"
                                    onSave={async () => {
                                        setIsValidatingGoogleApiKey(true);
                                        try {
                                            if (!authData?.email) {
                                                setApiKeyMessage('User email is required');
                                                return;
                                            }
                                            await saveApiKey({ service: 'google_api_key' as any, key: googleApiKey }, authData.email);
                                            setGoogleApiKeyStatus('valid');
                                            setApiKeyMessage('Google API key saved');
                                            onGoogleCredentialsSaved?.(); // Re-initialize Google API with new credentials
                                        } catch (error) {
                                            setGoogleApiKeyStatus('invalid');
                                            setApiKeyMessage('Failed to save Google API key');
                                        } finally {
                                            setIsValidatingGoogleApiKey(false);
                                        }
                                    }}
                                    onDelete={async () => {
                                        if (!authData?.email) {
                                            setApiKeyMessage('User email is required');
                                            return;
                                        }
                                        await deleteApiKey('google_api_key' as any, authData.email);
                                        setGoogleApiKey('');
                                        setGoogleApiKeyStatus('unknown');
                                        setApiKeyMessage('Google API key deleted');
                                    }}
                                />

                                {/* Google OAuth Client ID */}
                                <ApiKeyInput
                                    id="googleClientId"
                                    label="Google OAuth Client ID"
                                    value={googleClientId}
                                    onChange={setGoogleClientId}
                                    placeholder="123456789-xxx.apps.googleusercontent.com"
                                    status={googleClientIdStatus}
                                    isValidating={isValidatingGoogleClientId}
                                    hint="OAuth 2.0 Client ID from Google Cloud Console"
                                    onSave={async () => {
                                        setIsValidatingGoogleClientId(true);
                                        try {
                                            if (!authData?.email) {
                                                setApiKeyMessage('User email is required');
                                                return;
                                            }
                                            await saveApiKey({ service: 'google_client_id' as any, key: googleClientId }, authData.email);
                                            setGoogleClientIdStatus('valid');
                                            setApiKeyMessage('Google Client ID saved');
                                            onGoogleCredentialsSaved?.(); // Re-initialize Google API with new credentials
                                        } catch (error) {
                                            setGoogleClientIdStatus('invalid');
                                            setApiKeyMessage('Failed to save Google Client ID');
                                        } finally {
                                            setIsValidatingGoogleClientId(false);
                                        }
                                    }}
                                    onDelete={async () => {
                                        if (!authData?.email) {
                                            setApiKeyMessage('User email is required');
                                            return;
                                        }
                                        await deleteApiKey('google_client_id' as any, authData.email);
                                        setGoogleClientId('');
                                        setGoogleClientIdStatus('unknown');
                                        setApiKeyMessage('Google Client ID deleted');
                                    }}
                                />

                                {/* Google OAuth Client Secret */}
                                <ApiKeyInput
                                    id="googleClientSecret"
                                    label="Google OAuth Client Secret"
                                    value={googleClientSecret}
                                    onChange={setGoogleClientSecret}
                                    placeholder="GOCSPX-..."
                                    status={googleClientSecretStatus}
                                    isValidating={isValidatingGoogleClientSecret}
                                    hint="OAuth 2.0 Client Secret from Google Cloud Console (required for server-side auth)"
                                    onSave={async () => {
                                        setIsValidatingGoogleClientSecret(true);
                                        try {
                                            if (!authData?.email) {
                                                setApiKeyMessage('User email is required');
                                                return;
                                            }
                                            await saveApiKey({ service: 'google_client_secret' as any, key: googleClientSecret }, authData.email);
                                            setGoogleClientSecretStatus('valid');
                                            setApiKeyMessage('Google Client Secret saved');
                                            onGoogleCredentialsSaved?.();
                                        } catch (error) {
                                            setGoogleClientSecretStatus('invalid');
                                            setApiKeyMessage('Failed to save Google Client Secret');
                                        } finally {
                                            setIsValidatingGoogleClientSecret(false);
                                        }
                                    }}
                                    onDelete={async () => {
                                        if (!authData?.email) {
                                            setApiKeyMessage('User email is required');
                                            return;
                                        }
                                        await deleteApiKey('google_client_secret' as any, authData.email);
                                        setGoogleClientSecret('');
                                        setGoogleClientSecretStatus('unknown');
                                        setApiKeyMessage('Google Client Secret deleted');
                                    }}
                                />

                                {/* API Key Message */}
                                <AnimatePresence>
                                    {apiKeyMessage && (
                                        <motion.p
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            className={`font-sans text-ui p-3 mt-4 ${
                                                apiKeyMessage.includes('failed') || apiKeyMessage.includes('Invalid')
                                                    ? 'bg-red-50 text-editorial-red border-l-2 border-editorial-red'
                                                    : 'bg-pearl text-ink border-l-2 border-ink'
                                            }`}
                                        >
                                            {apiKeyMessage}
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                            </section>
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-4 bg-pearl border-t border-border-subtle flex justify-end items-center gap-4">
                            <button
                                onClick={onClose}
                                className="font-sans text-ui text-slate hover:text-ink transition-colors px-4 py-2"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="bg-ink text-paper font-sans text-ui font-medium px-6 py-2 hover:bg-charcoal transition-colors"
                            >
                                Save Settings
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
