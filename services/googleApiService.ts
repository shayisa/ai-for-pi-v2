/**
 * Google API Service
 * Frontend wrapper for backend-mediated Google API operations
 *
 * All Google API calls go through the backend which handles:
 * - OAuth token management (Authorization Code flow)
 * - Token refresh
 * - Secure credential storage in SQLite
 *
 * Newsletter Format Support:
 * - v1 (legacy): Standard Newsletter type
 * - v2 (enhanced): Full EnhancedNewsletter preserved via originalEnhanced param
 * - Backward compatible: Old Drive files without formatVersion load as v1
 */

import type { Newsletter, EnhancedNewsletter, GapiAuthData } from '../types';
import { generateEmailHtml } from '../utils/emailGenerator';
import { unwrapResponse, extractErrorMessage } from './apiHelper';

const API_BASE = 'http://localhost:3001';

// ============== OAuth Status ==============

export interface GoogleAuthStatus {
  authenticated: boolean;
  userInfo: {
    email: string;
    name: string;
    picture: string;
  } | null;
}

/**
 * Check if user has valid OAuth tokens
 */
export const checkGoogleAuthStatus = async (userEmail: string): Promise<GoogleAuthStatus> => {
  try {
    const response = await fetch(`${API_BASE}/api/oauth/google/status?userEmail=${encodeURIComponent(userEmail)}`);
    if (!response.ok) {
      return { authenticated: false, userInfo: null };
    }
    const json = await response.json();
    return unwrapResponse<GoogleAuthStatus>(json);
  } catch (error) {
    console.error('[GoogleAPI] Failed to check auth status:', error);
    return { authenticated: false, userInfo: null };
  }
};

/**
 * Initiate Google OAuth flow
 * Redirects user to Google consent screen
 */
export const initiateGoogleAuth = async (userEmail: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE}/api/oauth/google/url?userEmail=${encodeURIComponent(userEmail)}`);
    if (!response.ok) {
      const json = await response.json();
      const errorMsg = json.error?.message || json.error || 'Failed to get authorization URL';
      throw new Error(errorMsg);
    }
    const json = await response.json();
    const data = unwrapResponse<{ url: string }>(json);

    if (!data.url) {
      throw new Error('No authorization URL returned');
    }

    // Redirect to Google consent screen
    window.location.href = data.url;
  } catch (error) {
    console.error('[GoogleAPI] Failed to initiate auth:', error);
    throw error;
  }
};

/**
 * Sign out from Google (revoke tokens)
 */
export const signOutFromGoogle = async (userEmail: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE}/api/oauth/google/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail })
    });
    if (!response.ok) {
      const json = await response.json();
      const errorMsg = json.error?.message || json.error || 'Failed to revoke tokens';
      throw new Error(errorMsg);
    }
  } catch (error) {
    console.error('[GoogleAPI] Failed to sign out:', error);
    throw error;
  }
};

// ============== Drive Operations ==============

export interface DriveNewsletterItem {
  fileId: string;
  fileName: string;
  modifiedTime: string;
  webViewLink?: string;
}

/**
 * Save newsletter to Google Drive
 * @param originalEnhanced - Optional v2 EnhancedNewsletter to preserve full format in Drive
 *                           If provided, the Drive file will contain both v1 HTML and v2 JSON
 */
export const saveToDrive = async (
  userEmail: string,
  newsletter: Newsletter,
  topics: string[] = [],
  originalEnhanced?: EnhancedNewsletter
): Promise<string> => {
  try {
    // Generate HTML content with optional v2 preservation
    const htmlContent = generateNewsletterHTML(newsletter, topics, originalEnhanced);
    const filename = `${newsletter.subject}.html`;

    const response = await fetch(`${API_BASE}/api/drive/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail,
        content: htmlContent,
        filename
      })
    });

    if (!response.ok) {
      const json = await response.json();
      const errorMsg = json.error?.message || json.error || 'Failed to save to Drive';
      throw new Error(errorMsg);
    }

    return `Newsletter "${newsletter.subject}" saved to Google Drive.`;
  } catch (error) {
    console.error('[GoogleAPI] Failed to save to Drive:', error);
    throw error;
  }
};

