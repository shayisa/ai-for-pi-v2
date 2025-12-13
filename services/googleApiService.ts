

declare global {
  interface Window {
    gapi: any;
    google: any;
    GOOGLE_CONFIG?: {
        API_KEY: string;
        CLIENT_ID: string;
    }
  }
}

import type { Newsletter, GapiAuthData, Subscriber, SubscriberList } from '../types';
import { generateEmailHtml } from '../utils/emailGenerator';

// ==================================================================
// SECURELY LOAD YOUR GOOGLE CLOUD CREDENTIALS
// ==================================================================
// These variables are loaded from the config.js file for local development.
// If this file is not present or configured, the dependent workflow features
// (Drive, Sheets, Gmail) will be gracefully disabled.
// ==================================================================
const API_KEY = window.GOOGLE_CONFIG?.API_KEY;
const CLIENT_ID = window.GOOGLE_CONFIG?.CLIENT_ID;
const IS_GAPI_CONFIGURED = !!(API_KEY && CLIENT_ID && API_KEY !== 'YOUR_GOOGLE_API_KEY_HERE');

if (!IS_GAPI_CONFIGURED) {
    console.warn("Google Workspace credentials not found or incomplete in config.js. Workflow actions (Save to Drive, Log to Sheet, Send Email) will be disabled. This is expected if you are not running this locally with a config.js file.");
}


const DISCOVERY_DOCS = [
    "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
    "https://sheets.googleapis.com/$discovery/rest?version=v4",
    "https://docs.googleapis.com/$discovery/rest?version=v1",
    "https://gmail.googleapis.com/$discovery/rest?version=v1",
    "https://www.googleapis.com/discovery/v1/apis/oauth2/v2/rest" // Added for userinfo.get
];
const SCOPES = [
    'openid', // For getting ID token (required for Supabase OAuth)
    'https://www.googleapis.com/auth/drive.file', // For Drive actions
    'https://www.googleapis.com/auth/documents', // For Docs actions
    'https://www.googleapis.com/auth/spreadsheets', // For Sheets actions
    'https://www.googleapis.com/auth/gmail.send', // For Gmail actions
    'https://www.googleapis.com/auth/userinfo.email', // For fetching user email
    'https://www.googleapis.com/auth/userinfo.profile', // For fetching user name
].join(' ');

let gapi: any; // GAPI client library
let google: any; // Google Identity Services (GIS)
let tokenClient: any; // GSI token client
let onAuthChangeCallback: ((data: GapiAuthData | null) => void) | null = null; // Callback for App.tsx
let currentAccessToken: string | null = null; // Store the current access token from GIS
let currentIdToken: string | null = null; // Store the current ID token from GIS for Supabase OAuth


// Helper to load GAPI script and client library
// NOTE: GAPI is no longer loaded due to MIME type issues with Google's servers.
// We use GIS (Google Identity Services) only for authentication.
const loadGapi = (): Promise<void> => {
    return new Promise((resolve) => {
        console.log("DEBUG: GAPI disabled - using GIS-only mode for authentication.");
        // GAPI is not needed for authentication with modern GIS
        resolve();
    });
};

// Helper to wait for Google Identity Services (GIS) to be available
const loadGis = (): Promise<void> => {
    return new Promise((resolve) => {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
            google = window.google;
            console.log("GIS already loaded.");
            resolve();
            return;
        }
        // GIS script is loaded via index.html, so we just wait for it to be ready
        const checkGis = () => {
            if (window.google && window.google.accounts && window.google.accounts.oauth2) {
                google = window.google;
                console.log("GIS detected as loaded.");
                resolve();
            } else {
                setTimeout(checkGis, 100);
            }
        };
        checkGis();
    });
};

