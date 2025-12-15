/**
 * POC 4: Gemini File Search (RAG)
 *
 * Tests the Gemini File Search API for RAG:
 * - Create a FileSearchStore (corpus)
 * - Upload/index sample documents
 * - Query with semantic search
 * - Measure retrieval quality
 *
 * Run: npx ts-node poc/4-gemini-file-search.ts
 */

import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

/**
 * Get Google API key from SQLite or environment variable
 */
function getGoogleApiKey(): string | null {
  const adminEmail = process.env.ADMIN_EMAIL;

  // Try SQLite first
  if (adminEmail) {
    try {
      const dbPath = path.join(__dirname, '..', 'data', 'archives.db');
      if (fs.existsSync(dbPath)) {
        const db = new Database(dbPath, { readonly: true });
        const stmt = db.prepare('SELECT api_key FROM api_keys WHERE user_email = ? AND service = ?');
        const row = stmt.get(adminEmail, 'google_api_key') as { api_key: string } | undefined;
        db.close();
        if (row?.api_key) {
          console.log(`[Config] Loaded Google API key from SQLite for ${adminEmail}`);
          return row.api_key;
        }
      }
    } catch (e) {
      console.log('[Config] Could not load from SQLite:', e);
    }
  }

  // Fall back to environment variable
  const envKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (envKey) {
    console.log('[Config] Loaded Google API key from environment variable');
    return envKey;
  }

  return null;
}

// Types
interface IndexingResult {
  store_created: boolean;
  store_name: string;
  documents_indexed: number;
  indexing_time_ms: number;
  error?: string;
}

interface QueryResult {
  query: string;
  response: string;
  retrieved_chunks: number;
  has_grounding: boolean;
  sources: string[];
  query_time_ms: number;
  error?: string;
}

// Sample documents to index (simulating extracted article content)
const sampleDocuments = [
  {
    name: 'ai-forensics-research.txt',
    content: `
Title: AI Applications in Forensic Anthropology

Recent advances in artificial intelligence are transforming forensic anthropology. Machine learning models
can now analyze skeletal remains with unprecedented accuracy, identifying age, sex, and ancestry patterns
that would take human experts hours to determine.

Key developments include:
1. 3D Scanning and Reconstruction: AI-powered photogrammetry creates detailed 3D models of bone structures
2. Trauma Pattern Recognition: Deep learning identifies fracture patterns and their likely causes
3. Age Estimation: Neural networks predict age at death from bone density and morphology
4. Automated Measurement: Computer vision extracts precise measurements for forensic databases

Dr. Sarah Chen at Stanford reports 94% accuracy in sex determination using their new CNN model trained
on CT scans of 15,000 skeletal samples. The model outperformed human experts by 12%.

Tools like ForensicAI and BoneAnalyzer are making these capabilities accessible to smaller forensic labs.
    `,
  },
  {
    name: 'workflow-automation-tools.txt',
    content: `
Title: Top Workflow Automation Tools for 2025

Business process automation has evolved dramatically with AI integration. Here are the leading tools:

1. **Zapier AI**: Now includes AI-powered workflow suggestions and natural language automation setup
   - Connects 6,000+ apps
   - AI analyzes your workflows and suggests optimizations
   - $19/month starter plan

2. **Make (formerly Integromat)**: Visual workflow builder with AI modules
   - Drag-and-drop interface
   - Built-in AI blocks for text analysis, summarization
   - Free tier with 1,000 operations/month

3. **n8n**: Open-source automation with AI nodes
   - Self-hosted option for data privacy
   - LangChain integration for custom AI agents
   - Active community with 400+ integrations

4. **Microsoft Power Automate**: Enterprise-grade with Copilot integration
   - Natural language flow creation
   - Deep Microsoft 365 integration
   - Included in many M365 plans

Best Practice: Start with simple automations (email routing, data sync) before adding AI complexity.
    `,
  },
  {
    name: 'supply-chain-ai.txt',
    content: `
Title: AI-Powered Supply Chain Optimization

Supply chain professionals are leveraging AI for demand forecasting and inventory optimization.

Key AI Applications:

**Demand Forecasting**
- Time series models (Prophet, NeuralProphet) predict seasonal patterns
- Machine learning incorporates external signals (weather, events, social media)
- Average improvement: 30-40% reduction in forecast error

**Inventory Optimization**
- Reinforcement learning for dynamic reorder points
- Multi-echelon optimization across warehouse networks
- Safety stock calculations using demand uncertainty models

**Real-time Visibility**
- IoT sensors + AI for shipment tracking predictions
- Anomaly detection for supply chain disruptions
- Automated alerts when KPIs deviate

Case Study: Walmart reduced inventory costs by $2B using AI-driven demand sensing that processes
100 million data points daily. Their system predicts store-level demand 3 weeks out with 95% accuracy.

Tools: Blue Yonder, Llamasoft (Coupa), SAP IBP, and open-source options like Nixtla for time series.
    `,
  },
];

// Test queries
const testQueries = [
  'What AI tools help with skeletal analysis in forensics?',
  'Which workflow automation tools have AI capabilities?',
  'How is AI improving supply chain demand forecasting?',
  'What accuracy rates have been achieved in forensic AI?',
];

