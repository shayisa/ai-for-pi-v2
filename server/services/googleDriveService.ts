/**
 * Google Drive Service
 * Backend service for Drive API operations
 */

import { getValidAccessToken } from './googleOAuthService.ts';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';

// App folder name in Google Drive
const APP_FOLDER_NAME = 'AI Newsletter Generator';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
}

interface DriveListResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

/**
 * Get or create the app folder in Drive
 */
const getOrCreateAppFolder = async (accessToken: string): Promise<string | null> => {
  try {
    // Search for existing folder
    const searchParams = new URLSearchParams({
      q: `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    });

    const searchResponse = await fetch(`${DRIVE_API_URL}/files?${searchParams}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchResponse.ok) {
      console.error('[Drive] Failed to search for folder');
      return null;
    }

    const searchData: DriveListResponse = await searchResponse.json();

    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // Create folder if it doesn't exist
    const createResponse = await fetch(`${DRIVE_API_URL}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: APP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!createResponse.ok) {
      console.error('[Drive] Failed to create folder');
      return null;
    }

    const createData = await createResponse.json();
    console.log('[Drive] Created app folder:', createData.id);
    return createData.id;
  } catch (error) {
    console.error('[Drive] Error getting/creating folder:', error);
    return null;
  }
};

/**
 * Save newsletter to Google Drive
 */
export const saveNewsletter = async (
  userEmail: string,
  content: string,
  filename: string
): Promise<{ success: boolean; fileId?: string; webViewLink?: string; error?: string }> => {
  const accessToken = await getValidAccessToken(userEmail);

  if (!accessToken) {
    return { success: false, error: 'Not authenticated with Google' };
  }

  try {
    const folderId = await getOrCreateAppFolder(accessToken);
    if (!folderId) {
      return { success: false, error: 'Failed to create app folder' };
    }

    // Create file metadata
    const metadata = {
      name: filename.endsWith('.json') ? filename : `${filename}.json`,
      mimeType: 'application/json',
      parents: [folderId],
    };

    // Create multipart request
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const body =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      content +
      closeDelimiter;

    const response = await fetch(`${DRIVE_UPLOAD_URL}/files?uploadType=multipart&fields=id,webViewLink`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Drive] Failed to save file:', error);
      return { success: false, error: 'Failed to save to Drive' };
    }

    const data = await response.json();
    console.log('[Drive] Newsletter saved:', data.id);

    return {
      success: true,
      fileId: data.id,
      webViewLink: data.webViewLink,
    };
  } catch (error) {
    console.error('[Drive] Save error:', error);
    return { success: false, error: 'Failed to save to Drive' };
  }
};

/**
 * Load newsletter from Google Drive
 */
export const loadNewsletter = async (
  userEmail: string,
  fileId: string
): Promise<{ success: boolean; content?: string; error?: string }> => {
  const accessToken = await getValidAccessToken(userEmail);

  if (!accessToken) {
    return { success: false, error: 'Not authenticated with Google' };
  }

  try {
    const response = await fetch(`${DRIVE_API_URL}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.error('[Drive] Failed to load file');
      return { success: false, error: 'Failed to load from Drive' };
    }

    const content = await response.text();
    console.log('[Drive] Newsletter loaded:', fileId);

    return { success: true, content };
  } catch (error) {
    console.error('[Drive] Load error:', error);
    return { success: false, error: 'Failed to load from Drive' };
  }
};

/**
 * List newsletters from Google Drive
 */
export const listNewsletters = async (
  userEmail: string,
  pageSize: number = 20,
  pageToken?: string
): Promise<{
  success: boolean;
  files?: Array<{
    id: string;
    name: string;
    createdTime: string;
    modifiedTime: string;
  }>;
  nextPageToken?: string;
  error?: string;
}> => {
  const accessToken = await getValidAccessToken(userEmail);

  if (!accessToken) {
    return { success: false, error: 'Not authenticated with Google' };
  }

  try {
    // Get app folder ID first
    const folderId = await getOrCreateAppFolder(accessToken);
    if (!folderId) {
      return { success: false, error: 'Failed to access app folder' };
    }

    const params = new URLSearchParams({
      q: `'${folderId}' in parents and mimeType='application/json' and trashed=false`,
      fields: 'files(id, name, createdTime, modifiedTime), nextPageToken',
      orderBy: 'modifiedTime desc',
      pageSize: pageSize.toString(),
    });

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const response = await fetch(`${DRIVE_API_URL}/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.error('[Drive] Failed to list files');
      return { success: false, error: 'Failed to list newsletters' };
    }

    const data: DriveListResponse = await response.json();
    console.log('[Drive] Listed', data.files?.length || 0, 'newsletters');

    return {
      success: true,
      files: data.files?.map(f => ({
        id: f.id,
        name: f.name,
        createdTime: f.createdTime,
        modifiedTime: f.modifiedTime,
      })),
      nextPageToken: data.nextPageToken,
    };
  } catch (error) {
    console.error('[Drive] List error:', error);
    return { success: false, error: 'Failed to list newsletters' };
  }
};

/**
 * Delete newsletter from Google Drive
 */
export const deleteNewsletter = async (
  userEmail: string,
  fileId: string
): Promise<{ success: boolean; error?: string }> => {
  const accessToken = await getValidAccessToken(userEmail);

  if (!accessToken) {
    return { success: false, error: 'Not authenticated with Google' };
  }

  try {
    const response = await fetch(`${DRIVE_API_URL}/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok && response.status !== 204) {
      console.error('[Drive] Failed to delete file');
      return { success: false, error: 'Failed to delete from Drive' };
    }

    console.log('[Drive] Newsletter deleted:', fileId);
    return { success: true };
  } catch (error) {
    console.error('[Drive] Delete error:', error);
    return { success: false, error: 'Failed to delete from Drive' };
  }
};
