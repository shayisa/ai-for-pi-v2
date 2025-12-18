/**
 * Stability AI API Client
 *
 * Provides image generation functionality via Stability AI.
 * Keys are loaded from SQLite first, then environment variables.
 *
 * @module external/stability/client
 *
 * ## Original Location
 * - server.ts lines 1801-1885
 *
 * ## PRESERVATION NOTE
 * This code was extracted EXACTLY from server.ts without modification.
 * Do NOT change the image style mappings, API endpoint, or parameters.
 */
import * as apiKeyDbService from '../../services/apiKeyDbService';

/**
 * Image style mappings for Stability AI prompts
 *
 * Maps user-friendly style names to descriptive prompts.
 *
 * @constant imageStyleMap
 */
export const imageStyleMap: Record<string, string> = {
  photorealistic: "photorealistic",
  vector: "vector illustration",
  watercolor: "watercolor painting",
  pixel: "pixel art",
  minimalist: "minimalist line art",
  oilPainting: "oil painting",
  cyberpunk: "cyberpunk neon-lit futuristic",
  abstract: "abstract non-representational art",
  isometric: "isometric 3D perspective",
};

/**
 * Get Stability AI API key
 *
 * Resolution order:
 * 1. SQLite database (adminEmail's 'stability' key)
 * 2. VITE_STABILITY_API_KEY environment variable
 *
 * @returns {string | null} API key or null if not configured
 */
export const getStabilityApiKey = (): string | null => {
  const adminEmail = process.env.ADMIN_EMAIL;

  // Try SQLite first, fallback to env var
  let apiKey = adminEmail ? apiKeyDbService.getApiKey(adminEmail, 'stability') : null;
  if (!apiKey) {
    apiKey = process.env.VITE_STABILITY_API_KEY || null;
  }

  return apiKey;
};

/**
 * Generate result type
 */
export interface GenerateImageResult {
  success: boolean;
  image?: string;
  error?: string;
  details?: string;
}

/**
 * Generate an image using Stability AI
 *
 * Uses the Stable Image Generate Core endpoint.
 *
 * @param prompt - Text prompt describing the desired image
 * @param imageStyle - Style preset key (default: 'photorealistic')
 * @returns Generated image as base64 or error
 *
 * API Configuration:
 * - Endpoint: https://api.stability.ai/v2beta/stable-image/generate/core
 * - Output format: PNG
 * - Aspect ratio: 1:1
 *
 * @example
 * const result = await generateImage("A futuristic AI robot", "cyberpunk");
 * if (result.success) {
 *   console.log(result.image); // base64 PNG
 * }
 */
export const generateImage = async (
  prompt: string,
  imageStyle: string = 'photorealistic'
): Promise<GenerateImageResult> => {
  const apiKey = getStabilityApiKey();

  if (!apiKey) {
    return {
      success: false,
      error: "Stability AI API key not configured",
    };
  }

  const styleDescription = imageStyleMap[imageStyle] || "photorealistic";

  // Prepend style to prompt to ensure it's applied
  const styledPrompt = `${styleDescription} style: ${prompt}`;

  console.log(`Generating image for prompt: ${styledPrompt.substring(0, 80)}...`);

  try {
    const formData = new FormData();
    formData.append("prompt", styledPrompt);
    formData.append("output_format", "png");
    formData.append("aspect_ratio", "1:1");

    const response = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Stability AI error:", response.status, errorText);
      return {
        success: false,
        error: `Stability AI API error: ${response.status}`,
        details: errorText,
      };
    }

    const responseJson = await response.json() as {
      image?: string;
      errors?: string[];
    };

    if (responseJson.errors && responseJson.errors.length > 0) {
      return {
        success: false,
        error: "Image generation failed",
        details: responseJson.errors.join(", "),
      };
    }

    if (responseJson.image) {
      console.log("Image generated successfully");
      return {
        success: true,
        image: responseJson.image,
      };
    }

    return {
      success: false,
      error: "No image in Stability AI response",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error generating image:", errorMessage);
    return {
      success: false,
      error: "Failed to generate image",
      details: errorMessage,
    };
  }
};
