/**
 * Contexts Index
 *
 * Phase 6: React Context architecture for state management
 *
 * Provider composition order (from AppProviders.tsx):
 * UIProvider → AuthProvider → SettingsProvider → TopicsProvider → PresetsProvider → NewsletterProvider
 */

// Phase 6a: Auth and UI contexts
export { AuthProvider, useAuth, useIsAuthenticated } from './AuthContext';
export { UIProvider, useUI, useNavigation, useLoading, useError, useModals } from './UIContext';
export type { ActivePage, ErrorState, WorkflowStatus, EditingImage } from './UIContext';

// Phase 6b: Settings context
export { SettingsProvider, useSettings, useIsGoogleDriveConfigured } from './SettingsContext';

// Phase 6c: Topics context
export { TopicsProvider, useTopics, useSelectedTopics, useTrendingContent, useAudienceSelection } from './TopicsContext';
export type { AudienceOption } from './TopicsContext';
export { DEFAULT_AUDIENCE_OPTIONS } from './TopicsContext';

// Phase 6d: Presets context
export { PresetsProvider, usePresets } from './PresetsContext';

// Phase 6e: Newsletter context
export {
  NewsletterProvider,
  useNewsletter,
  useNewsletterGeneration,
  useNewsletterFormat,
  useWorkflowActions,
  useCustomAudiences,
  useNewsletterSettings,
} from './NewsletterContext';
export type { ToneOption, FlavorOption, ImageStyleOption } from './NewsletterContext';
export {
  DEFAULT_TONE_OPTIONS,
  DEFAULT_FLAVOR_OPTIONS,
  DEFAULT_IMAGE_STYLE_OPTIONS,
} from './NewsletterContext';

// Phase 6a-f: App providers composition
export { AppProviders } from './AppProviders';