/**
 * List newsletters from Google Drive
 */
export const listNewslettersFromDrive = async (
  userEmail: string,
  pageSize: number = 20
): Promise<DriveNewsletterItem[]> => {
  try {
    const response = await fetch(
      `${API_BASE}/api/drive/list?userEmail=${encodeURIComponent(userEmail)}&pageSize=${pageSize}`
    );

    if (!response.ok) {
      const json = await response.json();
      const errorMsg = json.error?.message || json.error || 'Failed to list from Drive';
      throw new Error(errorMsg);
    }

    const json = await response.json();
    const data = unwrapResponse<{ files?: Array<{ id: string; name: string; modifiedTime: string }> }>(json);
    return (data.files || []).map((f) => ({
      fileId: f.id,
      fileName: f.name,
      modifiedTime: f.modifiedTime,
    }));
  } catch (error) {
    console.error('[GoogleAPI] Failed to list from Drive:', error);
    throw error;
  }
};

/**
 * Load newsletter from Google Drive with format detection
 * Returns v2 enhanced newsletter if available, otherwise v1 legacy
 */
export const loadNewsletterFromDrive = async (
  userEmail: string,
  fileId: string
): Promise<{
  newsletter: Newsletter | EnhancedNewsletter;
  topics: string[];
  formatVersion: 'v1' | 'v2';
}> => {
  try {
    const response = await fetch(
      `${API_BASE}/api/drive/load/${fileId}?userEmail=${encodeURIComponent(userEmail)}`
    );

    if (!response.ok) {
      const json = await response.json();
      const errorMsg = json.error?.message || json.error || 'Failed to load from Drive';
      throw new Error(errorMsg);
    }

    const json = await response.json();
    const data = unwrapResponse<{ content: string }>(json);
    const htmlContent = data.content;

    // Extract JSON from the embedded script tag
    const startMarker = '<script type="application/json" id="newsletter-data">';
    const endMarker = '</script>';
    const startIndex = htmlContent.indexOf(startMarker);
    const endIndex = htmlContent.indexOf(endMarker, startIndex);

    if (startIndex === -1 || endIndex === -1) {
      throw new Error('Newsletter data not found in HTML. This file may have been saved with an older version.');
    }

    const jsonStart = startIndex + startMarker.length;
    const jsonContent = htmlContent.substring(jsonStart, endIndex).trim();
    const parsed = JSON.parse(jsonContent);

    // Check if this is a v2 format with embedded enhanced newsletter
    if (parsed.formatVersion === 'v2' && parsed.originalEnhanced) {
      return {
        newsletter: parsed.originalEnhanced,
        topics: parsed.topics || [],
        formatVersion: 'v2'
      };
    }

    // Legacy v1 format (backward compatible)
    return {
      newsletter: parsed.newsletter,
      topics: parsed.topics || [],
      formatVersion: 'v1'
    };
  } catch (error) {
    console.error('[GoogleAPI] Failed to load from Drive:', error);
    throw error;
  }
};

// ============== Gmail Operations ==============

/**
 * Send newsletter via Gmail
 */