// Centralized callback for tokenClient responses
// BEGIN FIX
// The `google.accounts.oauth2.TokenResponse` type is not directly available in this context without
// additional `@types` imports. To avoid introducing new dependencies and comply with coding
// guidelines, we're using `any` for the `resp` parameter. The properties `access_token` and `error`
// are dynamically accessed, which `any` allows.
const handleAuthResponse = async (resp: any) => {
// END FIX
    console.log("handleAuthResponse triggered with response:", resp);
    if (resp.error !== undefined) {
        // interaction_required and consent_required are expected during silent sign-in attempts
        if (resp.error === 'interaction_required' || resp.error === 'consent_required') {
            console.log("DEBUG: User interaction needed for authentication (normal during silent sign-in attempt)");
        } else {
            console.error("Google Auth Error:", resp.error);
        }
        if (onAuthChangeCallback) {
            onAuthChangeCallback(null);
        }
        return;
    }

    // A token was successfully obtained or refreshed
    // Store the token for use with REST APIs
    currentAccessToken = resp.access_token;

    // Store the ID token for Supabase OAuth if available
    if (resp.id_token) {
        currentIdToken = resp.id_token;
        console.log("ID token stored for Supabase authentication");
    } else {
        console.warn("ID token not available in Google OAuth response. Supabase authentication will be limited.");
    }

    console.log("Access token stored for GIS-only mode");

    try {
        // Fetch user profile using Google's REST API (no GAPI needed)
        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${resp.access_token}`
            }
        });

        if (!profileResponse.ok) {
            throw new Error(`Failed to fetch user profile: ${profileResponse.statusText}`);
        }

        const profile = await profileResponse.json();
        console.log("User Profile fetched:", profile);

        if (onAuthChangeCallback) {
            onAuthChangeCallback({
                access_token: resp.access_token,
                email: profile.email,
                name: profile.name,
            });
        }
    } catch (profileError) {
        console.error("Failed to fetch user profile:", profileError);
        if (onAuthChangeCallback) {
            onAuthChangeCallback(null);
        }
    }
};


export const initClient = async (callback: (data: GapiAuthData | null) => void, onInitComplete: () => void) => {
    if (!IS_GAPI_CONFIGURED) {
        console.log("DEBUG: Google API not configured, skipping init.");
        callback(null); // Explicitly set auth to null if not configured
        onInitComplete(); // Signal that initialization attempt is complete
        return;
    }

    onAuthChangeCallback = callback;
    console.log("DEBUG: Initializing Google API client...");

    try {
        console.log("DEBUG: Initializing Google Identity Services (GIS-only mode)...");

        // Skip GAPI loading - we use GIS only
        await loadGapi();

        console.log("DEBUG: Loading GIS...");
        await loadGis(); // Wait for GIS to load
        console.log("DEBUG: GIS loaded.");

        console.log("DEBUG: Initializing GIS token client...");
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: handleAuthResponse, // Set the centralized callback
        });
        console.log("DEBUG: GIS token client initialized successfully.");

        // Attempt automatic sign-in by trying to silently get a token
        console.log("DEBUG: Attempting automatic sign-in with existing credentials...");
        attemptSilentSignIn();

        onInitComplete();

    } catch (error) {
        console.error("DEBUG: Failed to initialize Google API client:", error);
        if (onAuthChangeCallback) {
            onAuthChangeCallback(null);
        }
        onInitComplete(); // Ensure initialization is marked as complete even on error
    }
};

// Attempt to sign in with interactive popup on app load
const attemptSilentSignIn = () => {
    if (!tokenClient) {
        console.log("DEBUG: Token client not ready for sign-in.");
        return;
    }

    try {
        console.log("DEBUG: Requesting access token with interactive UI...");
        // Use prompt: 'consent' to show authentication popup on app load
        // If user is already signed in, it authenticates silently
        // If not signed in, the popup appears for user to authenticate
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (error) {
        console.log("DEBUG: Sign-in attempt encountered an error:", error);
        if (onAuthChangeCallback) {
            onAuthChangeCallback(null);
        }
    }
};

export const signIn = async () => {
    console.log("DEBUG: signIn function called.");
    if (!IS_GAPI_CONFIGURED) {
        alert("Google Workspace integration is not configured. For local development, please create and configure a 'config.js' file with your Google Cloud credentials.");
        return;
    }

    console.log("DEBUG: Checking if GIS token client is initialized...");
    if (!tokenClient) {
        console.error("DEBUG: GIS token client not initialized.", { tokenClient });
        alert("Google Sign-In is not ready. Please try again in a moment. Check console for details.");
        return;
    }

    console.log("DEBUG: Attempting Google Sign-In with consent prompt...");
    // Request access token, this will trigger the pop-up for user consent if needed
    tokenClient.requestAccessToken({ prompt: 'consent' });
    console.log("DEBUG: requestAccessToken called.");
};

export const signOut = () => {
    if (!IS_GAPI_CONFIGURED) return;

    console.log("DEBUG: Attempting Google Sign-Out...");
    // In GIS-only mode, we clear the stored token and notify the UI
    currentAccessToken = null;
    currentIdToken = null; // Also clear the ID token
    console.log("DEBUG: Signed out from Google (GIS-only mode).");
    if (onAuthChangeCallback) {
        onAuthChangeCallback(null); // Update UI
    }
};

// Export function to get the current ID token for Supabase OAuth
export const getIdToken = (): string | null => {
    return currentIdToken;
};

const findOrCreateFolder = async (folderName: string): Promise<string> => {
    if (!currentAccessToken) {
        throw new Error("No access token available. Please sign in first.");
    }

    try {
        const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
        const encodedQuery = encodeURIComponent(query);

        // List existing folders
        const listResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&fields=files(id,name)`,
            {
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            }
        );

        if (!listResponse.ok) {
            throw new Error(`Failed to list Drive folders: ${listResponse.statusText}`);
        }

        const listResult = await listResponse.json();

        if (listResult.files && listResult.files.length > 0) {
            return listResult.files[0].id;
        }

        // Create new folder if not found
        const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder'
            })
        });

        if (!createResponse.ok) {
            throw new Error(`Failed to create Drive folder: ${createResponse.statusText}`);
        }

        const newFolder = await createResponse.json();
        return newFolder.id;
    } catch (error) {
        console.error("Error finding or creating Drive folder:", error);
        throw new Error("Could not access or create the Google Drive folder. Check permissions and folder name.");
    }
};

const findOrCreateSheet = async (sheetName: string, headers: string[]): Promise<string> => {
    if (!currentAccessToken) {
        throw new Error("No access token available. Please sign in first.");
    }

    try {
        const query = `mimeType='application/vnd.google-apps.spreadsheet' and name='${sheetName}' and trashed=false`;
        const encodedQuery = encodeURIComponent(query);

        // List existing sheets
        const listResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&fields=files(id,name)`,
            {
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            }
        );

        if (!listResponse.ok) {
            throw new Error(`Failed to list Sheets: ${listResponse.statusText}`);
        }

        const listResult = await listResponse.json();

        if (listResult.files && listResult.files.length > 0) {
            return listResult.files[0].id;
        }

        // Create new spreadsheet if not found
        const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                properties: { title: sheetName }
            })
        });

        if (!createResponse.ok) {
            throw new Error(`Failed to create Sheet: ${createResponse.statusText}`);
        }

        const spreadsheet = await createResponse.json();
        const sheetId = spreadsheet.spreadsheetId;

        // Add headers to the new sheet
        const updateResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1?valueInputOption=RAW`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values: [headers]
                })
            }
        );

        if (!updateResponse.ok) {
            throw new Error(`Failed to add headers to Sheet: ${updateResponse.statusText}`);
        }

        return sheetId;
    } catch (error) {
        console.error("Error finding or creating Google Sheet:", error);
        throw new Error("Could not access or create the Google Sheet. Check permissions and sheet name.");
    }
};

export const saveToDrive = async (newsletter: Newsletter, folderName: string, topics: string[] = []): Promise<string> => {
    if (!IS_GAPI_CONFIGURED) throw new Error("Google Workspace integration is not configured.");
    if (!currentAccessToken) throw new Error("Not signed in to Google. Please sign in first.");

    try {
        const folderId = await findOrCreateFolder(folderName);

        // Generate HTML content that matches the preview exactly
        const htmlContent = generateNewsletterHTML(newsletter, topics);

        // Create a text file with .html extension
        const fileName = `${newsletter.subject}.html`;

        const fileMetadata = {
            name: fileName,
            mimeType: 'text/html',
            parents: [folderId]
        };

        // Upload the HTML file to Google Drive
        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
        formData.append('file', new Blob([htmlContent], { type: 'text/html' }));

        const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentAccessToken}`
            },
            body: formData
        });

        if (!uploadResponse.ok) {
            throw new Error(`Failed to upload HTML file to Drive: ${uploadResponse.statusText}`);
        }

        return `Newsletter "${newsletter.subject}" saved as HTML file to folder "${folderName}".`;
    } catch (error) {
        console.error("Error saving to Drive:", error);
        if (error instanceof Error) throw error;
        throw new Error("An unexpected error occurred while saving to Google Drive.");
    }
};

// Helper to highlight XML tags in code blocks
const highlightPromptCode = (code: string): string => {
    return code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .split('\n')
        .map(line => {
            // Highlight XML tags in yellow
            return line.replace(/&lt;(\/?[\w]+)&gt;/g, '<span style="color: #F3D250; font-weight: bold;">&lt;$1&gt;</span>');
        })
        .join('\n');
};

// Helper function to generate complete HTML document
const generateNewsletterHTML = (newsletter: Newsletter, topics: string[] = []): string => {
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
    ${JSON.stringify({ newsletter, topics }, null, 2)}
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
        .subscribe-btn { display: inline-block; background: #F78888; color: white; font-weight: bold; font-size: 0.875rem; padding: 0.75rem 1.5rem; border-radius: 0.375rem; text-decoration: none; margin: 1rem auto; cursor: pointer; }
        .subscribe-btn:hover { transform: scale(1.05); }
        .explore { margin: 1.5rem 0; }
        .explore-title { font-size: 1.125rem; font-weight: bold; color: #333333; text-align: center; margin-bottom: 1rem; }
        .topic-item { text-align: center; margin-bottom: 1rem; }
        .topic-item-name { font-size: 0.875rem; color: #333333; font-weight: 600; margin-bottom: 0.25rem; }
        .topic-links { font-size: 0.875rem; display: flex; justify-content: center; gap: 1rem; }
        .topic-links a { color: #5DA2D5; text-decoration: none; font-weight: bold; }
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
            <p style="margin-bottom: 0.5rem;">© 2024 AI for PI</p>
            <p style="margin-bottom: 0.5rem; font-size: 0.75rem;">This newsletter was curated and generated with the assistance of AI.</p>
            <p style="font-size: 0.75rem;">
                <a href="mailto:shayisa@gmail.com?subject=UNSUBSCRIBE" style="color: #5DA2D5; text-decoration: underline;">Unsubscribe</a>
                <span style="margin: 0 0.5rem;">|</span>
                <a href="mailto:shayisa@gmail.com" style="color: #5DA2D5; text-decoration: underline;">Contact Us</a>
            </p>
        </div>
    </div>
</body>
</html>`;
};

