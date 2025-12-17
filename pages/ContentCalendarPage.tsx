/**
 * ContentCalendarPage Component
 *
 * Content planning calendar for scheduling future newsletters.
 * Features:
 * - Month view calendar with navigation
 * - Create, edit, delete calendar entries
 * - Link entries to generated newsletters
 * - Status tracking (planned, in_progress, completed, cancelled)
 * - Topic assignment for planning
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCalendar } from '../hooks/useCalendar';
import type { CalendarEntry, CalendarStatus } from '../services/calendarClientService';
import {
  RefreshIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  XIcon,
  EditIcon,
  TrashIcon,
} from '../components/IconComponents';
import { fadeInUp, staggerContainer, staggerItem } from '../utils/animations';

// Days of the week
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Month names
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Status colors and labels
const STATUS_CONFIG: Record<CalendarStatus, { label: string; color: string; bg: string }> = {
  planned: { label: 'Planned', color: 'text-editorial-navy', bg: 'bg-editorial-navy/10' },
  in_progress: { label: 'In Progress', color: 'text-amber-700', bg: 'bg-amber-100' },
  completed: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  cancelled: { label: 'Cancelled', color: 'text-slate', bg: 'bg-slate/10' },
};

// Generate calendar days for a month
const getCalendarDays = (year: number, month: number): { date: Date; isCurrentMonth: boolean }[] => {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  // Add days from previous month to fill first week
  const firstDayOfWeek = firstDay.getDay();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, -i);
    days.push({ date, isCurrentMonth: false });
  }

  // Add days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const date = new Date(year, month - 1, i);
    days.push({ date, isCurrentMonth: true });
  }

  // Add days from next month to complete last week
  const remainingDays = 7 - (days.length % 7);
  if (remainingDays < 7) {
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month, i);
      days.push({ date, isCurrentMonth: false });
    }
  }

  return days;
};

// Format date as YYYY-MM-DD
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Entry Modal Component
interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { title: string; scheduledDate: string; description: string; topics: string[]; status: CalendarStatus }) => void;
  onStartGeneration?: (entry: CalendarEntry) => void;
  initialData?: CalendarEntry | null;
  selectedDate?: string;
}

const EntryModal: React.FC<EntryModalProps> = ({ isOpen, onClose, onSave, onStartGeneration, initialData, selectedDate }) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [scheduledDate, setScheduledDate] = useState(initialData?.scheduledDate || selectedDate || formatDate(new Date()));
  const [description, setDescription] = useState(initialData?.description || '');
  const [topicsInput, setTopicsInput] = useState(initialData?.topics.join(', ') || '');
  const [status, setStatus] = useState<CalendarStatus>(initialData?.status || 'planned');

  // Reset form when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.title || '');
      setScheduledDate(initialData?.scheduledDate || selectedDate || formatDate(new Date()));
      setDescription(initialData?.description || '');
      setTopicsInput(initialData?.topics.join(', ') || '');
      setStatus(initialData?.status || 'planned');
    }
  }, [isOpen, initialData, selectedDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      scheduledDate,
      description: description.trim(),
      topics: topicsInput.split(',').map(t => t.trim()).filter(Boolean),
      status,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-paper w-full max-w-lg mx-4 shadow-editorial"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
            <h2 className="font-serif text-subheadline text-ink">
              {initialData ? 'Edit Entry' : 'New Calendar Entry'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-slate hover:text-ink transition-colors"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Title */}
            <div>
              <label className="block font-sans text-caption text-slate uppercase tracking-wide mb-1">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-border-subtle bg-pearl font-sans text-ui focus:outline-none focus:border-editorial-navy"
                placeholder="Newsletter topic or theme"
                required
              />
            </div>

            {/* Date */}
            <div>
              <label className="block font-sans text-caption text-slate uppercase tracking-wide mb-1">
                Scheduled Date
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 border border-border-subtle bg-pearl font-sans text-ui focus:outline-none focus:border-editorial-navy"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block font-sans text-caption text-slate uppercase tracking-wide mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-border-subtle bg-pearl font-sans text-ui focus:outline-none focus:border-editorial-navy min-h-[80px] resize-y"
                placeholder="Additional notes or context"
              />
            </div>

            {/* Topics */}
            <div>
              <label className="block font-sans text-caption text-slate uppercase tracking-wide mb-1">
                Topics (comma-separated)
              </label>
              <input
                type="text"
                value={topicsInput}
                onChange={(e) => setTopicsInput(e.target.value)}
                className="w-full px-3 py-2 border border-border-subtle bg-pearl font-sans text-ui focus:outline-none focus:border-editorial-navy"
                placeholder="AI, Machine Learning, GPT-4"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block font-sans text-caption text-slate uppercase tracking-wide mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CalendarStatus)}
                className="w-full px-3 py-2 border border-border-subtle bg-pearl font-sans text-ui focus:outline-none focus:border-editorial-navy"
              >
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-4">
              {/* Start Generation button (shown when editing any non-completed entry) */}
              {initialData && onStartGeneration && initialData.status !== 'completed' && (
                <button
                  type="button"
                  onClick={() => {
                    // Pass current form state as updated entry
                    const updatedEntry: CalendarEntry = {
                      ...initialData,
                      title,
                      scheduledDate,
                      description,
                      topics: topicsInput.split(',').map(t => t.trim()).filter(Boolean),
                      status,
                    };
                    onStartGeneration(updatedEntry);
                    onClose();
                  }}
                  className="px-4 py-2 bg-editorial-gold text-ink font-sans text-ui hover:bg-editorial-gold/90 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Start Generation
                </button>
              )}
              {/* Spacer when no start button */}
              {!(initialData && onStartGeneration && initialData.status !== 'completed') && (
                <div />
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 font-sans text-ui text-charcoal hover:text-ink transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-editorial-navy text-paper font-sans text-ui hover:bg-editorial-navy/90 transition-colors"
                >
                  {initialData ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Calendar Day Cell Component
interface DayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  entries: CalendarEntry[];
  onAddEntry: (date: string) => void;
  onEditEntry: (entry: CalendarEntry) => void;
}

const DayCell: React.FC<DayCellProps> = ({ date, isCurrentMonth, isToday, entries, onAddEntry, onEditEntry }) => {
  const dateStr = formatDate(date);

  return (
    <div
      className={`
        min-h-[100px] border-b border-r border-border-subtle p-2
        ${isCurrentMonth ? 'bg-paper' : 'bg-pearl/50'}
        ${isToday ? 'ring-2 ring-inset ring-editorial-red' : ''}
      `}
    >
      {/* Date Number */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={`
            font-sans text-ui
            ${isCurrentMonth ? 'text-ink' : 'text-silver'}
            ${isToday ? 'font-bold text-editorial-red' : ''}
          `}
        >
          {date.getDate()}
        </span>
        <button
          onClick={() => onAddEntry(dateStr)}
          className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-0.5 text-silver hover:text-editorial-navy transition-all"
          title="Add entry"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Entries */}
      <div className="space-y-1">
        {entries.slice(0, 3).map((entry) => {
          const config = STATUS_CONFIG[entry.status];
          return (
            <button
              key={entry.id}
              onClick={() => onEditEntry(entry)}
              className={`
                w-full text-left px-1.5 py-0.5 text-caption truncate
                ${config.bg} ${config.color}
                hover:ring-1 hover:ring-current transition-all
              `}
              title={entry.title}
            >
              {entry.title}
            </button>
          );
        })}
        {entries.length > 3 && (
          <span className="block text-caption text-silver px-1.5">
            +{entries.length - 3} more
          </span>
        )}
      </div>
    </div>
  );
};

// Main Component Props
interface ContentCalendarPageProps {
  onStartGeneration?: (entry: CalendarEntry) => void;
}

// Main Component
export const ContentCalendarPage: React.FC<ContentCalendarPageProps> = ({ onStartGeneration }) => {
  const {
    entries,
    isLoading,
    error,
    currentMonth,
    setCurrentMonth,
    createEntry,
    updateEntry,
    deleteEntry,
    refreshEntries,
  } = useCalendar();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CalendarEntry | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Get calendar days and today's date
  const calendarDays = getCalendarDays(currentMonth.year, currentMonth.month);
  const today = formatDate(new Date());

  // Group entries by date
  const entriesByDate = entries.reduce<Record<string, CalendarEntry[]>>((acc, entry) => {
    const date = entry.scheduledDate;
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {});

  // Navigation handlers
  const goToPreviousMonth = () => {
    const newMonth = currentMonth.month === 1 ? 12 : currentMonth.month - 1;
    const newYear = currentMonth.month === 1 ? currentMonth.year - 1 : currentMonth.year;
    setCurrentMonth(newYear, newMonth);
  };

  const goToNextMonth = () => {
    const newMonth = currentMonth.month === 12 ? 1 : currentMonth.month + 1;
    const newYear = currentMonth.month === 12 ? currentMonth.year + 1 : currentMonth.year;
    setCurrentMonth(newYear, newMonth);
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(now.getFullYear(), now.getMonth() + 1);
  };

  // Entry handlers
  const handleAddEntry = (date: string) => {
    setSelectedDate(date);
    setEditingEntry(null);
    setIsModalOpen(true);
  };

  const handleEditEntry = (entry: CalendarEntry) => {
    setSelectedDate(entry.scheduledDate);
    setEditingEntry(entry);
    setIsModalOpen(true);
  };

  const handleSaveEntry = async (data: { title: string; scheduledDate: string; description: string; topics: string[]; status: CalendarStatus }) => {
    if (editingEntry) {
      await updateEntry(editingEntry.id, data);
    } else {
      await createEntry(data.title, data.scheduledDate, data.description, data.topics);
    }
    setIsModalOpen(false);
    setEditingEntry(null);
  };

  const handleDeleteEntry = async (id: string) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      await deleteEntry(id);
      setIsModalOpen(false);
      setEditingEntry(null);
    }
  };

  return (
    <motion.div
      className="min-h-screen bg-paper"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.header
        variants={fadeInUp}
        className="sticky top-14 z-10 bg-paper border-b border-border-subtle"
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-serif text-headline text-ink">Content Calendar</h1>
              <p className="font-sans text-body text-charcoal mt-1">
                Plan and schedule your newsletters
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Today Button */}
              <button
                onClick={goToToday}
                className="px-3 py-1.5 font-sans text-ui text-charcoal hover:text-ink border border-border-subtle hover:border-charcoal transition-colors"
              >
                Today
              </button>

              {/* Month Navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPreviousMonth}
                  className="p-1.5 text-charcoal hover:text-ink transition-colors"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <span className="font-serif text-subheadline text-ink min-w-[160px] text-center">
                  {MONTHS[currentMonth.month - 1]} {currentMonth.year}
                </span>
                <button
                  onClick={goToNextMonth}
                  className="p-1.5 text-charcoal hover:text-ink transition-colors"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Refresh */}
              <button
                onClick={refreshEntries}
                disabled={isLoading}
                className="p-2 text-charcoal hover:text-ink transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshIcon className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              {/* New Entry */}
              <button
                onClick={() => handleAddEntry(today)}
                className="flex items-center gap-2 px-4 py-2 bg-editorial-navy text-paper font-sans text-ui hover:bg-editorial-navy/90 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                New Entry
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Error State */}
      {error && (
        <motion.div variants={fadeInUp} className="max-w-7xl mx-auto px-6 py-4">
          <div className="p-4 bg-editorial-red/10 border border-editorial-red/20">
            <p className="font-sans text-ui text-editorial-red">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Calendar Grid */}
      <motion.div variants={fadeInUp} className="max-w-7xl mx-auto px-6 py-6">
        <div className="border-l border-t border-border-subtle">
          {/* Day Headers */}
          <div className="grid grid-cols-7">
            {DAYS.map((day) => (
              <div
                key={day}
                className="px-2 py-3 border-b border-r border-border-subtle bg-pearl font-sans text-overline text-slate uppercase tracking-wide text-center"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const dateStr = formatDate(day.date);
              const dayEntries = entriesByDate[dateStr] || [];
              return (
                <div key={index} className="group">
                  <DayCell
                    date={day.date}
                    isCurrentMonth={day.isCurrentMonth}
                    isToday={dateStr === today}
                    entries={dayEntries}
                    onAddEntry={handleAddEntry}
                    onEditEntry={handleEditEntry}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Upcoming Entries Sidebar */}
      <motion.div variants={staggerItem} className="max-w-7xl mx-auto px-6 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Status Summary */}
          <div className="bg-pearl p-4 border border-border-subtle">
            <h3 className="font-sans text-overline text-slate uppercase tracking-wide mb-3">
              This Month
            </h3>
            <div className="space-y-2">
              {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                const count = entries.filter(e => e.status === status).length;
                return (
                  <div key={status} className="flex items-center justify-between">
                    <span className={`font-sans text-ui ${config.color}`}>{config.label}</span>
                    <span className={`font-mono text-ui ${config.color}`}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Entries */}
          <div className="md:col-span-2 bg-pearl p-4 border border-border-subtle">
            <h3 className="font-sans text-overline text-slate uppercase tracking-wide mb-3">
              Upcoming This Month
            </h3>
            <div className="space-y-2">
              {entries
                .filter(e => e.scheduledDate >= today && e.status !== 'completed' && e.status !== 'cancelled')
                .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
                .slice(0, 5)
                .map((entry) => {
                  const config = STATUS_CONFIG[entry.status];
                  return (
                    <button
                      key={entry.id}
                      onClick={() => handleEditEntry(entry)}
                      className="w-full flex items-center justify-between p-2 hover:bg-paper transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-caption text-slate w-20">
                          {new Date(entry.scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="font-sans text-ui text-ink">{entry.title}</span>
                      </div>
                      <span className={`px-2 py-0.5 text-caption ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                    </button>
                  );
                })}
              {entries.filter(e => e.scheduledDate >= today && e.status !== 'completed' && e.status !== 'cancelled').length === 0 && (
                <p className="font-sans text-ui text-silver italic">No upcoming entries</p>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Entry Modal */}
      <EntryModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEntry(null);
        }}
        onSave={handleSaveEntry}
        onStartGeneration={onStartGeneration}
        initialData={editingEntry}
        selectedDate={selectedDate}
      />

      {/* Delete Confirmation in Edit Mode */}
      {editingEntry && isModalOpen && (
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={() => handleDeleteEntry(editingEntry.id)}
            className="flex items-center gap-2 px-4 py-2 bg-editorial-red text-paper font-sans text-ui hover:bg-editorial-red/90 transition-colors shadow-lg"
          >
            <TrashIcon className="h-4 w-4" />
            Delete Entry
          </button>
        </div>
      )}
    </motion.div>
  );
};
