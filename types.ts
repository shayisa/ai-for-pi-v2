export interface NewsletterSection {
  title: string;
  content: string;
  imagePrompt: string;
  imageUrl?: string;
}

export interface PromptOfTheDay {
  title: string;
  summary: string;
  examplePrompts: string[];
  promptCode: string; // The full prompt code including XML-like tags
  savedPromptId?: string; // Reference to saved_prompts.id if loaded from library (Phase 9c)
}

export interface Newsletter {
  id?: string; // Unique identifier for tracking
  subject: string;
  introduction: string;
  sections: NewsletterSection[];
  conclusion: string;
  promptOfTheDay?: PromptOfTheDay; // New optional field
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
  };
}

export interface TrendingTopic {
  title: string;
  summary: string;
  /** Phase 15.3: Optional unique identifier for tracking */
  id?: string;
  /** Phase 15.3: Optional audience this topic was generated for */
  audienceId?: string;
  /** Phase 15.3c: Rich format fields matching ActionableCapability */
  whatItIs?: string;
  newCapability?: string;
  whoShouldCare?: string;
  howToGetStarted?: string;
  expectedImpact?: string;
  resource?: string;
}

/**
 * Phase 15.4: Suggested topic with audience association
 * Used for "Suggest Topics" feature with per-audience generation
 * Phase 15.5: Added resource field for source URL
 * Phase 16 fix: Added rich context fields to preserve topic context through pipeline
 */
export interface SuggestedTopic {
  title: string;
  audienceId: string;
  resource?: string; // Source URL for the topic
  // Phase 16 fix: Rich context fields for proper article generation
  summary?: string;
  whatItIs?: string;
  newCapability?: string;
  whoShouldCare?: string;
  howToGetStarted?: string;
  expectedImpact?: string;
}

export interface GoogleSettings {
    driveFolderName: string;
}

export interface Subscriber {
  email: string;
  name?: string;
  status: 'active' | 'inactive';
  lists: string; // Comma-separated list IDs (e.g., "ABC,XYZ")
  dateAdded: string; // ISO timestamp
  dateRemoved?: string; // ISO timestamp, only if inactive
  source?: string; // e.g., "manual", "import", "migrated"
}

export interface SubscriberList {
  id: string; // 5-char unique ID
  name: string;
  description?: string;
  dateCreated: string; // ISO timestamp
  subscriberCount: number; // Synced from subscriber sheet
}

// Type for the data returned by Google's token client
export interface GapiAuthData {
    access_token: string;
    email: string;
    name: string;
    // Add other fields you might need from the user profile
}

export interface Preset {
  name: string;
  settings: {
    selectedAudience: Record<string, boolean>;
    selectedTone: string;
    selectedFlavors: Record<string, boolean>;
    selectedImageStyle: string;
    selectedTopics: string[];
    personaId?: string; // Phase 12.0: Optional persona for backward compatibility
  };
}

export interface HistoryItem {
  id: string;
  date: string;
  subject: string;
  newsletter: Newsletter;
  topics: string[];
}

// Archive types for trending data persistence
export interface ArchiveContent {
  trendingTopics?: TrendingTopic[];
  compellingContent?: CompellingContent;
  trendingSources?: TrendingSource[];
  metadata?: {
    sourceCount: number;
    generatedAt: string;
  };
}

export interface CompellingContent {
  actionableCapabilities?: ActionableCapability[];
  essentialTools?: EssentialTool[];
}

export interface ActionableCapability {
  title: string;
  description: string;
  whatItIs?: string;
  newCapability?: string;
  whoShouldCare?: string;
  howToGetStarted?: string;
  expectedImpact?: string;
  resource?: string;
  implementationGuide?: string;
  relevantTools?: string[];
}

export interface EssentialTool {
  name: string;
  purpose?: string;
  description?: string;
  whyNow?: string;
  url?: string;
  link?: string;
}