// Helper to escape HTML
const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

// Interface for Drive newsletter items
export interface DriveNewsletterItem {
    fileId: string;
    fileName: string;
    modifiedTime: string;
    webViewLink?: string;
}

// List newsletters from Google Drive folder
export const listNewslettersFromDrive = async (folderName: string): Promise<DriveNewsletterItem[]> => {
    if (!IS_GAPI_CONFIGURED) throw new Error("Google Workspace integration is not configured.");
    if (!currentAccessToken) throw new Error("Not signed in to Google. Please sign in first.");

    try {
        const folderId = await findOrCreateFolder(folderName);

        // Search for HTML files in the folder
        const query = `'${folderId}' in parents and mimeType='text/html' and trashed=false`;
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime,webViewLink)&pageSize=50`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to list files from Drive: ${response.statusText}`);
        }

        const data = await response.json();
        return (data.files || []).map((file: any) => ({
            fileId: file.id,
            fileName: file.name,
            modifiedTime: file.modifiedTime,
            webViewLink: file.webViewLink
        }));
    } catch (error) {
        console.error("Error listing newsletters from Drive:", error);
        if (error instanceof Error) throw error;
        throw new Error("Failed to list newsletters from Google Drive.");
    }
};

// Load a newsletter from Google Drive by file ID
export const loadNewsletterFromDrive = async (fileId: string): Promise<{ newsletter: Newsletter; topics: string[] }> => {
    if (!IS_GAPI_CONFIGURED) throw new Error("Google Workspace integration is not configured.");
    if (!currentAccessToken) throw new Error("Not signed in to Google. Please sign in first.");

    try {
        // Get file content
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch file from Drive: ${response.statusText}`);
        }

        const htmlContent = await response.text();

        // Extract JSON from the embedded script tag - improved pattern to handle large files
        // Use a more flexible pattern that captures everything between the script tags
        const startMarker = '<script type="application/json" id="newsletter-data">';
        const endMarker = '</script>';

        const startIndex = htmlContent.indexOf(startMarker);
        const endIndex = htmlContent.indexOf(endMarker, startIndex);

        if (startIndex === -1 || endIndex === -1) {
            console.error("Newsletter data markers not found in HTML");
            throw new Error("Newsletter data not found in HTML. This file may have been saved with an older version.");
        }

        // Extract the JSON string between the markers
        const jsonStart = startIndex + startMarker.length;
        const jsonContent = htmlContent.substring(jsonStart, endIndex).trim();

        if (!jsonContent) {
            throw new Error("Newsletter data is empty in HTML file.");
        }

        // Parse the JSON
        let data;
        try {
            data = JSON.parse(jsonContent);
        } catch (parseError) {
            console.error("Failed to parse newsletter JSON:", parseError);
            console.error("JSON content length:", jsonContent.length);
            console.error("First 500 chars:", jsonContent.substring(0, 500));
            throw new Error("Newsletter data in HTML is corrupted or malformed.");
        }

        if (!data.newsletter) {
            throw new Error("Newsletter object not found in parsed data.");
        }

        return {
            newsletter: data.newsletter,
            topics: data.topics || []
        };
    } catch (error) {
        console.error("Error loading newsletter from Drive:", error);
        if (error instanceof Error) throw error;
        throw new Error("Failed to load newsletter from Google Drive.");
    }
};

export const logToSheet = async (newsletter: Newsletter, topics: string[], sheetName: string, savedToDrive: boolean = false, sentEmail: boolean = false, sentToLists: string = ''): Promise<string> => {
    if (!IS_GAPI_CONFIGURED) throw new Error("Google Workspace integration is not configured.");
    if (!currentAccessToken) throw new Error("Not signed in to Google. Please sign in first.");
    if (!newsletter.id) throw new Error("Newsletter must have an ID for logging.");

    try {
        const headers = ['ID', 'Date', 'Subject', 'Topics', 'Saved to Drive', 'Sent Email', 'Introduction', 'Conclusion', 'Sent To Lists'];
        const sheetId = await findOrCreateSheet(sheetName, headers);

        // Read all rows to check if this newsletter ID already exists
        const readResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A:I`,
            {
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            }
        );

        if (!readResponse.ok) {
            throw new Error(`Failed to read sheet data: ${readResponse.statusText}`);
        }

        const sheetData = await readResponse.json();
        const allRows = sheetData.values || [];

        // Find if newsletter ID already exists (skip header row)
        let existingRowIndex = -1;
        for (let i = 1; i < allRows.length; i++) {
            if (allRows[i][0] === newsletter.id) {
                existingRowIndex = i + 1; // Google Sheets uses 1-based indexing
                break;
            }
        }

        const newRow = [
            newsletter.id,
            new Date().toISOString(),
            newsletter.subject,
            topics.join(', '),
            savedToDrive ? 'Yes' : 'No',
            sentEmail ? 'Yes' : 'No',
            newsletter.introduction,
            newsletter.conclusion,
            sentToLists || ''
        ];

        if (existingRowIndex > 0) {
            // Update existing row
            const updateResponse = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A${existingRowIndex}:I${existingRowIndex}?valueInputOption=USER_ENTERED`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${currentAccessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        values: [newRow]
                    })
                }
            );

            if (!updateResponse.ok) {
                throw new Error(`Failed to update row in Sheet: ${updateResponse.statusText}`);
            }

            console.log(`Updated existing newsletter ${newsletter.id} at row ${existingRowIndex}`);
            return `Newsletter tracking updated for ID: ${newsletter.id}`;
        } else {
            // Append new row
            const appendResponse = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A:I:append?valueInputOption=USER_ENTERED`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${currentAccessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        values: [newRow]
                    })
                }
            );

            if (!appendResponse.ok) {
                throw new Error(`Failed to append row to Sheet: ${appendResponse.statusText}`);
            }

            console.log(`Created new entry for newsletter ${newsletter.id}`);
            return `Newsletter logged successfully to sheet "${sheetName}".`;
        }
    } catch (error) {
        console.error("Error logging to Sheet:", error);
        if (error instanceof Error) throw error;
        throw new Error("An unexpected error occurred while logging to Google Sheets.");
    }
};

