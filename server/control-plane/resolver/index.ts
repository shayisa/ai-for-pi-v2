/**
 * Resolver Module - Public Exports
 *
 * Provides intent classification and authentication resolution.
 *
 * @module control-plane/resolver
 */

// Intent Classifier
export {
  classifyIntent,
  resolveTools,
  requiresAuth,
  getAuthType,
  getAllRoutePatterns,
} from './intentClassifier.ts';

// Auth Resolver
export {
  resolveAuth,
  validateApiKey,
  validateOAuthToken,
  configureAuthResolver,
  resetAuthResolverConfig,
  type AuthType,
  type AuthResult,
  type ApiKeyValidation,
  type OAuthValidation,
} from './authResolver.ts';