export interface TrendingSource {
  id: string;
  title: string;
  url: string;
  author?: string;
  publication?: string;
  date?: string;
  category: 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev';
  summary?: string;
}

export interface Archive {
  id: string;
  createdAt: string;
  name: string;
  audience: string[];
  content: ArchiveContent;
}

// ============================================================================
// Enhanced Newsletter Types (v2 Format)
// ============================================================================

export interface ToolOfTheDay {
  name: string;
  url: string;
  whyNow: string;
  quickStart: string;
}

export interface PracticalPrompt {
  scenario: string;
  prompt: string;
  isToolSpecific: boolean;
}

export interface SourceCitation {
  url: string;
  title: string;
}

export interface SectionCTA {
  text: string;
  action: 'copy_prompt' | 'visit_url';
}

export interface EnhancedAudienceSection {
  audienceId: string;
  audienceName: string;
  title: string;
  whyItMatters: string;
  content: string;
  practicalPrompt: PracticalPrompt;
  cta: SectionCTA;
  sources: SourceCitation[];
  imagePrompt?: string;
  imageUrl?: string;
}

export interface EditorsNote {
  message: string;
}

export interface EnhancedNewsletter {
  id?: string;
  editorsNote: EditorsNote;
  toolOfTheDay: ToolOfTheDay;
  audienceSections: EnhancedAudienceSection[];
  conclusion: string;
  // Legacy compatibility fields
  subject?: string;
  promptOfTheDay?: PromptOfTheDay;
}

// Dynamic Audience Configuration
export interface AudienceConfig {
  id: string;
  name: string;
  description: string;
  isCustom?: boolean;
  generated?: {
    persona: string;
    relevance_keywords: string[];
    subreddits: string[];
    arxiv_categories: string[];
    search_templates: string[];
  };
}

// ============================================================================
// Hierarchical Audience Types (Phase 15.2 - Audience Restructure)
// ============================================================================

/**
 * Parent category for audience grouping (Academic, Business)
 * Users can select at this level to include all child specializations
 */
export interface AudienceCategory {
  id: 'academic' | 'business';
  name: string;
  children: string[]; // Child specialization IDs
}

/**
 * Specific audience specialization with tailored content generation parameters
 * Each specialization has its own domain context, examples, and source preferences
 */
export interface AudienceSpecialization {
  id: string;
  parentId: 'academic' | 'business';
  name: string;
  description: string; // Domain-specific keywords for prompt context
  domainExamples: string; // Example use cases for this specialization
  jsonExamples: AudienceJsonExample[]; // Format examples for Claude
  topicTitles: string[]; // Example topic titles for this specialization
  sourcePreferences: AudienceSourcePreference[]; // Which APIs to prioritize
}

export interface AudienceJsonExample {
  title: string;
  summary: string;
}

export type AudienceSourcePreference = 'arxiv' | 'hackernews' | 'github' | 'reddit' | 'dev' | 'gdelt';

/**
 * Legacy audience ID mapping for backward compatibility
 * Maps old combined IDs to new specialization IDs
 */
export const LEGACY_AUDIENCE_MAPPING: Record<string, string[]> = {
  'academics': ['forensic-anthropology', 'computational-archaeology'],
  'business': ['business-administration', 'business-intelligence'],
  'analysts': ['business-intelligence'], // Merged into business-intelligence
};

// Extended history item for enhanced newsletters
export interface EnhancedHistoryItem {
  id: string;
  date: string;
  subject: string;
  newsletter: Newsletter | EnhancedNewsletter;
  topics: string[];
  formatVersion: 'v1' | 'v2';
}

// ============================================================================
// System Logs Types
// ============================================================================

export type LogSource = 'newsletter' | 'api_audit';

export type NewsletterLogAction = 'created' | 'saved_to_drive' | 'sent_email' | 'scheduled_send';
export type ApiAuditLogAction = 'save' | 'delete' | 'validate_success' | 'validate_failure';