export const sendEmail = async (
    newsletter: Newsletter,
    topics: string[],
    subscribersSheetName: string,
    userEmail?: string,
    listIds?: string[]
): Promise<{ message: string; sentCount: number; listNames: string[] }> => {
    if (!IS_GAPI_CONFIGURED) throw new Error("Google Workspace integration is not configured.");
    if (!currentAccessToken) throw new Error("Not signed in to Google. Please sign in first.");

    try {
        // Get authenticated user's email if not provided
        let fromEmail = userEmail;
        if (!fromEmail) {
            const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { 'Authorization': `Bearer ${currentAccessToken}` }
            });
            if (profileResponse.ok) {
                const profile = await profileResponse.json();
                fromEmail = profile.email;
            } else {
                fromEmail = 'noreply@gmail.com'; // Fallback
            }
        }

        const sheetId = await findOrCreateSheet(subscribersSheetName, ['Email', 'Name', 'Status', 'Lists', 'Date Added', 'Date Removed', 'Source']);

        // Get ALL subscriber data (not just emails)
        const getResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A2:G`,
            {
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            }
        );

        if (!getResponse.ok) {
            throw new Error(`Failed to read subscriber data: ${getResponse.statusText}`);
        }

        const sheetData = await getResponse.json();
        const allRows = sheetData.values || [];

        // Filter subscribers: active status + matching lists (if specified)
        let emails: string[] = [];
        let sentListNames: string[] = [];

        for (const row of allRows) {
            const email = row[0];
            const status = row[2] || 'active';
            const subscriberLists = row[3] ? row[3].split(',').map((l: string) => l.trim()) : [];

            // Must be active
            if (status !== 'active') continue;

            // Must have valid email
            if (!email || !email.includes('@')) continue;

            // If listIds specified, must be in at least one
            if (listIds && listIds.length > 0) {
                const inSelectedList = subscriberLists.some(list => listIds.includes(list));
                if (!inSelectedList) continue;
            }

            emails.push(email);
        }

        console.log(`Sending to ${emails.length} subscriber(s). Lists specified: ${listIds?.length || 'all'}`);

        if (emails.length === 0) {
            const reason = listIds?.length ? `No active subscribers in selected list(s)` : `No active subscribers found`;
            console.warn(`${reason} in sheet "${subscribersSheetName}".`);
            return { message: `${reason}. Email not sent.`, sentCount: 0, listNames: [] };
        }

        const htmlBody = generateEmailHtml(newsletter, topics);

        const emailString = [
            `From: ${fromEmail}`,
            `To: ${fromEmail}`,
            `Bcc: ${emails.join(',')}`,
            `Subject: ${newsletter.subject}`,
            `Content-Type: text/html; charset="UTF-8"`,
            `MIME-Version: 1.0`,
            ``,
            htmlBody,
        ].join('\n');

        // Gmail API requires standard base64 encoding (not URL-safe)
        const base64Email = btoa(unescape(encodeURIComponent(emailString)));

        // Send email via Gmail
        const sendResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                raw: base64Email
            })
        });

        if (!sendResponse.ok) {
            const errorDetails = await sendResponse.text().catch(() => sendResponse.statusText);
            console.error("Gmail API Error Response:", errorDetails);
            throw new Error(`Failed to send email: ${sendResponse.statusText} - ${errorDetails}`);
        }

        // Get list names for logging
        if (listIds && listIds.length > 0) {
            const allLists = await readAllLists('Group List').catch(() => []);
            sentListNames = allLists
                .filter(l => listIds.includes(l.id))
                .map(l => l.name);
        }

        return {
            message: `Email sent successfully to ${emails.length} subscriber(s).`,
            sentCount: emails.length,
            listNames: sentListNames
        };
    } catch (error) {
        console.error("Error sending email:", error);
        throw new Error("Failed to send email via Gmail. Check your permissions and the subscriber sheet.");
    }
};

// ===================================================================
// SUBSCRIBER MANAGEMENT FUNCTIONS
// ===================================================================

/**
 * Generate a unique 5-character list ID
 */
const generateListId = (): string => {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
};

/**
 * Read all subscribers from the Newsletter Subscribers sheet
 */
export const readAllSubscribers = async (subscribersSheetName: string): Promise<Subscriber[]> => {
    if (!IS_GAPI_CONFIGURED) throw new Error("Google Workspace integration is not configured.");
    if (!currentAccessToken) throw new Error("Not signed in to Google. Please sign in first.");

    try {
        const headers = ['Email', 'Name', 'Status', 'Lists', 'Date Added', 'Date Removed', 'Source'];
        const sheetId = await findOrCreateSheet(subscribersSheetName, headers);

        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A2:G`,
            {
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to read subscribers: ${response.statusText}`);
        }

        const data = await response.json();
        const rows = data.values || [];

        // Convert rows to Subscriber objects
        const subscribers: Subscriber[] = rows
            .filter((row: any[]) => row[0] && row[0].includes('@')) // Valid email
            .map((row: any[]) => ({
                email: row[0] || '',
                name: row[1] || '',
                status: (row[2] || 'active') as 'active' | 'inactive',
                lists: row[3] || '',
                dateAdded: row[4] || new Date().toISOString(),
                dateRemoved: row[5] || undefined,
                source: row[6] || 'manual'
            }));

        return subscribers;
    } catch (error) {
        console.error("Error reading subscribers:", error);
        throw error;
    }
};

/**
 * Add a new subscriber
 */
export const addSubscriber = async (subscriber: Subscriber, subscribersSheetName: string): Promise<string> => {
    if (!IS_GAPI_CONFIGURED) throw new Error("Google Workspace integration is not configured.");
    if (!currentAccessToken) throw new Error("Not signed in to Google. Please sign in first.");

    try {
        // Check for duplicates
        const existing = await readAllSubscribers(subscribersSheetName);
        if (existing.some(s => s.email.toLowerCase() === subscriber.email.toLowerCase())) {
            throw new Error("Subscriber with this email already exists.");
        }

        const headers = ['Email', 'Name', 'Status', 'Lists', 'Date Added', 'Date Removed', 'Source'];
        const sheetId = await findOrCreateSheet(subscribersSheetName, headers);

        const newRow = [
            subscriber.email,
            subscriber.name || '',
            subscriber.status || 'active',
            subscriber.lists || '',
            subscriber.dateAdded || new Date().toISOString(),
            subscriber.dateRemoved || '',
            subscriber.source || 'manual'
        ];

        const appendResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A:G:append?valueInputOption=USER_ENTERED`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values: [newRow] })
            }
        );

        if (!appendResponse.ok) {
            throw new Error(`Failed to add subscriber: ${appendResponse.statusText}`);
        }

        return `Subscriber ${subscriber.email} added successfully.`;
    } catch (error) {
        console.error("Error adding subscriber:", error);
        throw error;
    }
};

