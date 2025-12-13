/**
 * useHistory Hook Tests
 *
 * Tests newsletter generation history management via SQLite
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useHistory } from '../useHistory';

// Mock newsletterClientService
vi.mock('../../services/newsletterClientService', () => ({
  getNewsletters: vi.fn().mockResolvedValue({ newsletters: [], count: 0 }),
  saveNewsletter: vi.fn().mockResolvedValue({
    id: 'nl_mock_123',
    createdAt: '2024-01-01T00:00:00.000Z',
    subject: 'Test Newsletter',
    introduction: 'Test intro',
    sections: [{ title: 'Section 1', content: 'Content 1', imagePrompt: 'Prompt 1' }],
    conclusion: 'Test conclusion',
    topics: ['AI tools']
  }),
  deleteNewsletter: vi.fn().mockResolvedValue({ success: true })
}));

import * as newsletterApi from '../../services/newsletterClientService';

const mockNewsletter = {
  id: 'nl_123',
  subject: 'Test Newsletter',
  introduction: 'Test intro',
  sections: [
    { title: 'Section 1', content: 'Content 1', imagePrompt: 'Prompt 1' }
  ],
  conclusion: 'Test conclusion'
};

describe('useHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with empty history and loading state', async () => {
    const { result } = renderHook(() => useHistory());

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for load to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.history).toEqual([]);
  });

  it('loads history from SQLite on mount', async () => {
    const storedNewsletters = [
      {
        id: 'nl_1',
        createdAt: '2024-01-01T00:00:00.000Z',
        subject: 'Old Newsletter',
        introduction: 'Intro',
        sections: [{ title: 'S1', content: 'C1', imagePrompt: 'P1' }],
        conclusion: 'Conclusion',
        topics: ['AI']
      }
    ];

    vi.mocked(newsletterApi.getNewsletters).mockResolvedValueOnce({
      newsletters: storedNewsletters,
      count: 1
    });

    const { result } = renderHook(() => useHistory());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].subject).toBe('Old Newsletter');
  });

  it('adds newsletter to history via SQLite', async () => {
    const { result } = renderHook(() => useHistory());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.addToHistory(mockNewsletter as any, ['AI tools']);
    });

    expect(newsletterApi.saveNewsletter).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Test Newsletter'
      }),
      ['AI tools']
    );

    expect(result.current.history).toHaveLength(1);
  });

  it('loads from history correctly', async () => {
    vi.mocked(newsletterApi.getNewsletters).mockResolvedValueOnce({
      newsletters: [{
        id: 'nl_1',
        createdAt: '2024-01-01T00:00:00.000Z',
        subject: 'Test Newsletter',
        introduction: 'Test intro',
        sections: [{ title: 'Section 1', content: 'Content 1', imagePrompt: 'Prompt 1' }],
        conclusion: 'Test conclusion',
        topics: ['AI tools']
      }],
      count: 1
    });

    const { result } = renderHook(() => useHistory());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const loaded = result.current.loadFromHistory(result.current.history[0]);

    expect(loaded.newsletter.subject).toBe('Test Newsletter');
    expect(loaded.topics).toEqual(['AI tools']);
  });

  it('deletes from history via SQLite', async () => {
    vi.mocked(newsletterApi.getNewsletters).mockResolvedValueOnce({
      newsletters: [{
        id: 'nl_1',
        createdAt: '2024-01-01T00:00:00.000Z',
        subject: 'Test Newsletter',
        introduction: 'Test intro',
        sections: [{ title: 'Section 1', content: 'Content 1', imagePrompt: 'Prompt 1' }],
        conclusion: 'Test conclusion',
        topics: ['AI tools']
      }],
      count: 1
    });

    const { result } = renderHook(() => useHistory());

    await waitFor(() => {
      expect(result.current.history).toHaveLength(1);
    });

    await act(async () => {
      await result.current.deleteFromHistory('nl_1');
    });

    expect(newsletterApi.deleteNewsletter).toHaveBeenCalledWith('nl_1');
    expect(result.current.history).toHaveLength(0);
  });

  it('refreshes history from SQLite', async () => {
    const { result } = renderHook(() => useHistory());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    vi.mocked(newsletterApi.getNewsletters).mockResolvedValueOnce({
      newsletters: [{
        id: 'nl_refreshed',
        createdAt: '2024-01-02T00:00:00.000Z',
        subject: 'Refreshed Newsletter',
        introduction: 'Intro',
        sections: [],
        conclusion: 'Conclusion',
        topics: ['New']
      }],
      count: 1
    });

    await act(async () => {
      await result.current.refreshHistory();
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].subject).toBe('Refreshed Newsletter');
  });
});
