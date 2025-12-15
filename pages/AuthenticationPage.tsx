import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { GoogleIcon } from '../components/IconComponents';
import { fadeInUp, staggerContainer, staggerItem } from '../utils/animations';

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
    autoSignIn = false, // Disabled by default - OAuth flow redirects to Google consent
}) => {
    // Auto-trigger sign-in when the page loads and Google API is ready
    // Note: Disabled by default since server-side OAuth redirects to Google consent screen
    useEffect(() => {
        if (autoSignIn && isGoogleApiInitialized && !isLoading) {
            onSignIn();
        }
    }, [isGoogleApiInitialized, autoSignIn, isLoading, onSignIn]);

    const features = [
        {
            title: 'AI-Powered Writing',
            description: 'Generate compelling newsletters with Claude AI'
        },
        {
            title: 'Trending Insights',
            description: 'Stay current with real-time topic discovery'
        },
        {
            title: 'Google Workspace',
            description: 'Seamless integration with Drive, Sheets & Gmail'
        },
        {
            title: 'Professional Output',
            description: 'Publication-ready newsletters in minutes'
        }
    ];

    return (
        <div className="min-h-screen bg-pearl flex">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-ink text-paper flex-col justify-between p-12 xl:p-16">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                    <h1 className="font-display text-2xl tracking-tight">
                        AI for PI
                    </h1>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="max-w-lg"
                >
                    <h2 className="font-display text-display leading-tight mb-6">
                        Create beautiful newsletters with AI
                    </h2>
                    <p className="font-serif text-lead text-silver leading-relaxed">
                        Transform trending topics into compelling content.
                        Research, write, and distribute professional newsletters
                        in minutes, not hours.
                    </p>
                </motion.div>

                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="space-y-4"
                >
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            variants={staggerItem}
                            className="flex items-start gap-4"
                        >
                            <div className="w-1 h-1 bg-editorial-red mt-3 flex-shrink-0" />
                            <div>
                                <p className="font-sans text-ui font-medium text-paper">
                                    {feature.title}
                                </p>
                                <p className="font-sans text-caption text-silver">
                                    {feature.description}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </div>

            {/* Right Panel - Sign In */}
            <div className="flex-1 flex items-center justify-center p-8">
                <motion.div
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    className="w-full max-w-sm"
                >
                    {/* Mobile Logo */}
                    <div className="lg:hidden text-center mb-12">
                        <h1 className="font-display text-h1 text-ink mb-2">
                            AI for PI
                        </h1>
                        <p className="font-serif text-body text-slate">
                            Newsletter Studio
                        </p>
                    </div>

                    {/* Sign In Card */}
                    <div className="bg-paper border border-border-subtle p-8">
                        <div className="text-center mb-8">
                            <h2 className="font-display text-h2 text-ink mb-2">
                                Welcome
                            </h2>
                            <p className="font-sans text-ui text-slate">
                                Sign in to start creating
                            </p>
                        </div>

                        {/* Sign In Button */}
                        <button
                            onClick={onSignIn}
                            disabled={!isGoogleApiInitialized || isLoading}
                            className="w-full flex items-center justify-center gap-3 bg-ink hover:bg-charcoal disabled:bg-silver disabled:cursor-not-allowed text-paper font-sans text-ui font-medium py-3.5 px-6 transition-colors duration-200"
                        >
                            <GoogleIcon className="h-5 w-5" />
                            <span>{isLoading ? 'Signing in...' : 'Continue with Google'}</span>
                        </button>

                        {!isGoogleApiInitialized && (
                            <p className="text-caption text-center text-silver mt-4 font-sans">
                                Initializing authentication...
                            </p>
                        )}

                        {/* Divider */}
                        <div className="my-8 border-t border-border-subtle" />

                        {/* Features (Mobile) */}
                        <div className="lg:hidden space-y-3">
                            {features.slice(0, 2).map((feature) => (
                                <div key={feature.title} className="flex items-start gap-3">
                                    <div className="w-1 h-1 bg-editorial-red mt-2 flex-shrink-0" />
                                    <div>
                                        <p className="font-sans text-caption font-medium text-ink">
                                            {feature.title}
                                        </p>
                                        <p className="font-sans text-caption text-slate">
                                            {feature.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Privacy Note */}
                        <p className="hidden lg:block text-caption text-center text-silver mt-6 font-sans">
                            Your data stays private. We only access what's needed.
                        </p>
                    </div>

                    {/* Footer */}
                    <p className="text-caption text-center text-silver mt-6 font-sans">
                        Powered by Claude AI
                    </p>
                </motion.div>
            </div>
        </div>
    );
};
