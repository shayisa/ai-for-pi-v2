/**
 * Scheduler Service
 * Handles automated newsletter sending with cron-based scheduling
 */

import * as cron from 'node-cron';
import * as schedulerDb from './schedulerDbService.ts';
import * as newsletterDb from './newsletterDbService.ts';
import * as subscriberDb from './subscriberDbService.ts';
import * as gmailService from './googleGmailService.ts';
import { newsletterToHtml } from './newsletterFormatService.ts';

// Track scheduler state
let isSchedulerRunning = false;
let schedulerTask: ReturnType<typeof cron.schedule> | null = null;

/**
 * Execute a scheduled send
 */
const executeSend = async (
  send: schedulerDb.ScheduledSend,
  senderEmail: string
): Promise<{ success: boolean; sentCount: number; error?: string }> => {
  console.log(`[Scheduler] Executing send ${send.id} for newsletter ${send.newsletterId}`);

  // Mark as sending
  schedulerDb.updateScheduledSendStatus(send.id, 'sending');

  try {
    // Get newsletter content
    const newsletter = newsletterDb.getNewsletterByIdWithFormat(send.newsletterId);
    if (!newsletter) {
      const error = 'Newsletter not found';
      schedulerDb.updateScheduledSendStatus(send.id, 'failed', error);
      return { success: false, sentCount: 0, error };
    }

    // Collect all recipients from specified lists
    const allRecipients = new Set<string>();

    for (const listId of send.recipientLists) {
      const subscribers = subscriberDb.getSubscribersByList(listId);
      subscribers
        .filter(s => s.status === 'active')
        .forEach(s => allRecipients.add(s.email));
    }

    const recipientList = Array.from(allRecipients);

    if (recipientList.length === 0) {
      const error = 'No active subscribers in selected lists';
      schedulerDb.updateScheduledSendStatus(send.id, 'failed', error);
      return { success: false, sentCount: 0, error };
    }

    console.log(`[Scheduler] Sending to ${recipientList.length} recipients`);

    // Convert newsletter to HTML
    const htmlBody = newsletterToHtml(newsletter);

    // Send emails
    const result = await gmailService.sendBulkEmails(
      senderEmail,
      recipientList,
      newsletter.subject,
      htmlBody
    );

    // Update status based on result
    if (result.totalFailed > 0 && result.totalSent === 0) {
      schedulerDb.updateScheduledSendStatus(
        send.id,
        'failed',
        `All ${result.totalFailed} emails failed`,
        result.totalSent
      );
    } else if (result.totalFailed > 0) {
      // Partial success - still mark as sent but note failures
      schedulerDb.updateScheduledSendStatus(
        send.id,
        'sent',
        `${result.totalFailed} of ${recipientList.length} emails failed`,
        result.totalSent
      );
    } else {
      schedulerDb.updateScheduledSendStatus(send.id, 'sent', null, result.totalSent);
    }

    // Log the send action
    newsletterDb.logAction(
      send.newsletterId,
      'scheduled_send',
      {
        scheduledSendId: send.id,
        totalSent: result.totalSent,
        totalFailed: result.totalFailed,
        scheduledAt: send.scheduledAt,
      }
    );

    return {
      success: result.success,
      sentCount: result.totalSent,
      error: result.totalFailed > 0 ? `${result.totalFailed} emails failed` : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Scheduler] Send failed for ${send.id}:`, error);
    schedulerDb.updateScheduledSendStatus(send.id, 'failed', errorMessage);
    return { success: false, sentCount: 0, error: errorMessage };
  }
};

/**
 * Process all pending sends that are due
 */
const processScheduledSends = async (senderEmail: string): Promise<void> => {
  const pendingSends = schedulerDb.getPendingSendsDue();

  if (pendingSends.length === 0) {
    return;
  }

  console.log(`[Scheduler] Processing ${pendingSends.length} due sends`);

  for (const send of pendingSends) {
    await executeSend(send, senderEmail);
  }
};

/**
 * Start the scheduler cron job
 */
export const startScheduler = (senderEmail: string): void => {
  if (isSchedulerRunning) {
    console.log('[Scheduler] Already running');
    return;
  }

  // Run every minute
  schedulerTask = cron.schedule('* * * * *', async () => {
    try {
      await processScheduledSends(senderEmail);
    } catch (error) {
      console.error('[Scheduler] Error in cron job:', error);
    }
  });

  isSchedulerRunning = true;
  console.log('[Scheduler] Started - checking every minute for scheduled sends');
};

/**
 * Stop the scheduler cron job
 */
export const stopScheduler = (): void => {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
  }
  isSchedulerRunning = false;
  console.log('[Scheduler] Stopped');
};

/**
 * Check if scheduler is running
 */
export const isRunning = (): boolean => isSchedulerRunning;

/**
 * Get scheduler status
 */
export const getSchedulerStatus = (): {
  running: boolean;
  stats: ReturnType<typeof schedulerDb.getSchedulerStats>;
  upcoming: schedulerDb.ScheduledSend[];
} => ({
  running: isSchedulerRunning,
  stats: schedulerDb.getSchedulerStats(),
  upcoming: schedulerDb.getUpcomingScheduledSends(7),
});

/**
 * Schedule a newsletter for sending
 */
export const scheduleNewsletter = (
  newsletterId: string,
  scheduledAt: string,
  recipientLists: string[]
): schedulerDb.ScheduledSend => {
  // Validate newsletter exists
  const newsletter = newsletterDb.getNewsletterByIdWithFormat(newsletterId);
  if (!newsletter) {
    throw new Error('Newsletter not found');
  }

  // Validate lists exist and have subscribers
  let totalSubscribers = 0;
  for (const listId of recipientLists) {
    const count = subscriberDb.getSubscribersByList(listId).filter(s => s.status === 'active').length;
    if (count === 0) {
      console.warn(`[Scheduler] List ${listId} has no active subscribers`);
    }
    totalSubscribers += count;
  }

  if (totalSubscribers === 0) {
    throw new Error('No active subscribers in selected lists');
  }

  const scheduledSend = schedulerDb.createScheduledSend(newsletterId, scheduledAt, recipientLists);

  console.log(`[Scheduler] Newsletter ${newsletterId} scheduled for ${scheduledAt} to ${totalSubscribers} subscribers`);

  return scheduledSend;
};

/**
 * Cancel a scheduled send
 */
export const cancelScheduledSend = (id: string): schedulerDb.ScheduledSend | null => {
  return schedulerDb.cancelScheduledSend(id);
};

/**
 * Reschedule a send to a new time
 */
export const rescheduleNewsletter = (
  id: string,
  newScheduledAt: string
): schedulerDb.ScheduledSend | null => {
  return schedulerDb.rescheduleScheduledSend(id, newScheduledAt);
};

/**
 * Manually trigger a scheduled send (for testing or immediate sending)
 */
export const triggerSendNow = async (
  id: string,
  senderEmail: string
): Promise<{ success: boolean; sentCount: number; error?: string }> => {
  const send = schedulerDb.getScheduledSendById(id);
  if (!send) {
    return { success: false, sentCount: 0, error: 'Scheduled send not found' };
  }

  if (send.status !== 'pending') {
    return { success: false, sentCount: 0, error: `Cannot send with status: ${send.status}` };
  }

  return executeSend(send, senderEmail);
};
