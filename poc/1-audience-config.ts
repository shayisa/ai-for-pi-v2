/**
 * POC 1: Audience Config Generation
 *
 * Tests AI-generated audience configuration from name + description.
 * Uses Claude Haiku for fast, cheap generation.
 *
 * Run: npx ts-node poc/1-audience-config.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

/**
 * Get API key from SQLite or environment variable
 */
function getApiKey(): string | null {
  const adminEmail = process.env.ADMIN_EMAIL;

  // Try SQLite first
  if (adminEmail) {
    try {
      const dbPath = path.join(__dirname, '..', 'data', 'archives.db');
      if (fs.existsSync(dbPath)) {
        const db = new Database(dbPath, { readonly: true });
        const stmt = db.prepare('SELECT api_key FROM api_keys WHERE user_email = ? AND service = ?');
        const row = stmt.get(adminEmail, 'claude') as { api_key: string } | undefined;
        db.close();
        if (row?.api_key) {
          console.log(`[Config] Loaded Claude API key from SQLite for ${adminEmail}`);
          return row.api_key;
        }
      }
    } catch (e) {
      console.log('[Config] Could not load from SQLite:', e);
    }
  }

  // Fall back to environment variable
  const envKey = process.env.VITE_ANTHROPIC_API_KEY;
  if (envKey) {
    console.log('[Config] Loaded Claude API key from environment variable');
    return envKey;
  }

  return null;
}

// Types
interface AudienceInput {
  name: string;
  description: string;
}

interface AudienceConfig {
  persona: string;
  relevance_keywords: string[];
  subreddits: string[];
  arxiv_categories: string[];
  search_templates: string[];
}

interface POCResult {
  input: AudienceInput;
  generated_config: AudienceConfig | null;
  error?: string;
  metrics: {
    cost_usd: number;
    time_ms: number;
    input_tokens: number;
    output_tokens: number;
  };
}

// Test audiences
const testAudiences: AudienceInput[] = [
  {
    name: "Healthcare IT Professionals",
    description: "IT staff managing EHR systems, clinical software, and HIPAA compliance in healthcare settings"
  },
  {
    name: "Forensic Anthropologists",
    description: "Researchers analyzing skeletal remains using imaging technology, 3D reconstruction, and pattern recognition"
  },
  {
    name: "Supply Chain Analysts",
    description: "Professionals optimizing logistics, inventory management, and demand forecasting using data analytics"
  }
];

// Pricing for Claude Haiku 4.5 (per 1M tokens)
const HAIKU_INPUT_PRICE = 1.00;  // $1.00 per 1M input tokens
const HAIKU_OUTPUT_PRICE = 5.00; // $5.00 per 1M output tokens

function calculateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000 * HAIKU_INPUT_PRICE) +
         (outputTokens / 1_000_000 * HAIKU_OUTPUT_PRICE);
}

