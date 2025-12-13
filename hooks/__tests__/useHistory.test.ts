/**
 * useHistory Hook Tests
 *
 * Tests newsletter generation history management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistory } from '../useHistory';

// Mock googleApiService
vi.mock('../../services/googleApiService', () => ({
  readHistoryFromSheet: vi.fn().mockResolvedValue([]),
}));

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
    window.localStorage.getItem = vi.fn().mockReturnValue(null);
    window.localStorage.setItem = vi.fn();
    window.localStorage.removeItem = vi.fn();
  });

  it('initializes with empty history', () => {
    const { result } = renderHook(() => useHistory());
    expect(result.current.history).toEqual([]);
  });

  it('loads history from localStorage on mount', () => {
    const storedHistory = [
      {
        id: 1,
        date: '2024-01-01',
        subject: 'Old Newsletter',
        newsletter: mockNewsletter,
        topics: ['AI']
      }
    ];
    window.localStorage.getItem = vi.fn().mockReturnValue(JSON.stringify(storedHistory));

    const { result } = renderHook(() => useHistory());
    expect(result.current.history).toEqual(storedHistory);
  });

  it('adds newsletter to history', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.addToHistory(mockNewsletter as any, ['AI tools']);
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].subject).toBe('Test Newsletter');
    expect(result.current.history[0].topics).toEqual(['AI tools']);
    expect(window.localStorage.setItem).toHaveBeenCalled();
  });

  it('maintains history limit (50 items)', () => {
    const { result } = renderHook(() => useHistory());

    // Add 55 items
    for (let i = 0; i < 55; i++) {
      act(() => {
        result.current.addToHistory(
          { ...mockNewsletter, id: `nl_${i}`, subject: `Newsletter ${i}` } as any,
          [`Topic ${i}`]
        );
      });
    }

    expect(result.current.history.length).toBeLessThanOrEqual(50);
  });

  it('keeps newest items at the start', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.addToHistory(
        { ...mockNewsletter, subject: 'First' } as any,
        ['Topic 1']
      );
    });

    act(() => {
      result.current.addToHistory(
        { ...mockNewsletter, subject: 'Second' } as any,
        ['Topic 2']
      );
    });

    expect(result.current.history[0].subject).toBe('Second');
    expect(result.current.history[1].subject).toBe('First');
  });

  it('loads from history correctly', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.addToHistory(mockNewsletter as any, ['AI tools']);
    });

    const loaded = result.current.loadFromHistory(result.current.history[0]);

    expect(loaded.newsletter).toEqual(mockNewsletter);
    expect(loaded.topics).toEqual(['AI tools']);
  });

  it('clears history', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.addToHistory(mockNewsletter as any, ['AI tools']);
    });

    expect(result.current.history).toHaveLength(1);

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.history).toEqual([]);
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('generationHistory');
  });
});