export const sendEmail = async (
  userEmail: string,
  newsletter: Newsletter,
  topics: string[],
  subscriberEmails: string[],
  listNames?: string[]
): Promise<{ message: string; sentCount: number; listNames: string[] }> => {
  try {
    const htmlBody = generateEmailHtml(newsletter, topics);
    const validEmails = subscriberEmails.filter(email => email && email.includes('@'));

    if (validEmails.length === 0) {
      return { message: 'No valid subscriber emails. Email not sent.', sentCount: 0, listNames: listNames || [] };
    }

    // Send to each recipient via backend
    const response = await fetch(`${API_BASE}/api/gmail/send-bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail,
        recipients: validEmails,
        subject: newsletter.subject,
        htmlBody
      })
    });

    if (!response.ok) {
      const json = await response.json();
      const errorMsg = json.error?.message || json.error || 'Failed to send email';
      throw new Error(errorMsg);
    }

    const json = await response.json();
    const result = unwrapResponse<{ totalSent: number }>(json);
    return {
      message: `Email sent successfully to ${result.totalSent} subscriber(s).`,
      sentCount: result.totalSent,
      listNames: listNames || []
    };
  } catch (error) {
    console.error('[GoogleAPI] Failed to send email:', error);
    throw new Error('Failed to send email via Gmail. Check your permissions.');
  }
};

// ============== Legacy Compatibility ==============

// These functions maintain backwards compatibility with existing code

let onAuthChangeCallback: ((data: GapiAuthData | null) => void) | null = null;
let cachedAuthStatus: GoogleAuthStatus | null = null;

/**
 * Initialize Google API client (legacy compatibility)
 * Now checks backend OAuth status instead of initializing GIS
 */
export const initClient = async (
  callback: (data: GapiAuthData | null) => void,
  onInitComplete: () => void,
  userEmail?: string
) => {
  onAuthChangeCallback = callback;

  if (!userEmail) {
    console.log('[GoogleAPI] No user email provided - Google features disabled');
    callback(null);
    onInitComplete();
    return;
  }

  try {
    const status = await checkGoogleAuthStatus(userEmail);
    cachedAuthStatus = status;

    if (status.authenticated && status.userInfo) {
      callback({
        access_token: 'backend-managed', // Token is managed by backend
        email: status.userInfo.email,
        name: status.userInfo.name,
      });
    } else {
      callback(null);
    }
  } catch (error) {
    console.error('[GoogleAPI] Failed to check auth status:', error);
    callback(null);
  }

  onInitComplete();
};

/**
 * Sign in with Google (legacy compatibility)
 * Now redirects to OAuth consent via backend
 */
export const signIn = async (userEmail: string) => {
  if (!userEmail) {
    alert('Please enter your email first');
    return;
  }
  await initiateGoogleAuth(userEmail);
};

/**
 * Sign out from Google (legacy compatibility)
 */
export const signOut = async (userEmail: string) => {
  if (userEmail) {
    await signOutFromGoogle(userEmail);
  }
  cachedAuthStatus = null;
  if (onAuthChangeCallback) {
    onAuthChangeCallback(null);
  }
};

/**
 * Check if Google credentials are configured
 */
export const areGoogleCredentialsConfigured = (): boolean => {
  return cachedAuthStatus?.authenticated || false;
};

/**
 * Load Google credentials from backend (legacy compatibility)
 * Returns true if credentials exist in SQLite
 */
export const loadGoogleCredentialsFromBackend = async (userEmail: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/api/keys/google/credentials?userEmail=${encodeURIComponent(userEmail)}`);
    if (!response.ok) return false;

    const json = await response.json();
    const data = unwrapResponse<{ configured?: boolean }>(json);
    return data.configured === true;
  } catch (error) {
    console.warn('[GoogleAPI] Error checking credentials:', error);
    return false;
  }
};

// ============== Helper Functions ==============

// Helper to escape HTML
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Helper to highlight XML tags in code blocks
const highlightPromptCode = (code: string): string => {
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .split('\n')
    .map(line => {
      return line.replace(/&lt;(\/?[\w]+)&gt;/g, '<span style="color: #F3D250; font-weight: bold;">&lt;$1&gt;</span>');
    })
    .join('\n');
};

