/**
 * Google Gmail Service
 * Backend service for Gmail API operations
 */

import { getValidAccessToken } from './googleOAuthService.ts';

const GMAIL_API_URL = 'https://gmail.googleapis.com/gmail/v1';

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  htmlBody: string;
  from?: string;
}

/**
 * Create RFC 2822 formatted email message
 */
const createMessage = (options: SendEmailOptions, senderEmail: string): string => {
  const toAddresses = Array.isArray(options.to) ? options.to.join(', ') : options.to;
  const fromAddress = options.from || senderEmail;

  const messageParts = [
    `From: ${fromAddress}`,
    `To: ${toAddresses}`,
    `Subject: ${options.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    options.htmlBody,
  ];

  const message = messageParts.join('\r\n');

  // Encode to base64url format (required by Gmail API)
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

/**
 * Send email via Gmail API
 */
export const sendEmail = async (
  userEmail: string,
  options: SendEmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  const accessToken = await getValidAccessToken(userEmail);

  if (!accessToken) {
    return { success: false, error: 'Not authenticated with Google' };
  }

  try {
    const raw = createMessage(options, userEmail);

    const response = await fetch(`${GMAIL_API_URL}/users/me/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Gmail] Failed to send email:', error);

      // Parse specific error messages
      try {
        const errorData = JSON.parse(error);
        const message = errorData.error?.message || 'Failed to send email';
        return { success: false, error: message };
      } catch {
        return { success: false, error: 'Failed to send email' };
      }
    }

    const data = await response.json();
    console.log('[Gmail] Email sent:', data.id);

    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    console.error('[Gmail] Send error:', error);
    return { success: false, error: 'Failed to send email' };
  }
};

/**
 * Send bulk emails (with rate limiting)
 */
export const sendBulkEmails = async (
  userEmail: string,
  recipients: string[],
  subject: string,
  htmlBody: string
): Promise<{
  success: boolean;
  results: Array<{ email: string; success: boolean; messageId?: string; error?: string }>;
  totalSent: number;
  totalFailed: number;
}> => {
  const results: Array<{ email: string; success: boolean; messageId?: string; error?: string }> = [];
  let totalSent = 0;
  let totalFailed = 0;

  // Process in batches to avoid rate limits
  const BATCH_SIZE = 10;
  const DELAY_BETWEEN_BATCHES = 1000; // 1 second

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    // Send batch in parallel
    const batchPromises = batch.map(async (email) => {
      const result = await sendEmail(userEmail, { to: email, subject, htmlBody });
      return { email, ...result };
    });

    const batchResults = await Promise.all(batchPromises);

    for (const result of batchResults) {
      results.push(result);
      if (result.success) {
        totalSent++;
      } else {
        totalFailed++;
      }
    }

    // Delay between batches (except for last batch)
    if (i + BATCH_SIZE < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }

    console.log(`[Gmail] Batch ${Math.floor(i / BATCH_SIZE) + 1} complete: ${batch.length} emails processed`);
  }

  console.log(`[Gmail] Bulk send complete: ${totalSent} sent, ${totalFailed} failed`);

  return {
    success: totalFailed === 0,
    results,
    totalSent,
    totalFailed,
  };
};

/**
 * Get user's email profile info
 */
export const getProfile = async (
  userEmail: string
): Promise<{ success: boolean; email?: string; messagesTotal?: number; error?: string }> => {
  const accessToken = await getValidAccessToken(userEmail);

  if (!accessToken) {
    return { success: false, error: 'Not authenticated with Google' };
  }

  try {
    const response = await fetch(`${GMAIL_API_URL}/users/me/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return { success: false, error: 'Failed to get profile' };
    }

    const data = await response.json();

    return {
      success: true,
      email: data.emailAddress,
      messagesTotal: data.messagesTotal,
    };
  } catch (error) {
    console.error('[Gmail] Profile error:', error);
    return { success: false, error: 'Failed to get profile' };
  }
};