/**
 * Update an existing subscriber
 */
export const updateSubscriber = async (email: string, updates: Partial<Subscriber>, subscribersSheetName: string): Promise<string> => {
    if (!IS_GAPI_CONFIGURED) throw new Error("Google Workspace integration is not configured.");
    if (!currentAccessToken) throw new Error("Not signed in to Google. Please sign in first.");

    try {
        const headers = ['Email', 'Name', 'Status', 'Lists', 'Date Added', 'Date Removed', 'Source'];
        const sheetId = await findOrCreateSheet(subscribersSheetName, headers);

        // Read all subscribers to find the row
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A2:G`,
            {
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to read subscribers: ${response.statusText}`);
        }

        const data = await response.json();
        const rows = data.values || [];

        // Find row index
        let rowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i][0] && rows[i][0].toLowerCase() === email.toLowerCase()) {
                rowIndex = i + 2; // +2 because we start from row 2 and Google Sheets is 1-indexed
                break;
            }
        }

        if (rowIndex === -1) {
            throw new Error(`Subscriber ${email} not found.`);
        }

        // Get current row and merge with updates
        const currentRow = rows[rowIndex - 2];
        const updatedRow = [
            updates.email || currentRow[0],
            updates.name !== undefined ? updates.name : currentRow[1],
            updates.status || currentRow[2],
            updates.lists !== undefined ? updates.lists : currentRow[3],
            currentRow[4], // Keep date added
            updates.dateRemoved !== undefined ? updates.dateRemoved : currentRow[5],
            updates.source || currentRow[6]
        ];

        // Update row
        const updateResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A${rowIndex}:G${rowIndex}?valueInputOption=USER_ENTERED`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values: [updatedRow] })
            }
        );

        if (!updateResponse.ok) {
            throw new Error(`Failed to update subscriber: ${updateResponse.statusText}`);
        }

        return `Subscriber ${email} updated successfully.`;
    } catch (error) {
        console.error("Error updating subscriber:", error);
        throw error;
    }
};

/**
 * Soft delete a subscriber (set status to inactive)
 */
export const deleteSubscriber = async (email: string, subscribersSheetName: string): Promise<string> => {
    return updateSubscriber(
        email,
        {
            status: 'inactive',
            dateRemoved: new Date().toISOString()
        },
        subscribersSheetName
    );
};

/**
 * Get a subscriber by email
 */
export const getSubscriberByEmail = async (email: string, subscribersSheetName: string): Promise<Subscriber | null> => {
    try {
        const subscribers = await readAllSubscribers(subscribersSheetName);
        return subscribers.find(s => s.email.toLowerCase() === email.toLowerCase()) || null;
    } catch (error) {
        console.error("Error getting subscriber:", error);
        return null;
    }
};

/**
 * Read all subscriber lists
 */
export const readAllLists = async (groupListSheetName: string): Promise<SubscriberList[]> => {
    if (!IS_GAPI_CONFIGURED) throw new Error("Google Workspace integration is not configured.");
    if (!currentAccessToken) throw new Error("Not signed in to Google. Please sign in first.");

    try {
        const headers = ['List ID', 'List Name', 'Description', 'Date Created', 'Subscriber Count'];
        const sheetId = await findOrCreateSheet(groupListSheetName, headers);

        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A2:E`,
            {
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to read lists: ${response.statusText}`);
        }

        const data = await response.json();
        const rows = data.values || [];

        const lists: SubscriberList[] = rows
            .filter((row: any[]) => row[0]) // Has list ID
            .map((row: any[]) => ({
                id: row[0] || '',
                name: row[1] || '',
                description: row[2] || '',
                dateCreated: row[3] || new Date().toISOString(),
                subscriberCount: parseInt(row[4] || '0', 10)
            }));

        return lists;
    } catch (error) {
        console.error("Error reading lists:", error);
        throw error;
    }
};

/**
 * Create a new subscriber list
 */
export const createList = async (name: string, description: string = '', groupListSheetName: string): Promise<SubscriberList> => {
    if (!IS_GAPI_CONFIGURED) throw new Error("Google Workspace integration is not configured.");
    if (!currentAccessToken) throw new Error("Not signed in to Google. Please sign in first.");

    try {
        const listId = generateListId();
        const headers = ['List ID', 'List Name', 'Description', 'Date Created', 'Subscriber Count'];
        const sheetId = await findOrCreateSheet(groupListSheetName, headers);

        const newRow = [
            listId,
            name,
            description,
            new Date().toISOString(),
            '0'
        ];

        const appendResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A:E:append?valueInputOption=USER_ENTERED`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values: [newRow] })
            }
        );

        if (!appendResponse.ok) {
            throw new Error(`Failed to create list: ${appendResponse.statusText}`);
        }

        return {
            id: listId,
            name,
            description,
            dateCreated: new Date().toISOString(),
            subscriberCount: 0
        };
    } catch (error) {
        console.error("Error creating list:", error);
        throw error;
    }
};

/**
 * Update an existing list
 */
