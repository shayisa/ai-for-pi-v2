/**
 * EmailStatsWidget Component
 *
 * Displays inline email analytics for a newsletter:
 * - Sent count, open rate, click rate
 * - Fetches stats lazily on mount
 */

import React, { useEffect, useState } from 'react';
import { ChartIcon } from './IconComponents';
import type { EmailStats } from '../services/trackingClientService';
import * as trackingApi from '../services/trackingClientService';

interface EmailStatsWidgetProps {
  newsletterId: string;
}

export const EmailStatsWidget: React.FC<EmailStatsWidgetProps> = ({ newsletterId }) => {
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      try {
        const data = await trackingApi.getNewsletterStats(newsletterId);
        if (!cancelled) {
          setStats(data);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    };

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, [newsletterId]);

  // Don't show anything if loading, error, or no sends
  if (isLoading || hasError || !stats || stats.totalSent === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 mt-2 text-xs font-mono">
      <span className="flex items-center gap-1 text-slate">
        <ChartIcon className="h-3 w-3" />
        <span className="font-sans text-caption">Analytics:</span>
      </span>
      <span className="text-charcoal">
        {stats.totalSent} sent
      </span>
      <span className="text-charcoal">
        {stats.openRate.toFixed(0)}% opens
      </span>
      <span className="text-charcoal">
        {stats.clickRate.toFixed(0)}% clicks
      </span>
    </div>
  );
};