async function generateAudienceConfig(
  client: Anthropic,
  audience: AudienceInput
): Promise<POCResult> {
  const startTime = Date.now();

  const systemPrompt = `You are an expert at understanding professional audiences and their information needs.
Given an audience name and description, generate a comprehensive configuration for finding relevant AI/technology content.

IMPORTANT: Return ONLY valid JSON, no markdown code blocks, no explanation.`;

  const userPrompt = `Generate a content discovery configuration for this audience:

Name: ${audience.name}
Description: ${audience.description}

Return JSON with these exact fields:
{
  "persona": "3-4 sentence detailed persona expanding on the description, including their daily challenges and information needs",
  "relevance_keywords": ["15-20 domain-specific keywords for scoring content relevance"],
  "subreddits": ["5-10 relevant subreddit names without r/ prefix"],
  "arxiv_categories": ["relevant ArXiv category codes like cs.AI, stat.ML, q-bio.QM"],
  "search_templates": ["3-5 search query templates using {topic} placeholder"]
}`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    });

    const endTime = Date.now();
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;

    // Extract text content
    const textBlock = response.content.find(
      (block): block is Anthropic.Messages.TextBlock => block.type === "text"
    );

    if (!textBlock) {
      return {
        input: audience,
        generated_config: null,
        error: "No text response from API",
        metrics: {
          cost_usd: calculateCost(inputTokens, outputTokens),
          time_ms: endTime - startTime,
          input_tokens: inputTokens,
          output_tokens: outputTokens
        }
      };
    }

    // Parse JSON response
    let config: AudienceConfig;
    try {
      // Clean the response - remove any markdown code blocks if present
      let jsonText = textBlock.text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      }
      config = JSON.parse(jsonText);
    } catch (parseError) {
      return {
        input: audience,
        generated_config: null,
        error: `JSON parse error: ${parseError}. Raw response: ${textBlock.text.substring(0, 500)}`,
        metrics: {
          cost_usd: calculateCost(inputTokens, outputTokens),
          time_ms: endTime - startTime,
          input_tokens: inputTokens,
          output_tokens: outputTokens
        }
      };
    }

    return {
      input: audience,
      generated_config: config,
      metrics: {
        cost_usd: calculateCost(inputTokens, outputTokens),
        time_ms: endTime - startTime,
        input_tokens: inputTokens,
        output_tokens: outputTokens
      }
    };

  } catch (error) {
    const endTime = Date.now();
    return {
      input: audience,
      generated_config: null,
      error: error instanceof Error ? error.message : String(error),
      metrics: {
        cost_usd: 0,
        time_ms: endTime - startTime,
        input_tokens: 0,
        output_tokens: 0
      }
    };
  }
}

async function main() {
  console.log("=== POC 1: Audience Config Generation ===\n");

  // Check for API key
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("ERROR: Claude API key not found.");
    console.error("Please either:");
    console.error("  1. Add it via the app Settings UI (stored in SQLite)");
    console.error("  2. Set VITE_ANTHROPIC_API_KEY in .env.local");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const results: POCResult[] = [];
  let totalCost = 0;
  let totalTime = 0;

  for (const audience of testAudiences) {
    console.log(`\nGenerating config for: ${audience.name}`);
    console.log(`Description: ${audience.description}`);
    console.log("---");

    const result = await generateAudienceConfig(client, audience);
    results.push(result);
    totalCost += result.metrics.cost_usd;
    totalTime += result.metrics.time_ms;

    if (result.error) {
      console.log(`ERROR: ${result.error}`);
    } else if (result.generated_config) {
      console.log(`Persona: ${result.generated_config.persona.substring(0, 100)}...`);
      console.log(`Keywords: ${result.generated_config.relevance_keywords.length} keywords`);
      console.log(`Subreddits: ${result.generated_config.subreddits.join(', ')}`);
      console.log(`ArXiv: ${result.generated_config.arxiv_categories.join(', ')}`);
      console.log(`Search Templates: ${result.generated_config.search_templates.length} templates`);
    }
    console.log(`Cost: $${result.metrics.cost_usd.toFixed(4)} | Time: ${result.metrics.time_ms}ms`);
  }

  // Summary
  console.log("\n=== SUMMARY ===");
  console.log(`Total audiences processed: ${results.length}`);
  console.log(`Successful: ${results.filter(r => r.generated_config).length}`);
  console.log(`Failed: ${results.filter(r => r.error).length}`);
  console.log(`Total cost: $${totalCost.toFixed(4)}`);
  console.log(`Total time: ${totalTime}ms`);
  console.log(`Avg time per audience: ${Math.round(totalTime / results.length)}ms`);

  // Write output to file
  const output = {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      successful: results.filter(r => r.generated_config).length,
      failed: results.filter(r => r.error).length,
      total_cost_usd: totalCost,
      total_time_ms: totalTime,
      avg_time_ms: Math.round(totalTime / results.length)
    }
  };

  const outputPath = path.join(__dirname, 'output', '1-audience-config.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nOutput written to: ${outputPath}`);
}

main().catch(console.error);