export const updateList = async (id: string, updates: Partial<SubscriberList>, groupListSheetName: string): Promise<string> => {
    if (!IS_GAPI_CONFIGURED) throw new Error("Google Workspace integration is not configured.");
    if (!currentAccessToken) throw new Error("Not signed in to Google. Please sign in first.");

    try {
        const headers = ['List ID', 'List Name', 'Description', 'Date Created', 'Subscriber Count'];
        const sheetId = await findOrCreateSheet(groupListSheetName, headers);

        // Read all lists to find the row
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A2:E`,
            {
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to read lists: ${response.statusText}`);
        }

        const data = await response.json();
        const rows = data.values || [];

        // Find row index
        let rowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i][0] && rows[i][0] === id) {
                rowIndex = i + 2;
                break;
            }
        }

        if (rowIndex === -1) {
            throw new Error(`List ${id} not found.`);
        }

        // Get current row and merge with updates
        const currentRow = rows[rowIndex - 2];
        const updatedRow = [
            currentRow[0], // Keep list ID
            updates.name || currentRow[1],
            updates.description !== undefined ? updates.description : currentRow[2],
            currentRow[3], // Keep date created
            updates.subscriberCount !== undefined ? updates.subscriberCount.toString() : currentRow[4]
        ];

        // Update row
        const updateResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A${rowIndex}:E${rowIndex}?valueInputOption=USER_ENTERED`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values: [updatedRow] })
            }
        );

        if (!updateResponse.ok) {
            throw new Error(`Failed to update list: ${updateResponse.statusText}`);
        }

        return `List ${name} updated successfully.`;
    } catch (error) {
        console.error("Error updating list:", error);
        throw error;
    }
};

/**
 * Delete a list and remove it from all subscribers
 */
export const deleteList = async (id: string, subscribersSheetName: string, groupListSheetName: string): Promise<string> => {
    if (!IS_GAPI_CONFIGURED) throw new Error("Google Workspace integration is not configured.");
    if (!currentAccessToken) throw new Error("Not signed in to Google. Please sign in first.");

    try {
        // Read all subscribers
        const subscribers = await readAllSubscribers(subscribersSheetName);

        // Remove this list from all subscribers
        for (const subscriber of subscribers) {
            if (subscriber.lists.includes(id)) {
                const newLists = subscriber.lists
                    .split(',')
                    .map(l => l.trim())
                    .filter(l => l !== id)
                    .join(',');
                await updateSubscriber(subscriber.email, { lists: newLists }, subscribersSheetName);
            }
        }

        // Delete the list row from Group List sheet
        const headers = ['List ID', 'List Name', 'Description', 'Date Created', 'Subscriber Count'];
        const sheetId = await findOrCreateSheet(groupListSheetName, headers);

        // Read all lists to find row
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A2:E`,
            {
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to read lists: ${response.statusText}`);
        }

        const data = await response.json();
        const rows = data.values || [];

        // Find row index
        let rowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i][0] && rows[i][0] === id) {
                rowIndex = i + 2;
                break;
            }
        }

        if (rowIndex > 0) {
            // Hard delete using batchUpdate
            const deleteResponse = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${currentAccessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        requests: [{
                            deleteDimension: {
                                range: {
                                    sheetId: 0,
                                    dimension: 'ROWS',
                                    startIndex: rowIndex - 1,
                                    endIndex: rowIndex
                                }
                            }
                        }]
                    })
                }
            );

            if (!deleteResponse.ok) {
                throw new Error(`Failed to delete list: ${deleteResponse.statusText}`);
            }
        }

        return `List deleted successfully.`;
    } catch (error) {
        console.error("Error deleting list:", error);
        throw error;
    }
};

/**
 * Get a list by ID
 */
export const getListById = async (id: string, groupListSheetName: string): Promise<SubscriberList | null> => {
    try {
        const lists = await readAllLists(groupListSheetName);
        return lists.find(l => l.id === id) || null;
    } catch (error) {
        console.error("Error getting list:", error);
        return null;
    }
};

/**
 * Add a subscriber to a list
 */
export const addSubscriberToList = async (email: string, listId: string, subscribersSheetName: string, groupListSheetName: string): Promise<string> => {
    try {
        const subscriber = await getSubscriberByEmail(email, subscribersSheetName);
        if (!subscriber) {
            throw new Error(`Subscriber ${email} not found.`);
        }

        // Add list ID if not already present
        const lists = subscriber.lists ? subscriber.lists.split(',').map(l => l.trim()) : [];
        if (!lists.includes(listId)) {
            lists.push(listId);
        }

        // Update subscriber
        await updateSubscriber(email, { lists: lists.join(',') }, subscribersSheetName);

        // Sync list subscriber count
        await syncListSubscriberCount(listId, subscribersSheetName, groupListSheetName);

        return `Subscriber added to list.`;
    } catch (error) {
        console.error("Error adding subscriber to list:", error);
        throw error;
    }
};

/**
 * Remove a subscriber from a list
 */
export const removeSubscriberFromList = async (email: string, listId: string, subscribersSheetName: string, groupListSheetName: string): Promise<string> => {
    try {
        const subscriber = await getSubscriberByEmail(email, subscribersSheetName);
        if (!subscriber) {
            throw new Error(`Subscriber ${email} not found.`);
        }

        // Remove list ID
        const lists = subscriber.lists
            .split(',')
            .map(l => l.trim())
            .filter(l => l !== listId)
            .join(',');

        // Update subscriber
        await updateSubscriber(email, { lists }, subscribersSheetName);

        // Sync list subscriber count
        await syncListSubscriberCount(listId, subscribersSheetName, groupListSheetName);

        return `Subscriber removed from list.`;
    } catch (error) {
        console.error("Error removing subscriber from list:", error);
        throw error;
    }
};

/**
 * Sync list subscriber count by counting active subscribers in that list
 */
export const syncListSubscriberCount = async (listId: string, subscribersSheetName: string, groupListSheetName: string): Promise<void> => {
    try {
        const subscribers = await readAllSubscribers(subscribersSheetName);
        const count = subscribers.filter(
            s => s.status === 'active' && s.lists.split(',').map(l => l.trim()).includes(listId)
        ).length;

        await updateList(listId, { subscriberCount: count }, groupListSheetName);
    } catch (error) {
        console.error("Error syncing list subscriber count:", error);
        throw error;
    }
};

/**
 * Get subscribers by list ID
 */
export const getSubscribersByList = async (listId: string, subscribersSheetName: string): Promise<Subscriber[]> => {
    try {
        const subscribers = await readAllSubscribers(subscribersSheetName);
        return subscribers.filter(
            s => s.status === 'active' && s.lists.split(',').map(l => l.trim()).includes(listId)
        );
    } catch (error) {
        console.error("Error getting subscribers by list:", error);
        throw error;
    }
};

// ===================================================================
// PRESET MANAGEMENT FUNCTIONS
// ===================================================================

/**
 * Find or create the Presets sheet
 */
const findOrCreatePresetsSheet = async (sheetName: string = 'Newsletter Presets'): Promise<string> => {
    if (!currentAccessToken) {
        throw new Error("No access token available. Please sign in first.");
    }

    try {
        const query = `mimeType='application/vnd.google-apps.spreadsheet' and name='${sheetName}' and trashed=false`;
        const encodedQuery = encodeURIComponent(query);

        // List existing sheets
        const listResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&fields=files(id,name)`,
            {
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            }
        );

        if (!listResponse.ok) {
            throw new Error(`Failed to list Sheets: ${listResponse.statusText}`);
        }

        const listResult = await listResponse.json();

        if (listResult.files && listResult.files.length > 0) {
            return listResult.files[0].id;
        }

        // Create new spreadsheet if not found
        const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                properties: { title: sheetName }
            })
        });

        if (!createResponse.ok) {
            throw new Error(`Failed to create Sheet: ${createResponse.statusText}`);
        }

        const spreadsheet = await createResponse.json();
        const sheetId = spreadsheet.spreadsheetId;

        // Add headers to the new sheet
        const headers = ['Preset Name', 'Audience', 'Tone', 'Flavors', 'Topics', 'Image Style', 'Created Date'];
        const updateResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1?valueInputOption=RAW`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values: [headers]
                })
            }
        );

        if (!updateResponse.ok) {
            throw new Error(`Failed to add headers to Sheet: ${updateResponse.statusText}`);
        }

        return sheetId;
    } catch (error) {
        console.error("Error finding or creating presets sheet:", error);
        throw error;
    }
};

/**
 * Save presets to Google Sheets
 */
export const savePresetsToSheet = async (presets: any[], sheetName: string = 'Newsletter Presets'): Promise<string> => {
    if (!IS_GAPI_CONFIGURED) throw new Error("Google Workspace integration is not configured.");
    if (!currentAccessToken) throw new Error("Not signed in to Google. Please sign in first.");

    try {
        const sheetId = await findOrCreatePresetsSheet(sheetName);

        // Convert presets to rows
        const rows = presets.map(preset => [
            preset.name,
            JSON.stringify(preset.settings.selectedAudience),
            preset.settings.selectedTone,
            JSON.stringify(preset.settings.selectedFlavors),
            JSON.stringify(preset.settings.selectedTopics || []),
            preset.settings.selectedImageStyle,
            new Date().toISOString()
        ]);

        // Clear existing data (keep header)
        const clearResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: 0,
                                dimension: 'ROWS',
                                startIndex: 1
                            }
                        }
                    }]
                })
            }
        );

        if (!clearResponse.ok) {
            console.warn("Could not clear existing rows, will append instead");
        }

        // Append new rows
        const appendResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A2:G:append?valueInputOption=USER_ENTERED`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values: rows })
            }
        );

        if (!appendResponse.ok) {
            throw new Error(`Failed to save presets: ${appendResponse.statusText}`);
        }

        return `${presets.length} preset(s) saved to Google Sheets.`;
    } catch (error) {
        console.error("Error saving presets to Sheet:", error);
        throw error;
    }
};

