/**
 * usePresets Hook Tests
 *
 * Tests preset management functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePresets } from '../usePresets';

// Mock claudeService
vi.mock('../../services/claudeService', () => ({
  savePresetsToCloud: vi.fn().mockResolvedValue({ success: true }),
  loadPresetsFromCloud: vi.fn().mockResolvedValue({ presets: [] }),
}));

// Helper to create valid preset settings
const createSettings = (topics: string[]) => ({
  selectedAudience: { business: true },
  selectedTone: 'professional',
  selectedFlavors: { practical: true },
  selectedImageStyle: 'photorealistic',
  selectedTopics: topics,
});

describe('usePresets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.getItem = vi.fn().mockReturnValue(null);
    window.localStorage.setItem = vi.fn();
  });

  it('initializes with empty presets', () => {
    const { result } = renderHook(() => usePresets());
    expect(result.current.presets).toEqual([]);
  });

  it('loads presets from localStorage on mount', () => {
    const storedPresets = [
      { name: 'Test Preset', settings: createSettings(['AI']) }
    ];
    window.localStorage.getItem = vi.fn().mockReturnValue(JSON.stringify(storedPresets));

    const { result } = renderHook(() => usePresets());
    expect(result.current.presets).toEqual(storedPresets);
  });

  it('saves a new preset', () => {
    const { result } = renderHook(() => usePresets());

    act(() => {
      result.current.savePreset('New Preset', createSettings(['AI tools']));
    });

    expect(result.current.presets).toHaveLength(1);
    expect(result.current.presets[0].name).toBe('New Preset');
    expect(window.localStorage.setItem).toHaveBeenCalled();
  });

  it('replaces preset with same name', () => {
    const { result } = renderHook(() => usePresets());

    act(() => {
      result.current.savePreset('Test', createSettings(['Original']));
    });

    act(() => {
      result.current.savePreset('Test', createSettings(['Updated']));
    });

    expect(result.current.presets).toHaveLength(1);
    expect(result.current.presets[0].settings.selectedTopics).toEqual(['Updated']);
  });

  it('deletes a preset', () => {
    const { result } = renderHook(() => usePresets());

    act(() => {
      result.current.savePreset('Preset 1', createSettings(['AI']));
      result.current.savePreset('Preset 2', createSettings(['ML']));
    });

    expect(result.current.presets).toHaveLength(2);

    act(() => {
      result.current.deletePreset('Preset 1');
    });

    expect(result.current.presets).toHaveLength(1);
    expect(result.current.presets[0].name).toBe('Preset 2');
  });

  it('loads preset settings', () => {
    const { result } = renderHook(() => usePresets());
    const settings = createSettings(['AI', 'ML']);

    act(() => {
      result.current.savePreset('Test', settings);
    });

    const loadedSettings = result.current.loadPreset(result.current.presets[0]);
    expect(loadedSettings).toEqual(settings);
  });

  it('maintains preset order (newest first)', () => {
    const { result } = renderHook(() => usePresets());

    act(() => {
      result.current.savePreset('First', createSettings(['1']));
    });

    act(() => {
      result.current.savePreset('Second', createSettings(['2']));
    });

    act(() => {
      result.current.savePreset('Third', createSettings(['3']));
    });

    expect(result.current.presets[0].name).toBe('Third');
    expect(result.current.presets[1].name).toBe('Second');
    expect(result.current.presets[2].name).toBe('First');
  });
});
