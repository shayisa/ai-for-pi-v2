/**
 * AppProviders - Context composition wrapper
 *
 * Phase 6: Provider hierarchy for React Context architecture
 *
 * Provider nesting order is CRITICAL for dependency resolution:
 * UIProvider → AuthProvider → SettingsProvider → TopicsProvider → PresetsProvider → NewsletterProvider
 *
 * Phase 6 Complete: All 6 contexts implemented
 */

import React, { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { UIProvider } from './UIContext';
import { SettingsProvider } from './SettingsContext';
import { TopicsProvider } from './TopicsContext';
import { PresetsProvider } from './PresetsContext';
import { NewsletterProvider } from './NewsletterContext';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Composes all context providers in the correct nesting order.
 *
 * Provider hierarchy explanation:
 * 1. UIProvider (base layer) - error handling, loading, toasts - no dependencies
 * 2. AuthProvider - auth state - uses UI for error display (future)
 * 3. SettingsProvider (Phase 6b) - settings - needs auth
 * 4. TopicsProvider (Phase 6c) - topic management - independent
 * 5. PresetsProvider (Phase 6d) - presets - needs auth for cloud sync
 * 6. NewsletterProvider (Phase 6e) - newsletter state - needs topics + presets
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <UIProvider>
      <AuthProvider>
        <SettingsProvider>
          <TopicsProvider>
            <PresetsProvider>
              <NewsletterProvider>
                {children}
              </NewsletterProvider>
            </PresetsProvider>
          </TopicsProvider>
        </SettingsProvider>
      </AuthProvider>
    </UIProvider>
  );
};

export default AppProviders;
