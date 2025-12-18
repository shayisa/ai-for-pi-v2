import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Control Plane imports - all 98 endpoints served via modular routes
import apiRoutes from './server/routes/index.ts';
import { contextMiddleware } from './server/control-plane/invocation/contextManager.ts';
import * as logCleanupService from './server/services/logCleanupService.ts';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(contextMiddleware()); // Control Plane context (correlation IDs)

// Mount Control Plane routes (all endpoints migrated to modular architecture)
// See server/routes/index.ts for route aggregation:
//   - generation.routes.ts (11 endpoints) - Claude AI newsletter generation
//   - newsletter.routes.ts (8 endpoints) - Newsletter CRUD
//   - archive.routes.ts (5 endpoints) - Content archiving
//   - subscriber.routes.ts (14 endpoints) - Subscriber/list management
//   - calendar.routes.ts (9 endpoints) - Content calendar
//   - persona.routes.ts (9 endpoints) - Writer personas
//   - template.routes.ts (7 endpoints) - Newsletter templates
//   - draft.routes.ts (4 endpoints) - Auto-save drafts
//   - prompt.routes.ts (4 endpoints) - Saved prompts library
//   - thumbnail.routes.ts (4 endpoints) - Style thumbnails
//   - apiKey.routes.ts (5 endpoints) - API key management
//   - log.routes.ts (3 endpoints) - System logs
//   - oauth.routes.ts (4 endpoints) - Google OAuth
//   - drive.routes.ts (4 endpoints) - Google Drive
//   - gmail.routes.ts (3 endpoints) - Gmail sending
//   - health.routes.ts (1 endpoint) - Health check
app.use('/api', apiRoutes);

// ===================================================================
// PRESET MANAGEMENT ENDPOINTS (not yet migrated to modular routes)
// ===================================================================

// Save presets to Google Sheets
app.post("/api/savePresets", async (req, res) => {
  try {
    const { presets, accessToken } = req.body;

    if (!presets || !Array.isArray(presets)) {
      return res.status(400).json({ error: "Invalid presets data" });
    }

    if (!accessToken) {
      return res.status(401).json({ error: "Access token required" });
    }

    const sheetName = "Newsletter Presets";
    const query = `mimeType='application/vnd.google-apps.spreadsheet' and name='${sheetName}' and trashed=false`;
    const encodedQuery = encodeURIComponent(query);

    // Check if presets sheet exists
    const listResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&fields=files(id,name)`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!listResponse.ok) {
      return res.status(listResponse.status).json({ error: "Failed to access Google Sheets" });
    }

    const listResult = await listResponse.json();
    let sheetId = listResult.files?.[0]?.id;

    // Create sheet if it doesn't exist
    if (!sheetId) {
      const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: { title: sheetName }
        })
      });

      if (!createResponse.ok) {
        return res.status(createResponse.status).json({ error: "Failed to create presets sheet" });
      }

      const spreadsheet = await createResponse.json();
      sheetId = spreadsheet.spreadsheetId;

      // Add headers
      const headers = ['Preset Name', 'Audience', 'Tone', 'Flavors', 'Topics', 'Image Style', 'Created Date'];
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ values: [headers] })
        }
      );
    }

    // Convert presets to rows
    const rows = presets.map((preset: any) => [
      preset.name,
      JSON.stringify(preset.settings.selectedAudience),
      preset.settings.selectedTone,
      JSON.stringify(preset.settings.selectedFlavors),
      JSON.stringify(preset.settings.selectedTopics || []),
      preset.settings.selectedImageStyle,
      new Date().toISOString()
    ]);

    // Clear existing data
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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
    ).catch(() => {
      // Ignore errors on clear, will append instead
    });

    // Append rows
    const appendResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A2:G:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: rows })
      }
    );

    if (!appendResponse.ok) {
      return res.status(appendResponse.status).json({ error: "Failed to save presets" });
    }

    res.json({ message: `${presets.length} preset(s) saved to Google Sheets` });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error saving presets:", errorMessage);
    res.status(500).json({ error: "Failed to save presets", details: errorMessage });
  }
});

// Load presets from Google Sheets
app.get("/api/loadPresets", async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');

    if (!accessToken) {
      return res.status(401).json({ error: "Access token required" });
    }

    const sheetName = "Newsletter Presets";
    const query = `mimeType='application/vnd.google-apps.spreadsheet' and name='${sheetName}' and trashed=false`;
    const encodedQuery = encodeURIComponent(query);

    // Find presets sheet
    const listResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&fields=files(id,name)`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!listResponse.ok) {
      return res.status(listResponse.status).json({ error: "Failed to access Google Sheets" });
    }

    const listResult = await listResponse.json();
    const sheetId = listResult.files?.[0]?.id;

    // If sheet doesn't exist, return empty presets
    if (!sheetId) {
      return res.json({ presets: [] });
    }

    // Read preset rows
    const readResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A2:G`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!readResponse.ok) {
      return res.status(readResponse.status).json({ error: "Failed to read presets" });
    }

    const data = await readResponse.json();
    const rows = data.values || [];

    // Convert rows back to presets
    const presets = rows
      .filter((row: any[]) => row[0])
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

    res.json({ presets });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error loading presets:", errorMessage);
    res.status(500).json({ error: "Failed to load presets", details: errorMessage });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);

  // Initialize log cleanup service (runs cleanup on startup and every 6 hours)
  logCleanupService.initialize();
});
