import React, { useEffect } from 'react';
import { BotIcon, GoogleIcon } from '../components/IconComponents';

interface AuthenticationPageProps {
    onSignIn: () => void;
    isGoogleApiInitialized: boolean;
    isLoading?: boolean;
    autoSignIn?: boolean;
}

export const AuthenticationPage: React.FC<AuthenticationPageProps> = ({
    onSignIn,
    isGoogleApiInitialized,
    isLoading = false,
    autoSignIn = true,
}) => {
    // Auto-trigger sign-in when the page loads and Google API is ready
    useEffect(() => {
        if (autoSignIn && isGoogleApiInitialized && !isLoading) {
            onSignIn();
        }
    }, [isGoogleApiInitialized, autoSignIn, isLoading, onSignIn]);
    return (
        <div className="min-h-screen bg-gradient-to-br from-accent-muted-blue via-white to-accent-salmon/10 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo and Title */}
                <div className="text-center mb-12">
                    <div className="flex justify-center mb-6">
                        <div className="bg-white rounded-full p-4 shadow-lg">
                            <BotIcon className="h-16 w-16 text-accent-salmon" />
                        </div>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-light-blue to-accent-salmon mb-4">
                        AI for PI
                    </h1>
                    <p className="text-lg text-secondary-text mb-2">
                        Your AI-powered Newsletter Generator
                    </p>
                    <p className="text-sm text-secondary-text">
                        Create, manage, and distribute professional newsletters with ease
                    </p>
                </div>

                {/* Authentication Card */}
                <div className="bg-white rounded-2xl shadow-2xl border border-border-light p-8 md:p-12">
                    <h2 className="text-2xl font-bold text-primary-text mb-2 text-center">
                        Get Started
                    </h2>
                    <p className="text-center text-secondary-text mb-8">
                        Sign in with your Google account to access all features including Google Sheets integration
                    </p>

                    {/* Features List */}
                    <div className="space-y-3 mb-8 bg-gray-50 rounded-lg p-6">
                        <div className="flex items-start gap-3">
                            <div className="text-accent-salmon font-bold mt-1">✓</div>
                            <div>
                                <p className="text-sm font-medium text-primary-text">Cloud Preset Sync</p>
                                <p className="text-xs text-secondary-text">Save and load configurations from Google Sheets</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="text-accent-salmon font-bold mt-1">✓</div>
                            <div>
                                <p className="text-sm font-medium text-primary-text">Auto-Save to Drive</p>
                                <p className="text-xs text-secondary-text">Automatically backup newsletters to Google Drive</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="text-accent-salmon font-bold mt-1">✓</div>
                            <div>
                                <p className="text-sm font-medium text-primary-text">Subscriber Management</p>
                                <p className="text-xs text-secondary-text">Manage your mailing list in Google Sheets</p>
                            </div>
                        </div>
                    </div>

                    {/* Sign In Button */}
                    <button
                        onClick={onSignIn}
                        disabled={!isGoogleApiInitialized || isLoading}
                        className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-blue-300 disabled:to-blue-300 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition duration-200 shadow-lg"
                    >
                        <GoogleIcon className="h-6 w-6" />
                        <span>{isLoading ? 'Signing in...' : 'Sign in with Google'}</span>
                    </button>

                    {!isGoogleApiInitialized && (
                        <p className="text-xs text-center text-secondary-text mt-3">
                            Initializing Google authentication...
                        </p>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-secondary-text mt-8">
                    Your data stays secure. We only access what's necessary for the app to function.
                </p>
            </div>
        </div>
    );
};
