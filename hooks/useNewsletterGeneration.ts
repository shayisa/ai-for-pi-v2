/**
 * useNewsletterGeneration Hook
 *
 * Manages newsletter generation state including:
 * - Newsletter content
 * - Loading states with progress
 * - Error handling with retry
 * - Image editing
 */

import { useState, useCallback } from 'react';
import type { Newsletter, NewsletterSection, PromptOfTheDay } from '../types';
import { generateNewsletterContent, generateImage } from '../services/claudeService';
import { extractStrictJson } from '../utils/stringUtils';

// Error state type (matches App.tsx)
interface ErrorState {
  message: string;
  onRetry?: () => void;
  recoverable?: boolean;
}

// Helper to create error state from any error
function createErrorState(error: unknown, retryFn?: () => Promise<any>): ErrorState {
  if (error instanceof Error) {
    return {
      message: error.message,
      onRetry: retryFn,
      recoverable: true,
    };
  }
  return {
    message: 'An unexpected error occurred',
    onRetry: retryFn,
    recoverable: true,
  };
}

interface EditingImage {
  index: number;
  src: string;
  mimeType: string;
  prompt: string;
}

interface UseNewsletterGenerationReturn {
  // State
  newsletter: Newsletter | null;
  loading: string | null;
  progress: number;
  error: ErrorState | null;
  editingImage: EditingImage | null;

  // Actions
  generate: (params: GenerateParams) => Promise<Newsletter | null>;
  reset: () => void;
  setNewsletter: React.Dispatch<React.SetStateAction<Newsletter | null>>;
  setEditingImage: React.Dispatch<React.SetStateAction<EditingImage | null>>;
  clearError: () => void;

  // Newsletter editing
  updateNewsletter: (field: keyof Newsletter | keyof NewsletterSection, value: string, sectionIndex?: number) => void;
  reorderSections: (newSections: NewsletterSection[]) => void;
  saveImageEdit: (newImageUrl: string) => void;
}

interface GenerateParams {
  topics: string[];
  audience: string[];
  tone: string;
  flavors: string[];
  imageStyle: string;
  promptOfTheDay?: PromptOfTheDay | null;
}

export function useNewsletterGeneration(): UseNewsletterGenerationReturn {
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<ErrorState | null>(null);
  const [editingImage, setEditingImage] = useState<EditingImage | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setNewsletter(null);
    setLoading(null);
    setProgress(0);
    setError(null);
    setEditingImage(null);
  }, []);

  const generate = useCallback(async (params: GenerateParams): Promise<Newsletter | null> => {
    const { topics, audience, tone, flavors, imageStyle, promptOfTheDay } = params;

    // Validation
    if (topics.length === 0) {
      setError({ message: "Please add at least one topic.", recoverable: false });
      return null;
    }
    if (audience.length === 0) {
      setError({ message: "Please select a target audience for the newsletter.", recoverable: false });
      return null;
    }

    setLoading("Generating newsletter content...");
    setProgress(10);
    setError(null);
    setNewsletter(null);

    try {
      // Generate content
      const result = await generateNewsletterContent(topics, audience, tone, flavors, imageStyle);
      const rawJsonString = result.text;
      console.log("[Newsletter] Raw JSON response received");

      const cleanedJsonString = extractStrictJson(rawJsonString);
      const parsedNewsletter: Newsletter = JSON.parse(cleanedJsonString);

      // Generate unique ID
      parsedNewsletter.id = `nl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Include prompt of the day if set
      if (promptOfTheDay) {
        parsedNewsletter.promptOfTheDay = promptOfTheDay;
      }

      setNewsletter(parsedNewsletter);
      setLoading("Generating images...");
      setProgress(35);

      // Generate images in parallel
      const imageGenerationPromises = parsedNewsletter.sections.map((section, index) =>
        generateImage(section.imagePrompt, imageStyle)
          .then(base64Image => ({
            index,
            imageUrl: `data:image/png;base64,${base64Image}`
          }))
          .catch(e => {
            console.error(`[Newsletter] Failed to generate image for section ${index}:`, e);
            return { index, imageUrl: null };
          })
      );

      const generatedImages = await Promise.all(imageGenerationPromises);
      setProgress(75);

      // Update newsletter with images
      let finalNewsletter: Newsletter | null = null;
      setNewsletter(currentNewsletter => {
        if (!currentNewsletter) return null;

        const updatedSections = [...currentNewsletter.sections];
        generatedImages.forEach(imageResult => {
          if (imageResult?.imageUrl) {
            updatedSections[imageResult.index].imageUrl = imageResult.imageUrl;
          }
        });

        finalNewsletter = { ...currentNewsletter, sections: updatedSections };
        return finalNewsletter;
      });

      setProgress(100);
      return finalNewsletter;

    } catch (e) {
      console.error("[Newsletter] Generation error:", e);
      const errorState = createErrorState(e, () => generate(params));
      setError(errorState);
      return null;
    } finally {
      setLoading(null);
      setProgress(0);
    }
  }, []);

  const updateNewsletter = useCallback((
    field: keyof Newsletter | keyof NewsletterSection,
    value: string,
    sectionIndex?: number
  ) => {
    setNewsletter(prev => {
      if (!prev) return null;

      const newNewsletter = JSON.parse(JSON.stringify(prev)) as Newsletter;

      if (sectionIndex !== undefined && sectionIndex >= 0) {
        if (newNewsletter.sections[sectionIndex]) {
          (newNewsletter.sections[sectionIndex] as any)[field] = value;
        }
      } else {
        (newNewsletter as any)[field] = value;
      }

      return newNewsletter;
    });
  }, []);

  const reorderSections = useCallback((newSections: NewsletterSection[]) => {
    setNewsletter(prev => {
      if (!prev) return null;
      return { ...prev, sections: newSections };
    });
  }, []);

  const saveImageEdit = useCallback((newImageUrl: string) => {
    if (!editingImage) return;

    setNewsletter(prev => {
      if (!prev) return null;

      const updatedSections = [...prev.sections];
      updatedSections[editingImage.index].imageUrl = newImageUrl;
      return { ...prev, sections: updatedSections };
    });

    setEditingImage(null);
  }, [editingImage]);

  return {
    // State
    newsletter,
    loading,
    progress,
    error,
    editingImage,

    // Actions
    generate,
    reset,
    setNewsletter,
    setEditingImage,
    clearError,

    // Newsletter editing
    updateNewsletter,
    reorderSections,
    saveImageEdit,
  };
}
