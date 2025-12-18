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