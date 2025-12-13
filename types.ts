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
    logSheetName: string;
    subscribersSheetName: string;
    groupListSheetName?: string; // New: for subscriber lists
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
  };
}

export interface HistoryItem {
  id: number;
  date: string;
  subject: string;
  newsletter: Newsletter;
  topics: string[];
}