/**
 * Load presets from Google Sheets
 */
export const loadPresetsFromSheet = async (sheetName: string = 'Newsletter Presets'): Promise<any[]> => {
    if (!IS_GAPI_CONFIGURED) throw new Error("Google Workspace integration is not configured.");
    if (!currentAccessToken) throw new Error("Not signed in to Google. Please sign in first.");

    try {
        const sheetId = await findOrCreatePresetsSheet(sheetName);

        // Read all preset rows
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A2:G`,
            {
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to read presets: ${response.statusText}`);
        }

        const data = await response.json();
        const rows = data.values || [];

        // Convert rows back to presets
        const presets = rows
            .filter((row: any[]) => row[0]) // Has preset name
            .map((row: any[]) => ({
                name: row[0],
                settings: {
                    selectedAudience: row[1] ? JSON.parse(row[1]) : {},
                    selectedTone: row[2] || 'professional',
                    selectedFlavors: row[3] ? JSON.parse(row[3]) : {},
                    selectedTopics: row[4] ? JSON.parse(row[4]) : [],
                    selectedImageStyle: row[5] || 'photorealistic'
                }
            }));

        return presets;
    } catch (error) {
        console.error("Error loading presets from Sheet:", error);
        throw error;
    }
};

// ===================================================================
// MIGRATION LOGIC
// ===================================================================

/**
 * Migrate existing single-column subscriber sheet to new 7-column structure
 * This function checks if the sheet has old structure (only "Email" column)
 * and upgrades it to the new structure (Email, Name, Status, Lists, Date Added, Date Removed, Source)
 */
