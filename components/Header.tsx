import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SettingsIcon, LogOutIcon } from './IconComponents';
import { dropdown } from '../utils/animations';
import type { GapiAuthData } from '../types';

interface HeaderProps {
    onSettingsClick: () => void;
    onSignOut?: () => void;
    authData?: GapiAuthData | null;
}

export const Header: React.FC<HeaderProps> = ({ onSettingsClick, onSignOut, authData }) => {
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsProfileDropdownOpen(false);
            }
        };

        if (isProfileDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isProfileDropdownOpen]);

    return (
        <header className="bg-paper border-b border-border-subtle sticky top-0 z-50">
            <div className="max-w-screen-2xl mx-auto px-6 lg:px-8">
                <div className="flex items-center justify-between h-14">
                    {/* Logo / Wordmark */}
                    <div className="flex items-center">
                        <h1 className="font-display text-xl tracking-tight text-ink">
                            AI for PI
                        </h1>
                        <span className="hidden sm:inline-block ml-3 text-overline text-slate uppercase tracking-widest">
                            Newsletter Studio
                        </span>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-4">
                        {/* User Profile Section */}
                        {authData && (
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                                    className="flex items-center gap-2 py-1.5 text-slate hover:text-ink transition-colors"
                                    aria-label="User profile"
                                    aria-expanded={isProfileDropdownOpen}
                                >
                                    <span className="hidden sm:inline text-ui font-sans">
                                        {authData.email}
                                    </span>
                                    <div className="flex items-center justify-center h-7 w-7 bg-ink text-paper text-xs font-medium">
                                        {authData.name?.charAt(0).toUpperCase() || authData.email?.charAt(0).toUpperCase()}
                                    </div>
                                </button>

                                {/* Profile Dropdown Menu */}
                                <AnimatePresence>
                                    {isProfileDropdownOpen && (
                                        <motion.div
                                            variants={dropdown}
                                            initial="hidden"
                                            animate="visible"
                                            exit="exit"
                                            className="absolute right-0 mt-2 w-64 bg-paper border border-border-subtle shadow-editorial-modal z-50"
                                        >
                                            <div className="px-4 py-3 border-b border-border-subtle">
                                                <p className="font-sans text-ui font-medium text-ink">
                                                    {authData.name || 'User'}
                                                </p>
                                                <p className="text-caption text-slate mt-0.5">
                                                    {authData.email}
                                                </p>
                                            </div>
                                            {onSignOut && (
                                                <button
                                                    onClick={() => {
                                                        onSignOut();
                                                        setIsProfileDropdownOpen(false);
                                                    }}
                                                    className="w-full flex items-center gap-2 px-4 py-3 text-ui font-sans text-editorial-red hover:bg-pearl transition-colors"
                                                >
                                                    <LogOutIcon className="h-4 w-4" />
                                                    Sign Out
                                                </button>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {/* Settings Button */}
                        <button
                            onClick={onSettingsClick}
                            className="p-2 text-slate hover:text-ink transition-colors"
                            aria-label="Open settings"
                        >
                            <SettingsIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};
