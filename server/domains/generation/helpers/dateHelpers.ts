/**
 * Date Range Helpers
 *
 * Provides date formatting for recency constraints in content generation.
 *
 * @module domains/generation/helpers/dateHelpers
 *
 * ## Original Location
 * - server.ts lines 129-142
 *
 * ## PRESERVATION NOTE
 * The 60-day window is intentional for content freshness.
 * Do NOT modify the time window without explicit approval.
 */

/**
 * Date range result type
 */
export interface DateRangeResult {
  /** Start date formatted as "Month Day, Year" */
  startDate: string;
  /** End date (today) formatted as "Month Day, Year" */
  endDate: string;
  /** Full range as "startDate to endDate" */
  range: string;
}

/**
 * Get date range description for recency constraints
 *
 * Calculates a 60-day window from today for content freshness requirements.
 * Used in prompts to guide Claude to prioritize recent content.
 *
 * Time window: 60 days (approximately 2 months)
 *
 * @returns Object containing formatted date strings
 *
 * @example
 * const { startDate, endDate, range } = getDateRangeDescription();
 * // startDate: "October 18, 2024"
 * // endDate: "December 17, 2024"
 * // range: "October 18, 2024 to December 17, 2024"
 */
export const getDateRangeDescription = (): DateRangeResult => {
  const today = new Date();
  const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);

  const startDate = sixtyDaysAgo.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const endDate = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return {
    startDate,
    endDate,
    range: `${startDate} to ${endDate}`
  };
};
