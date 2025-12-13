import React, { useState } from 'react';
import { BotIcon, SettingsIcon, LogOutIcon, GoogleIcon } from './IconComponents';
import type { GapiAuthData } from '../types';

interface HeaderProps {
    onSettingsClick: () => void;
    onSignOut?: () => void;
    authData?: GapiAuthData | null;
}

export const Header: React.FC<HeaderProps> = ({ onSettingsClick, onSignOut, authData }) => {
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    return (
        <header className="bg-white backdrop-blur-md sticky top-0 z-10 border-b border-border-light">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <BotIcon className="h-8 w-8 text-accent-salmon" />
                            <h1 className="text-xl font-bold text-primary-text">
                                AI for PI
                            </h1>
                        </div>

                        {/* User Profile Section */}
                        {authData && (
                            <div className="relative">
                                <button
                                    onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-secondary-text hover:bg-gray-100 hover:text-primary-text transition-colors"
                                    aria-label="User profile"
                                >
                                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-r from-accent-light-blue to-accent-salmon text-white font-semibold text-sm">
                                        {authData.name?.charAt(0).toUpperCase() || authData.email?.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="hidden sm:flex flex-col items-start">
                                        <span className="text-sm font-medium text-primary-text">{authData.name || 'User'}</span>
                                        <span className="text-xs text-secondary-text">{authData.email}</span>
                                    </div>
                                </button>

                                {/* Profile Dropdown Menu */}
                                {isProfileDropdownOpen && (
                                    <div className="absolute left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-border-light z-20">
                                        <div className="p-4 border-b border-border-light">
                                            <p className="font-semibold text-primary-text text-sm">{authData.name || 'User'}</p>
                                            <p className="text-xs text-secondary-text mt-1">{authData.email}</p>
                                        </div>
                                        {onSignOut && (
                                            <button
                                                onClick={() => {
                                                    onSignOut();
                                                    setIsProfileDropdownOpen(false);
                                                }}
                                                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                            >
                                                <LogOutIcon className="h-4 w-4" />
                                                Sign Out
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right side buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onSettingsClick}
                            className="p-2 rounded-full text-secondary-text hover:bg-gray-100 hover:text-primary-text transition-colors"
                            aria-label="Open settings"
                        >
                            <SettingsIcon className="h-6 w-6" />
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};