export interface UnifiedLogEntry {
  id: number;
  source: LogSource;
  timestamp: string;
  action: string;
  // Newsletter-specific
  newsletterId: string | null;
  newsletterSubject: string | null;
  // API audit-specific
  userEmail: string | null;
  service: string | null;
  ipAddress: string | null;
  // Shared
  details: Record<string, unknown> | null;
}

export interface LogFilterOptions {
  source?: LogSource;
  action?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface LogsResponse {
  logs: UnifiedLogEntry[];
  total: number;
  hasMore: boolean;
}

export interface LogStats {
  totalNewsletter: number;
  totalApiAudit: number;
  byAction: Record<string, number>;
}

// ============================================================================
// Writer Persona Types
// ============================================================================

export interface WriterPersona {
  id: string;
  name: string;
  tagline: string | null;
  expertise: string | null;
  values: string | null;
  writingStyle: string | null;
  signatureElements: string[];
  sampleWriting: string | null;
  isActive: boolean;
  isDefault: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersonaStats {
  total: number;
  default: number;
  custom: number;
  active: string | null;
}

// ============================================================================
// Image Style Thumbnail Types
// ============================================================================

export interface StyleThumbnail {
  id: string;
  styleName: string;
  thumbnailBase64: string;
  mimeType: string;
  prompt: string;
  createdAt: string;
}

export interface ThumbnailStatus {
  total: number;
  generated: number;
  missing: string[];
}

// ============================================================================
// Prompt Import Types (Phase 11)
// ============================================================================

export type ImportSourceType = 'url' | 'file' | 'paste';
export type ParsingMethod = 'regex' | 'ai' | 'template';

export interface ImportedPromptFields {
  title: string;
  summary: string;
  examplePrompts: string[];
  promptCode: string;
}

export interface PromptImportResult {
  success: boolean;
  fields?: ImportedPromptFields;
  parsingMethod: ParsingMethod;
  templateId?: string;
  confidence?: number;
  error?: string;
  processingTimeMs: number;
}

export interface PromptImportTemplate {
  id: string;
  name: string;
  sourceType: ImportSourceType;
  sourcePattern: string;
  parsingInstructions: string;
  fieldPatterns: FieldPatterns;
  successCount: number;
  failureCount: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface FieldPatterns {
  title?: RegexPattern;
  summary?: RegexPattern;
  examplePrompts?: RegexPattern;
  promptCode?: RegexPattern;
}

export interface RegexPattern {
  pattern: string;
  flags?: string;
  groupIndex?: number;
}

export interface PromptImportLog {
  id: number;
  importId: string;
  sourceType: ImportSourceType;
  sourceIdentifier: string;
  templateId?: string;
  parsingMethod: ParsingMethod;
  success: boolean;
  errorMessage?: string;
  parsedFields?: ImportedPromptFields;
  rawContentLength: number;
  processingTimeMs: number;
  createdAt: string;
}

// ============================================================================
// Phase 16: Per-Audience Newsletter Generation Types
// ============================================================================

/**
 * Topic with explicit audience association for per-audience generation
 * Extends SuggestedTopic with additional fields for mismatch tracking
 * Phase 16 fix: Added rich context fields to preserve topic context through pipeline
 */
export interface TopicWithAudienceId {
  title: string;
  audienceId: string;
  summary?: string;
  resource?: string;
  /** Original audienceId if topic was reassigned during mismatch resolution */
  reassignedFrom?: string;
  // Phase 16 fix: Rich context fields for proper article generation
  whatItIs?: string;
  newCapability?: string;
  whoShouldCare?: string;
  howToGetStarted?: string;
  expectedImpact?: string;
}

/**
 * Actions available when resolving topic-audience mismatches
 */
export type MismatchResolutionAction = 'reassign' | 'generate_fresh' | 'skip';

/**
 * User decision for resolving a single topic-audience mismatch
 */
export interface MismatchResolution {
  topic: TopicWithAudienceId;
  action: MismatchResolutionAction;
  /** Target audience ID when action is 'reassign' */
  targetAudienceId?: string;
  /** Apply this resolution to all similar mismatches */
  applyToAll?: boolean;
}

/**
 * Information about a topic-audience mismatch for the modal
 */
export interface MismatchInfo {
  topic: TopicWithAudienceId;
  originalAudienceId: string;
  originalAudienceName: string;
  suggestedAudienceId: string | null;
  suggestedAudienceName: string | null;
  sameCategoryOptions: AudienceConfig[];
  reason?: string;
}

/**
 * Map of audience ID to assigned topics
 * Note: Uses Map internally but serialized to Record for API responses
 */
export type BalancedTopicMap = Map<string, TopicWithAudienceId[]>;

/**
 * Result of topic-audience balancing analysis
 */
export interface TopicAudienceBalanceResult {
  /** Map of audienceId to assigned topics */
  balancedMap: BalancedTopicMap;
  /** Audiences with no assigned topics */
  orphanedAudiences: AudienceConfig[];
  /** Topics that couldn't be matched to selected audiences */
  unmatchedTopics: TopicWithAudienceId[];
  /** Topics that were reassigned from their original audience */
  reassignedTopics: TopicWithAudienceId[];
  /** Whether user intervention is needed */
  hasMismatches: boolean;
  stats: {
    totalTopics: number;
    matchedTopics: number;
    orphanedAudienceCount: number;
    mismatchCount: number;
  };
}

/**
 * Parameters for V4 per-audience newsletter generation
 */
export interface PerAudienceGenerationParams {
  audiences: AudienceConfig[];
  /** Pre-selected topics with audience tags */
  selectedTopics?: TopicWithAudienceId[];
  /** Number of topics to generate per audience if not using selectedTopics */
  topicsPerAudience?: number;
  tone: string;
  flavors: string[];
  imageStyle?: string;
  personaId?: string;
  promptOfTheDay?: PromptOfTheDay;
}

/**
 * Result of V4 per-audience newsletter generation
 */
export interface PerAudienceNewsletterResult {
  success: boolean;
  newsletter?: EnhancedNewsletter;
  sectionResults: AudienceSectionResult[];
  appliedOverlaps: StrategicOverlap[];
  balanceResult: TopicAudienceBalanceResult;
  metrics: GenerationMetrics;
  error?: string;
}

/**
 * Strategic overlap between platforms/tools across audiences
 */
export interface StrategicOverlap {
  originalTopic: TopicWithAudienceId;
  originalAudienceId: string;
  suggestedTopic: string;
  targetAudienceId: string;
  overlapType: 'platform-equivalent';
  confidence: number;
}

/**
 * Mapping of equivalent platforms/tools for strategic overlap detection
 */
export interface PlatformEquivalent {
  platform: string;
  equivalents: string[];
  category: 'ai-model' | 'cloud' | 'productivity' | 'framework' | 'language';
}

/**
 * Result for a single audience section generation
 */
export interface AudienceSectionResult {
  audienceId: string;
  audienceName: string;
  section: EnhancedAudienceSection;
  topics: TopicWithAudienceId[];
  sources: SourceCitation[];
  generationTimeMs: number;
}

/**
 * Metrics tracking for V4 generation pipeline
 */
export interface GenerationMetrics {
  totalTimeMs: number;
  topicGenerationTimeMs: number;
  sourceAllocationTimeMs: number;
  contentGenerationTimeMs: number;
  /** Ratio of parallel vs sequential time savings */
  parallelEfficiency: number;
}

/**
 * Source with fetched content for per-audience section generation
 */
export interface SourceWithContent {
  url: string;
  title: string;
  content?: string;
  snippet?: string;
  publication?: string;
  category?: string;
}