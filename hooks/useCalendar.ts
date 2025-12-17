/**
 * useCalendar Hook
 *
 * Manages content calendar state and operations
 */

import { useState, useCallback, useEffect } from 'react';
import * as calendarApi from '../services/calendarClientService';
import type { CalendarEntry, CalendarStatus } from '../services/calendarClientService';

interface UseCalendarReturn {
  entries: CalendarEntry[];
  isLoading: boolean;
  error: string | null;
  currentMonth: { year: number; month: number };
  setCurrentMonth: (year: number, month: number) => void;
  createEntry: (
    title: string,
    scheduledDate: string,
    description?: string,
    topics?: string[]
  ) => Promise<CalendarEntry>;
  updateEntry: (
    id: string,
    updates: Partial<{
      title: string;
      scheduledDate: string;
      description: string;
      topics: string[];
      status: CalendarStatus;
    }>
  ) => Promise<CalendarEntry>;
  deleteEntry: (id: string) => Promise<void>;
  linkNewsletter: (entryId: string, newsletterId: string) => Promise<CalendarEntry>;
  refreshEntries: () => Promise<void>;
}

export function useCalendar(): UseCalendarReturn {
  const now = new Date();
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonthState] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1, // 1-indexed
  });

  // Load entries for current month
  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await calendarApi.getEntriesByMonth(
        currentMonth.year,
        currentMonth.month
      );
      setEntries(response.entries);
      console.log(
        `[useCalendar] Loaded ${response.count} entries for ${currentMonth.year}-${currentMonth.month}`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load calendar';
      console.error('[useCalendar] Error loading entries:', e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth.year, currentMonth.month]);

  // Load on mount and when month changes
  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Set current month
  const setCurrentMonth = useCallback((year: number, month: number) => {
    setCurrentMonthState({ year, month });
  }, []);

  // Create entry
  const createEntry = useCallback(
    async (
      title: string,
      scheduledDate: string,
      description = '',
      topics: string[] = []
    ): Promise<CalendarEntry> => {
      const entry = await calendarApi.createEntry(
        title,
        scheduledDate,
        description,
        topics
      );
      setEntries((prev) => [...prev, entry].sort((a, b) =>
        a.scheduledDate.localeCompare(b.scheduledDate)
      ));
      console.log(`[useCalendar] Created entry: ${title}`);
      return entry;
    },
    []
  );

  // Update entry
  const updateEntry = useCallback(
    async (
      id: string,
      updates: Partial<{
        title: string;
        scheduledDate: string;
        description: string;
        topics: string[];
        status: CalendarStatus;
      }>
    ): Promise<CalendarEntry> => {
      const updated = await calendarApi.updateEntry(id, updates);
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? updated : e)).sort((a, b) =>
          a.scheduledDate.localeCompare(b.scheduledDate)
        )
      );
      console.log(`[useCalendar] Updated entry: ${id}`);
      return updated;
    },
    []
  );

  // Delete entry
  const deleteEntry = useCallback(async (id: string): Promise<void> => {
    await calendarApi.deleteEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    console.log(`[useCalendar] Deleted entry: ${id}`);
  }, []);

  // Link newsletter
  const linkNewsletter = useCallback(
    async (entryId: string, newsletterId: string): Promise<CalendarEntry> => {
      const updated = await calendarApi.linkNewsletter(entryId, newsletterId);
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? updated : e))
      );
      console.log(`[useCalendar] Linked newsletter ${newsletterId} to entry ${entryId}`);
      return updated;
    },
    []
  );

  // Refresh
  const refreshEntries = useCallback(async () => {
    await loadEntries();
  }, [loadEntries]);

  return {
    entries,
    isLoading,
    error,
    currentMonth,
    setCurrentMonth,
    createEntry,
    updateEntry,
    deleteEntry,
    linkNewsletter,
    refreshEntries,
  };
}
