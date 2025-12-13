/**
 * useNewsletterGeneration Hook Tests
 *
 * Tests newsletter generation state management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNewsletterGeneration } from '../useNewsletterGeneration';

// Mock the claudeService
vi.mock('../../services/claudeService', () => ({
  generateNewsletterContent: vi.fn(),
  generateImage: vi.fn(),
}));

// Mock stringUtils
vi.mock('../../utils/stringUtils', () => ({
  extractStrictJson: vi.fn((str) => str),
}));

import { generateNewsletterContent, generateImage } from '../../services/claudeService';

const mockNewsletterResponse = {
  text: JSON.stringify({
    subject: "Test Newsletter",
    introduction: "Test intro",
    sections: [
      {
        title: "Section 1",
        content: "Content 1",
        imagePrompt: "Test image prompt",
      }
    ],
    conclusion: "Test conclusion"
  })
};

describe('useNewsletterGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (generateNewsletterContent as ReturnType<typeof vi.fn>).mockResolvedValue(mockNewsletterResponse);
    (generateImage as ReturnType<typeof vi.fn>).mockResolvedValue('base64ImageData');
  });

  it('initializes with null/empty state', () => {
    const { result } = renderHook(() => useNewsletterGeneration());

    expect(result.current.newsletter).toBeNull();
    expect(result.current.loading).toBeNull();
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
    expect(result.current.editingImage).toBeNull();
  });

  it('validates topics before generation', async () => {
    const { result } = renderHook(() => useNewsletterGeneration());

    await act(async () => {
      await result.current.generate({
        topics: [], // Empty topics
        audience: ['business'],
        tone: 'professional',
        flavors: [],
        imageStyle: 'photorealistic',
      });
    });

    expect(result.current.error?.message).toBe("Please add at least one topic.");
    expect(result.current.newsletter).toBeNull();
    expect(generateNewsletterContent).not.toHaveBeenCalled();
  });

  it('validates audience before generation', async () => {
    const { result } = renderHook(() => useNewsletterGeneration());

    await act(async () => {
      await result.current.generate({
        topics: ['AI tools'],
        audience: [], // Empty audience
        tone: 'professional',
        flavors: [],
        imageStyle: 'photorealistic',
      });
    });

    expect(result.current.error?.message).toBe("Please select a target audience for the newsletter.");
    expect(result.current.newsletter).toBeNull();
  });

  it('clears loading state after generation completes', async () => {
    const { result } = renderHook(() => useNewsletterGeneration());

    // Loading should be null initially
    expect(result.current.loading).toBeNull();

    await act(async () => {
      await result.current.generate({
        topics: ['AI tools'],
        audience: ['business'],
        tone: 'professional',
        flavors: [],
        imageStyle: 'photorealistic',
      });
    });

    // After completion, loading should be null again
    expect(result.current.loading).toBeNull();
    expect(result.current.newsletter).not.toBeNull();
  });

  it('generates newsletter successfully', async () => {
    const { result } = renderHook(() => useNewsletterGeneration());

    await act(async () => {
      await result.current.generate({
        topics: ['AI tools'],
        audience: ['business'],
        tone: 'professional',
        flavors: [],
        imageStyle: 'photorealistic',
      });
    });

    expect(result.current.newsletter).not.toBeNull();
    expect(result.current.newsletter?.subject).toBe("Test Newsletter");
    expect(result.current.error).toBeNull();
    expect(generateNewsletterContent).toHaveBeenCalledTimes(1);
  });

  it('handles generation errors with retry function', async () => {
    const error = new Error('API error');
    (generateNewsletterContent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useNewsletterGeneration());

    await act(async () => {
      await result.current.generate({
        topics: ['AI tools'],
        audience: ['business'],
        tone: 'professional',
        flavors: [],
        imageStyle: 'photorealistic',
      });
    });

    expect(result.current.error?.message).toBe('API error');
    expect(result.current.error?.onRetry).toBeDefined();
    expect(result.current.error?.recoverable).toBe(true);
    expect(result.current.newsletter).toBeNull();
  });

  it('resets state correctly', async () => {
    const { result } = renderHook(() => useNewsletterGeneration());

    // First generate a newsletter
    await act(async () => {
      await result.current.generate({
        topics: ['AI tools'],
        audience: ['business'],
        tone: 'professional',
        flavors: [],
        imageStyle: 'photorealistic',
      });
    });

    expect(result.current.newsletter).not.toBeNull();

    // Then reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.newsletter).toBeNull();
    expect(result.current.loading).toBeNull();
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('updates newsletter field correctly', async () => {
    const { result } = renderHook(() => useNewsletterGeneration());

    // First generate a newsletter
    await act(async () => {
      await result.current.generate({
        topics: ['AI tools'],
        audience: ['business'],
        tone: 'professional',
        flavors: [],
        imageStyle: 'photorealistic',
      });
    });

    // Update the subject
    act(() => {
      result.current.updateNewsletter('subject', 'Updated Subject');
    });

    expect(result.current.newsletter?.subject).toBe('Updated Subject');
  });

  it('updates section field correctly', async () => {
    const { result } = renderHook(() => useNewsletterGeneration());

    // First generate a newsletter
    await act(async () => {
      await result.current.generate({
        topics: ['AI tools'],
        audience: ['business'],
        tone: 'professional',
        flavors: [],
        imageStyle: 'photorealistic',
      });
    });

    // Update section title
    act(() => {
      result.current.updateNewsletter('title', 'Updated Section Title', 0);
    });

    expect(result.current.newsletter?.sections[0].title).toBe('Updated Section Title');
  });

  it('clears error correctly', async () => {
    const { result } = renderHook(() => useNewsletterGeneration());

    // Generate an error
    await act(async () => {
      await result.current.generate({
        topics: [],
        audience: ['business'],
        tone: 'professional',
        flavors: [],
        imageStyle: 'photorealistic',
      });
    });

    expect(result.current.error).not.toBeNull();

    // Clear error
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});