export const migrateSubscriberSheet = async (subscribersSheetName: string): Promise<{ migrated: boolean; message: string }> => {
    if (!IS_GAPI_CONFIGURED) throw new Error("Google Workspace integration is not configured.");
    if (!currentAccessToken) throw new Error("Not signed in to Google. Please sign in first.");

    try {
        const sheetId = await findOrCreateSheet(subscribersSheetName, ['Email', 'Name', 'Status', 'Lists', 'Date Added', 'Date Removed', 'Source']);

        // Read sheet to check structure
        const headersResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A1:G1`,
            {
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            }
        );

        if (!headersResponse.ok) {
            console.log("Could not check headers, assuming new structure");
            return { migrated: false, message: "Sheet structure verified." };
        }

        const headerData = await headersResponse.json();
        const headers = headerData.values?.[0] || [];

        // Check if sheet already has new structure
        const hasNewStructure = headers.length >= 7 && headers[0] === 'Email' && headers[3] === 'Lists';

        if (hasNewStructure) {
            console.log("Subscriber sheet already has new structure. No migration needed.");
            return { migrated: false, message: "Sheet already has new structure." };
        }

        // Check if old structure (only "Email" column)
        const needsMigration = headers.length === 1 && headers[0] === 'Email';

        if (!needsMigration) {
            console.log("Sheet structure is unknown. Ensuring new headers...");
            // Just ensure the headers are set correctly
            const headerUpdateResponse = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A1:G1?valueInputOption=USER_ENTERED`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${currentAccessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        values: [['Email', 'Name', 'Status', 'Lists', 'Date Added', 'Date Removed', 'Source']]
                    })
                }
            );
            if (!headerUpdateResponse.ok) {
                console.warn("Could not update headers, proceeding anyway");
            }
            return { migrated: false, message: "Sheet structure is up to date." };
        }

        console.log("Old subscriber sheet structure detected (Email only). Starting migration...");

        // Read all existing subscribers
        const dataResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A2:A`,
            {
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            }
        );

        if (!dataResponse.ok) {
            console.warn("Could not read existing data, starting fresh");
            return { migrated: false, message: "No existing data to migrate." };
        }

        const data = await dataResponse.json();
        const emails = data.values?.map((row: any[]) => row[0]).filter((email: string) => email && email.includes('@')) || [];

        // Delete all data rows, keeping only header
        if (emails.length > 0) {
            try {
                const batchDeleteResponse = await fetch(
                    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${currentAccessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            requests: [{
                                deleteDimension: {
                                    range: {
                                        sheetId: 0,
                                        dimension: 'ROWS',
                                        startIndex: 1,
                                        endIndex: emails.length + 1
                                    }
                                }
                            }]
                        })
                    }
                );

                if (!batchDeleteResponse.ok) {
                    console.warn("Could not delete old rows, data may be duplicated");
                }
            } catch (err) {
                console.warn("Error deleting old rows:", err);
            }
        }

        // Set new headers
        const newHeaders = ['Email', 'Name', 'Status', 'Lists', 'Date Added', 'Date Removed', 'Source'];
        const headerResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A1:G1?valueInputOption=USER_ENTERED`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values: [newHeaders] })
            }
        );

        if (!headerResponse.ok) {
            throw new Error(`Failed to update headers: ${headerResponse.statusText}`);
        }

        // Add all existing emails with new structure
        const now = new Date().toISOString();
        const migratedRows = emails.map((email: string) => [
            email,        // Email
            '',           // Name
            'active',     // Status
            '',           // Lists
            now,          // Date Added
            '',           // Date Removed
            'migrated'    // Source
        ]);

        if (migratedRows.length > 0) {
            const appendResponse = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A2:G:append?valueInputOption=USER_ENTERED`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${currentAccessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ values: migratedRows })
                }
            );

            if (!appendResponse.ok) {
                console.warn(`Could not append migrated data, but headers were updated`);
            }
        }

        const message = `Migration completed! Updated sheet structure with ${emails.length} existing subscriber(s).`;
        console.log(message);
        return { migrated: true, message };
    } catch (error) {
        console.error("Error migrating subscriber sheet:", error);
        // Don't throw - continue anyway with new structure
        return { migrated: false, message: "Migration check completed." };
    }
};

export const readHistoryFromSheet = async (sheetName: string, driveFolderName?: string): Promise<any[]> => {
    if (!IS_GAPI_CONFIGURED) throw new Error("Google Workspace integration is not configured.");
    if (!currentAccessToken) throw new Error("Not signed in to Google. Please sign in first.");

    try {
        // Find the sheet by name
        const query = `mimeType='application/vnd.google-apps.spreadsheet' and name='${sheetName}' and trashed=false`;
        const encodedQuery = encodeURIComponent(query);

        const listResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&fields=files(id,name)`,
            {
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            }
        );

        if (!listResponse.ok) {
            throw new Error(`Failed to find sheet: ${listResponse.statusText}`);
        }

        const listResult = await listResponse.json();

        if (!listResult.files || listResult.files.length === 0) {
            // Sheet doesn't exist yet, return empty array
            console.log(`Newsletter Log Sheet "${sheetName}" not found. Returning empty history.`);
            return [];
        }

        const sheetId = listResult.files[0].id;

        // Read all rows from the sheet
        const readResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A:I`,
            {
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            }
        );

        if (!readResponse.ok) {
            throw new Error(`Failed to read sheet data: ${readResponse.statusText}`);
        }

        const sheetData = await readResponse.json();
        const allRows = sheetData.values || [];

        // Skip header row (row 0) and parse data rows into HistoryItem format
        const historyItems: any[] = [];

        for (let i = 1; i < allRows.length; i++) {
            const row = allRows[i];

            // Row structure: [ID, Date, Subject, Topics, Saved to Drive, Sent Email, Introduction, Conclusion, Sent To Lists]
            if (!row[0] || !row[2]) continue; // Skip rows without ID or Subject

            const id = row[0];
            const date = row[1] ? new Date(row[1]).toLocaleString() : new Date().toLocaleString();
            const subject = row[2];
            const topicsStr = row[3] || '';
            const savedToDriveValue = row[4];
            const savedToDrive = row[4] === 'Yes';
            const introduction = row[6] || '';
            const conclusion = row[7] || '';

            console.log(`History row: subject="${subject}", savedToDrive="${savedToDriveValue}" (boolean: ${savedToDrive}), driveFolderName="${driveFolderName}"`);

            // Parse topics from comma-separated string
            const topics = topicsStr
                .split(', ')
                .filter((topic: string) => topic.trim().length > 0)
                .map((topic: string) => topic.trim());

            let newsletter: any = {
                id: id,
                subject: subject,
                introduction: introduction,
                sections: [], // Default to empty sections
                conclusion: conclusion
            };

            // If newsletter was saved to Drive and folder name is provided, try to load full version
            if (savedToDrive && driveFolderName) {
                console.log(`✓ Conditions met for Drive loading: savedToDrive=${savedToDrive}, driveFolderName="${driveFolderName}"`);
                try {
                    console.log(`Attempting to load newsletter "${subject}" from Drive folder "${driveFolderName}"...`);
                    const driveData = await findAndLoadNewsletterFromDrive(driveFolderName, subject);
                    if (driveData) {
                        console.log(`✓✓✓ Successfully loaded full newsletter "${subject}" from Drive`);
                        newsletter = driveData.newsletter;
                    } else {
                        console.warn(`✗✗✗ Could not find/load newsletter "${subject}" from Drive - using sheet data`);
                    }
                } catch (driveError) {
                    console.warn(`✗✗✗ Error loading full newsletter "${subject}" from Drive, using sheet data:`, driveError);
                    // Fall back to sheet data
                }
            } else {
                console.log(`⊘ Skipping Drive load for "${subject}": savedToDrive=${savedToDrive}, hasFolderName=${!!driveFolderName}`);
            }

            // Create a HistoryItem with Newsletter object
            const historyItem: any = {
                id: parseInt(id, 10) || Date.now(),
                date: date,
                subject: subject,
                topics: topics,
                newsletter: newsletter
            };

            historyItems.push(historyItem);
        }

        // Return items sorted by most recent first
        return historyItems.reverse();
    } catch (error) {
        console.error("Error reading history from Sheet:", error);
        throw error;
    }
};

// Helper function to find a newsletter file by name in a folder and load it
const findAndLoadNewsletterFromDrive = async (folderName: string, filename: string): Promise<{ newsletter: Newsletter; topics: string[] } | null> => {
    try {
        // Get the folder ID
        console.log(`Finding folder "${folderName}"...`);
        const folderId = await findOrCreateFolder(folderName);
        console.log(`Found folder ID: ${folderId}`);

        // Search for the file by name
        const searchFilename = `${filename}.html`;
        console.log(`Searching for file: "${searchFilename}"`);
        // Escape single quotes in filename for the query
        const escapedFilename = filename.replace(/'/g, "\\'");
        const query = `'${folderId}' in parents and name='${escapedFilename}.html' and mimeType='text/html' and trashed=false`;
        console.log(`Drive API query: ${query}`);

        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            }
        );

        if (!response.ok) {
            console.warn(`Failed to search for file "${searchFilename}": ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        console.log(`Search result:`, data);

        if (!data.files || data.files.length === 0) {
            console.warn(`File "${searchFilename}" not found in Drive folder "${folderName}"`);
            return null;
        }

        const fileId = data.files[0].id;
        console.log(`Found file with ID: ${fileId}. Loading content...`);

        // Load the full newsletter from the file
        const result = await loadNewsletterFromDrive(fileId);
        console.log(`Successfully loaded newsletter from Drive`);
        return result;
    } catch (error) {
        console.warn(`Error finding and loading newsletter from Drive:`, error);
        return null;
    }
};