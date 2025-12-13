import { withRetry } from "../utils/retry";

// Backend API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Helper functions (kept for consistency, used by UI only)
const getAudienceDescription = (audience: string[]): string => {
  const audienceMap: Record<string, string> = {
    academics:
      "- Forensic anthropology and digital/computational archeology professors.",
    business: "- Business administrators and leaders upskilling in AI.",
    analysts:
      "- Business analytics analysts seeking new ways to extract intelligence from structured and unstructured data lakes.",
  };

  if (audience.length === 0 || audience.length === 3) {
    return `
- Forensic anthropology and digital/computational archeology professors teaching university courses.
- Business administrators and leaders looking to upskill their AI knowledge to maintain career goals and improve efficiency.
- Business analytics analysts seeking new ways to extract intelligence from structured and unstructured data lakes.
        `;
  }

  return audience.map((key) => audienceMap[key]).join("\n");
};

const getFlavorInstructions = (flavors: string[]): string => {
  if (flavors.length === 0) return "";

  const flavorMap: Record<string, string> = {
    includeHumor:
      "- You may sprinkle in one or two instances of light-hearted, clever humor where appropriate, without undermining the main tone.",
    useSlang:
      "- You may incorporate some modern, conversational slang to make the content feel more relatable and authentic.",
    useJargon:
      "- You should incorporate relevant technical jargon where it adds precision and is appropriate for the expert audience.",
    useAnalogies:
      "- You should use relatable analogies and simple metaphors to explain complex technical concepts.",
    citeData:
      "- Wherever possible, you should cite specific data points, statistics, or findings to add authority and credibility to your points.",
  };

  const instructions = flavors.map((key) => flavorMap[key]).filter(Boolean);

  if (instructions.length === 0) return "";

  return `

    Additionally, adhere to the following stylistic instructions:
    ${instructions.join("\n")}
    `;
};

// Main API functions that call the backend

const generateNewsletterContentInternal = async (
  topics: string[],
  audience: string[],
  tone: string,
  flavors: string[],
  imageStyle: string
): Promise<{ text: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/generateNewsletter`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topics,
        audience,
        tone,
        flavors,
        imageStyle,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json() as { text: string };
    return data;
  } catch (error) {
    console.error("Error generating newsletter content:", error);
    throw error;
  }
};

const generateTopicSuggestionsInternal = async (
  audience: string[],
  sources?: string
): Promise<{ text: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/generateTopicSuggestions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audience,
        sources,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json() as { text: string };
    return data;
  } catch (error) {
    console.error("Error generating topic suggestions:", error);
    throw error;
  }
};

const generateTrendingTopicsInternal = async (
  audience: string[]
): Promise<{ text: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/generateTrendingTopics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audience,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json() as { text: string };
    return data;
  } catch (error) {
    console.error("Error generating trending topics:", error);
    throw error;
  }
};

// New: Generate trending topics based on REAL trending data from web sources
interface TrendingSource {
  title: string;
  url: string;
  author?: string;
  publication?: string;
  category: string;
  summary?: string;
}

export interface TrendingWithSourcesResponse {
  text: string;
  sources: TrendingSource[];
}

const generateTrendingTopicsWithSourcesInternal = async (
  audience: string[],
  trendingSources: TrendingSource[]
): Promise<TrendingWithSourcesResponse> => {
  try {
    // Format sources for Claude
    const sourceSummary = trendingSources.map(s =>
      `- "${s.title}" from ${s.publication} (${s.category}): ${s.url}`
    ).join('\n');

    const response = await fetch(`${API_BASE_URL}/api/generateTrendingTopicsWithSources`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audience,
        sources: sourceSummary,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json() as { text: string };
    return {
      text: data.text,
      sources: trendingSources,
    };
  } catch (error) {
    console.error("Error generating trending topics with sources:", error);
    throw error;
  }
};

// Image Generation via Backend (which calls Stability AI)
const generateImageInternal = async (prompt: string, imageStyle?: string): Promise<string> => {
  try {
    const endpoint = `${API_BASE_URL}/api/generateImage`;

    console.log("Attempting image generation via backend...");
    console.log("Prompt:", prompt.substring(0, 100) + "...");
    console.log("Image Style:", imageStyle || "default (photorealistic)");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, imageStyle }),
    });

    console.log("Backend Response Status:", response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json() as { error?: string; details?: string };
      console.error("Backend Error Response:", errorData);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Image generation error: ${response.status} - Authentication failed.`);
      }

      if (response.status === 400) {
        throw new Error(`Image generation error: 400 - ${errorData.details || "Bad request"}`);
      }

      if (response.status === 429) {
        throw new Error(`Image generation error: 429 - Rate limit exceeded. Please wait before retrying.`);
      }

      throw new Error(`Image generation error: ${response.status} - ${errorData.error || response.statusText}`);
    }

    const responseJson = await response.json() as {
      image?: string,
      error?: string
    };

    if (responseJson.error) {
      throw new Error(`Image generation failed: ${responseJson.error}`);
    }

    if (responseJson.image) {
      console.log("Image generated successfully");
      return responseJson.image;
    }

    throw new Error("No image data in response");
  } catch (error) {
    console.error("Error generating image:", error);
    // Return placeholder on error so app doesn't crash
    console.warn("Returning placeholder image due to error");
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  }
};

const editImageInternal = async (
  base64ImageData: string,
  _mimeType: string,
  _prompt: string
): Promise<string> => {
  // Image editing is not currently supported - return original image
  console.warn(
    "Image editing is not currently supported. Returning original image."
  );
  return base64ImageData;
};

export const generateNewsletterContent = withRetry(
  generateNewsletterContentInternal
);
export const generateTopicSuggestions = withRetry(
  generateTopicSuggestionsInternal
);
export const generateTrendingTopics = withRetry(
  generateTrendingTopicsInternal
);
const generateCompellingTrendingContentInternal = async (
  audience: string[]
): Promise<{ text: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/generateCompellingTrendingContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audience,
        sources: "fetch_fresh", // Signal backend to fetch and score fresh sources
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json() as { text: string };
    return data;
  } catch (error) {
    console.error("Error generating compelling trending content:", error);
    throw error;
  }
};

export const generateTrendingTopicsWithSources = withRetry(
  generateTrendingTopicsWithSourcesInternal
);
export const generateCompellingTrendingContent = withRetry(
  generateCompellingTrendingContentInternal
);
export const generateImage = withRetry(generateImageInternal);
export const editImage = withRetry(editImageInternal);

// ===================================================================
// PRESET MANAGEMENT ENDPOINTS
// ===================================================================

export const savePresetsToCloud = async (presets: any[], accessToken: string): Promise<{ message: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/savePresets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        presets,
        accessToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json() as { message: string };
    return data;
  } catch (error) {
    console.error("Error saving presets to cloud:", error);
    throw error;
  }
};

export const loadPresetsFromCloud = async (accessToken: string): Promise<{ presets: any[] }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/loadPresets`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json() as { presets: any[] };
    return data;
  } catch (error) {
    console.error("Error loading presets from cloud:", error);
    throw error;
  }
};