// Generate complete HTML document for newsletter
// If originalEnhanced is provided, embed it for v2 format recovery on load
const generateNewsletterHTML = (
  newsletter: Newsletter,
  topics: string[] = [],
  originalEnhanced?: EnhancedNewsletter
): string => {
  // Build embedded data with format version
  const embeddedData = originalEnhanced
    ? { newsletter, topics, formatVersion: 'v2' as const, originalEnhanced }
    : { newsletter, topics, formatVersion: 'v1' as const };

  const topicsHtml = newsletter.sections.map(s => s.title).join(', ');
  const sectionsHtml = newsletter.sections.map(section => `
    <div style="margin-bottom: 3rem; display: flex; gap: 1rem; align-items: flex-start;">
      <section style="flex: 1;">
        <h2 style="font-size: 1.875rem; font-weight: bold; color: #333333; margin-bottom: 1rem; font-family: sans-serif;">
          ${escapeHtml(section.title)}
        </h2>
        <div style="font-size: 1.125rem; color: #666666; line-height: 1.75; margin-bottom: 1.5rem;">
          ${section.content}
        </div>
        ${section.imageUrl ? `
          <div style="aspect-ratio: 16/9; background: #e5e7eb; border-radius: 0.5rem; overflow: hidden; border: 1px solid #d1d5db; margin-bottom: 1rem;">
            <img src="${escapeHtml(section.imageUrl)}" alt="${escapeHtml(section.title)}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
        ` : ''}
      </section>
    </div>
  `).join('');

  const promptOfTheDayHtml = newsletter.promptOfTheDay ? `
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;" />
    <div style="margin-bottom: 1.5rem;">
      <h3 style="font-size: 1.25rem; font-weight: bold; color: #333333; text-align: center; margin-bottom: 1rem;">Prompt of the Day</h3>
      <div style="background: #f3f4f6; border-radius: 0.5rem; padding: 1.5rem;">
        <h4 style="font-size: 1.125rem; font-weight: bold; color: #333333; margin-bottom: 0.5rem;">
          ${escapeHtml(newsletter.promptOfTheDay.title)}
        </h4>
        <p style="font-size: 1rem; color: #666666; margin-bottom: 1rem; text-align: left;">
          ${escapeHtml(newsletter.promptOfTheDay.summary)}
        </p>
        <p style="font-size: 0.875rem; font-weight: 600; color: #666666; margin-bottom: 0.5rem;">Three example prompts:</p>
        <ul style="list-style: disc; list-style-position: inside; font-size: 1rem; color: #666666; margin-bottom: 1rem; padding-left: 1rem;">
          ${newsletter.promptOfTheDay.examplePrompts.map(prompt =>
            `<li style="margin-bottom: 0.25rem;">${escapeHtml(prompt)}</li>`
          ).join('')}
        </ul>
        <p style="font-size: 0.875rem; font-weight: 600; color: #666666; margin-bottom: 0.5rem; margin-top: 1rem;">Prompt Code:</p>
        <pre style="background: #2C2C2C; border: 1px solid #1a1a1a; border-radius: 0.375rem; padding: 1rem; font-size: 0.875rem; color: #eeeeee; margin-bottom: 1rem; line-height: 1.5; white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word; font-family: 'Courier New', Courier, monospace;">${highlightPromptCode(newsletter.promptOfTheDay.promptCode)}</pre>
      </div>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(newsletter.subject)}</title>
  <script type="application/json" id="newsletter-data">
  ${JSON.stringify(embeddedData, null, 2)}
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, serif; background: #f5f5f5; color: #333333; }
    .container { max-width: 56rem; margin: 2rem auto; background: white; border-radius: 0.5rem; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
    .header { padding: 2rem 3rem; border-bottom: 1px solid #e5e7eb; }
    .topic { margin-bottom: 1rem; }
    .topic-label { font-size: 0.875rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #666666; }
    .topic-value { font-size: 1.125rem; color: #333333; font-family: sans-serif; }
    h1 { font-size: 2.25rem; font-weight: 900; color: #333333; }
    .content { padding: 2rem 3rem; }
    .newsletter-content a { color: #5DA2D5; text-decoration: underline; }
    .newsletter-content a:hover { color: #4A8BBF; }
    .newsletter-content p { margin-bottom: 1rem; line-height: 1.75; }
    .introduction { font-size: 1.125rem; color: #666666; margin-bottom: 2rem; line-height: 1.75; }
    .conclusion { font-size: 1.125rem; color: #666666; margin-top: 2rem; line-height: 1.75; }
    .footer { background: #f9fafb; padding: 2rem 3rem; margin-top: 2rem; border-top: 1px solid #e5e7eb; border-radius: 0 0 0.5rem 0.5rem; }
    .footer p { font-size: 0.875rem; color: #666666; text-align: center; margin-bottom: 1rem; }
    .footer a { color: #5DA2D5; text-decoration: underline; font-weight: bold; }
    .subscribe-btn { display: inline-block; background: #1A1A1A; color: white; font-weight: bold; font-size: 0.875rem; padding: 0.75rem 1.5rem; text-decoration: none; margin: 1rem auto; cursor: pointer; }
    .subscribe-btn:hover { background: #333333; }
    .explore { margin: 1.5rem 0; }
    .explore-title { font-size: 1.125rem; font-weight: bold; color: #333333; text-align: center; margin-bottom: 1rem; }
    .topic-item { text-align: center; margin-bottom: 1rem; }
    .topic-item-name { font-size: 0.875rem; color: #333333; font-weight: 600; margin-bottom: 0.25rem; }
    .topic-links { font-size: 0.875rem; display: flex; justify-content: center; gap: 1rem; }
    .topic-links a { color: #1E3A5F; text-decoration: none; font-weight: bold; }
    .topic-links span { color: #d1d5db; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="topic">
        <span class="topic-label">Topic</span>
        <p class="topic-value">${escapeHtml(topicsHtml)}</p>
      </div>
      <h1>${escapeHtml(newsletter.subject)}</h1>
    </div>
    <div class="content newsletter-content">
      <p class="introduction">${newsletter.introduction}</p>
      ${sectionsHtml}
      <p class="conclusion">${newsletter.conclusion}</p>
    </div>
    <div class="footer">
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;" />
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <p style="margin-bottom: 1rem;">Enjoying these insights? Share them with a colleague!</p>
        <a href="#" class="subscribe-btn">Subscribe Here</a>
        <p style="margin-top: 1rem; font-size: 0.875rem;">
          <a href="mailto:?subject=${encodeURIComponent('FW: ' + newsletter.subject)}">Forward this email</a>
        </p>
      </div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;" />
      <div class="explore">
        <div class="explore-title">Explore Further</div>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${newsletter.sections.map(section => `
            <div class="topic-item">
              <p class="topic-item-name">${escapeHtml(section.title)}</p>
              <div class="topic-links">
                <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(section.title)}" target="_blank">YouTube</a>
                <span>|</span>
                <a href="https://scholar.google.com/scholar?q=${encodeURIComponent(section.title)}" target="_blank">Google Scholar</a>
                <span>|</span>
                <a href="https://twitter.com/search?q=${encodeURIComponent(section.title)}" target="_blank">X/Twitter</a>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      ${promptOfTheDayHtml}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;" />
      <p style="margin-bottom: 0.5rem;">AI for PI</p>
      <p style="margin-bottom: 0.5rem; font-size: 0.75rem;">This newsletter was curated and generated with the assistance of AI.</p>
      <p style="font-size: 0.75rem;">
        <a href="mailto:shayisa@gmail.com?subject=UNSUBSCRIBE" style="color: #1E3A5F; text-decoration: underline;">Unsubscribe</a>
        <span style="margin: 0 0.5rem;">|</span>
        <a href="mailto:shayisa@gmail.com" style="color: #1E3A5F; text-decoration: underline;">Contact Us</a>
      </p>
    </div>
  </div>
</body>
</html>`;
};