async function main() {
  console.log('=== POC 4: Gemini File Search (RAG) ===\n');

  // Check for API key
  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    console.error('ERROR: Google API key not found.');
    console.error('Please either:');
    console.error('  1. Add it via the app Settings UI (stored in SQLite)');
    console.error('  2. Set GOOGLE_API_KEY in .env.local');
    console.error('Get a key from: https://aistudio.google.com/app/apikey');

    // Write error output
    const outputPath = path.join(__dirname, 'output', '4-rag-results.json');
    fs.writeFileSync(
      outputPath,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        error: 'API key not configured',
        setup: { store_created: false, store_name: '', documents_indexed: 0 },
        queries: [],
      }, null, 2)
    );
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });

  // Check if fileSearchStores API is available
  console.log('Checking Gemini File Search API availability...\n');

  let indexingResult: IndexingResult;
  let queryResults: QueryResult[] = [];

  try {
    // Step 1: Create a FileSearchStore
    console.log('Step 1: Creating FileSearchStore...');
    const startIndexTime = Date.now();

    const fileSearchStore = await ai.fileSearchStores.create({
      config: { displayName: `poc-test-store-${Date.now()}` },
    });

    console.log(`  Store created: ${fileSearchStore.name}`);

    // Step 2: Upload documents to the store
    console.log('\nStep 2: Uploading documents...');
    let docsIndexed = 0;

    for (const doc of sampleDocuments) {
      try {
        console.log(`  Uploading: ${doc.name}`);

        // Create a temporary file
        const tempPath = path.join(__dirname, 'output', doc.name);
        fs.writeFileSync(tempPath, doc.content);

        // Upload to the store
        const uploadResult = await ai.fileSearchStores.uploadToFileSearchStore({
          fileSearchStoreName: fileSearchStore.name,
          file: tempPath,
          config: { displayName: doc.name },
        });

        console.log(`    Status: Uploaded`);
        docsIndexed++;

        // Clean up temp file
        fs.unlinkSync(tempPath);
      } catch (uploadError) {
        console.error(`    Error uploading ${doc.name}:`, uploadError);
      }
    }

    const indexingTime = Date.now() - startIndexTime;

    indexingResult = {
      store_created: true,
      store_name: fileSearchStore.name,
      documents_indexed: docsIndexed,
      indexing_time_ms: indexingTime,
    };

    console.log(`\n  Indexed ${docsIndexed}/${sampleDocuments.length} documents in ${indexingTime}ms`);

    // Step 3: Wait for indexing to complete
    console.log('\nStep 3: Waiting for indexing to complete (10s)...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Step 4: Query the store
    console.log('\nStep 4: Running test queries...\n');

    for (const query of testQueries) {
      console.log(`Query: "${query}"`);
      const queryStart = Date.now();

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: query,
          config: {
            tools: [
              {
                fileSearch: {
                  fileSearchStoreNames: [fileSearchStore.name],
                },
              },
            ],
          },
        });

        const queryTime = Date.now() - queryStart;
        const responseText = response.text || '';

        // Check for grounding metadata
        const groundingMetadata = (response as any).groundingMetadata;
        const sources = groundingMetadata?.groundingChunks?.map(
          (chunk: any) => chunk.retrievedContext?.uri || 'unknown'
        ) || [];

        queryResults.push({
          query,
          response: responseText.substring(0, 500),
          retrieved_chunks: sources.length,
          has_grounding: sources.length > 0,
          sources,
          query_time_ms: queryTime,
        });

        console.log(`  Response: ${responseText.substring(0, 100)}...`);
        console.log(`  Grounded: ${sources.length > 0 ? 'Yes' : 'No'}, Time: ${queryTime}ms\n`);
      } catch (queryError) {
        const queryTime = Date.now() - queryStart;
        queryResults.push({
          query,
          response: '',
          retrieved_chunks: 0,
          has_grounding: false,
          sources: [],
          query_time_ms: queryTime,
          error: queryError instanceof Error ? queryError.message : String(queryError),
        });
        console.error(`  Error: ${queryError}\n`);
      }
    }

    // Step 5: Cleanup - delete the store
    console.log('Step 5: Cleaning up (deleting test store)...');
    try {
      await ai.fileSearchStores.delete({ name: fileSearchStore.name });
      console.log('  Store deleted successfully\n');
    } catch (deleteError) {
      console.log('  Could not delete store (may require manual cleanup)\n');
    }
  } catch (error) {
    console.error('File Search API error:', error);
    indexingResult = {
      store_created: false,
      store_name: '',
      documents_indexed: 0,
      indexing_time_ms: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Summary
  console.log('=== SUMMARY ===');
  console.log(`Store created: ${indexingResult.store_created}`);
  console.log(`Documents indexed: ${indexingResult.documents_indexed}`);
  console.log(`Queries run: ${queryResults.length}`);
  console.log(`Queries with grounding: ${queryResults.filter(q => q.has_grounding).length}`);

  const avgQueryTime = queryResults.length > 0
    ? queryResults.reduce((sum, q) => sum + q.query_time_ms, 0) / queryResults.length
    : 0;
  console.log(`Avg query time: ${Math.round(avgQueryTime)}ms`);

  // Write output
  const output = {
    timestamp: new Date().toISOString(),
    setup: indexingResult,
    queries: queryResults,
    summary: {
      store_created: indexingResult.store_created,
      documents_indexed: indexingResult.documents_indexed,
      queries_total: queryResults.length,
      queries_grounded: queryResults.filter(q => q.has_grounding).length,
      queries_failed: queryResults.filter(q => q.error).length,
      avg_query_time_ms: Math.round(avgQueryTime),
    },
  };

  const outputPath = path.join(__dirname, 'output', '4-rag-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nOutput written to: ${outputPath}`);
}

main().catch(console.error);
