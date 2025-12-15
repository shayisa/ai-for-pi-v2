/**
 * POC 5: Newsletter Generation (New Enhanced Format)
 *
 * Tests the new newsletter schema with:
 * - Editor's Note
 * - Tool of the Day
 * - Audience-specific sections with "Why It Matters", practical prompts, CTAs
 * - Source citations
 *
 * Outputs:
 * - poc/output/5-newsletter.json (full JSON)
 * - poc/output/5-newsletter.md (human-readable markdown)
 *
 * Run: npx ts-node poc/5-newsletter-generation.ts
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

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

/**
 * Get API key from SQLite or environment variable
 */
function getApiKey(): string | null {
  const adminEmail = process.env.ADMIN_EMAIL;

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

  return process.env.VITE_ANTHROPIC_API_KEY || null;
}

// Enhanced Newsletter Schema
interface EnhancedNewsletter {
  editorsNote: {
    message: string;
  };
  toolOfTheDay: {
    name: string;
    url: string;
    whyNow: string;
    quickStart: string;
  };
  audienceSections: Array<{
    audienceId: string;
    audienceName: string;
    title: string;
    whyItMatters: string;
    content: string;
    practicalPrompt: {
      scenario: string;
      prompt: string;
      isToolSpecific: boolean;
    };
    cta: {
      text: string;
      action: string;
    };
    sources: Array<{ url: string; title: string }>;
  }>;
  conclusion: string;
}

// Sample audience configs (from POC 1)
const audiences = [
  {
    id: 'forensic',
    name: 'Forensic Anthropologists',
    persona: 'Researchers analyzing skeletal remains using imaging technology, 3D reconstruction, and pattern recognition',
    keywords: ['skeletal analysis', '3D reconstruction', 'forensic imaging', 'bone morphometry'],
  },
  {
    id: 'business',
    name: 'Business Administrators',
    persona: 'Office managers and administrators seeking AI tools to automate routine tasks and improve productivity',
    keywords: ['workflow automation', 'document processing', 'scheduling', 'productivity'],
  },
];

// Sample source content (from POC 2 & 3)
const sourceContent = `
SOURCE 1: ForensicAI Announces New Skeletal Analysis Module
URL: https://example.com/forensic-ai-update
ForensicAI released version 4.0 with enhanced 3D bone reconstruction capabilities.
The new module achieves 96% accuracy in age estimation and integrates with common
CT scanner formats. Pricing starts at $499/year for academic institutions.

SOURCE 2: Zapier Launches AI-Powered Workflow Builder
URL: https://zapier.com/ai-builder
Zapier's new AI assistant can analyze your existing workflows and suggest optimizations.
Users report 40% reduction in manual data entry tasks. The feature is available on all
paid plans at no additional cost.

SOURCE 3: Open-Source Alternative to Commercial Forensic Software
URL: https://github.com/forensic-ai/bone-analyzer
A new open-source tool called BoneAnalyzer provides trauma pattern recognition using
deep learning. Developed by Stanford researchers, it's free for academic use and
achieves comparable accuracy to commercial solutions.

SOURCE 4: Microsoft Copilot Coming to Business Apps
URL: https://www.microsoft.com/copilot-business
Microsoft announced Copilot integration across all Office 365 apps, enabling natural
language document editing, email drafting, and meeting summarization. Available to
enterprise customers Q1 2025.
`;

async function generateNewsletter(client: Anthropic): Promise<EnhancedNewsletter> {
  const systemPrompt = `You are an expert newsletter writer for "AI for PI" - a newsletter helping professionals leverage AI tools in their work.

Your task is to generate a newsletter in the ENHANCED FORMAT with:
1. Editor's Note - Personal, conversational opening that sets the tone
2. Tool of the Day - One standout tool featured prominently
3. Audience Sections - ONE section per audience with specific relevance
4. Practical Prompts - Ready-to-use prompts for each section
5. CTAs - Clear calls to action

RULES:
- Every factual claim MUST cite its source URL
- Each audience section MUST have a "Why It Matters" explanation
- Practical prompts should be immediately usable
- Keep the tone authoritative but accessible
- NO hallucinated tools or statistics - use only what's in the sources

Return ONLY valid JSON matching this schema:
{
  "editorsNote": { "message": "string" },
  "toolOfTheDay": { "name": "string", "url": "string", "whyNow": "string", "quickStart": "string" },
  "audienceSections": [{
    "audienceId": "string",
    "audienceName": "string",
    "title": "string",
    "whyItMatters": "string",
    "content": "string",
    "practicalPrompt": { "scenario": "string", "prompt": "string", "isToolSpecific": boolean },
    "cta": { "text": "string", "action": "copy_prompt|visit_url" },
    "sources": [{ "url": "string", "title": "string" }]
  }],
  "conclusion": "string"
}`;

  const userPrompt = `Generate an enhanced newsletter for these audiences:

AUDIENCES:
${audiences.map(a => `- ${a.name}: ${a.persona}`).join('\n')}

SOURCE CONTENT:
${sourceContent}

Generate the newsletter JSON now. Remember:
- ONE section per audience (${audiences.length} sections total)
- Cite sources with URLs
- Include practical, ready-to-use prompts
- Make "Why It Matters" specific to each audience`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.Messages.TextBlock => block.type === 'text'
  );

  if (!textBlock) {
    throw new Error('No text response from API');
  }

  // Parse JSON response
  let jsonText = textBlock.text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  }

  return JSON.parse(jsonText);
}

/**
 * Convert newsletter to markdown for easy reading
 */
function newsletterToMarkdown(newsletter: EnhancedNewsletter): string {
  let md = `# AI for PI Newsletter\n\n`;

  // Editor's Note
  md += `## 📝 Editor's Note\n\n`;
  md += `${newsletter.editorsNote.message}\n\n`;
  md += `---\n\n`;

  // Tool of the Day
  md += `## 🛠️ Tool of the Day: ${newsletter.toolOfTheDay.name}\n\n`;
  md += `**Why Now:** ${newsletter.toolOfTheDay.whyNow}\n\n`;
  md += `**Quick Start:** ${newsletter.toolOfTheDay.quickStart}\n\n`;
  md += `🔗 [Check it out](${newsletter.toolOfTheDay.url})\n\n`;
  md += `---\n\n`;

  // Audience Sections
  for (const section of newsletter.audienceSections) {
    md += `## 👥 For ${section.audienceName}\n\n`;
    md += `### ${section.title}\n\n`;
    md += `**Why It Matters:** ${section.whyItMatters}\n\n`;
    md += `${section.content}\n\n`;

    // Practical Prompt
    md += `### 💡 Practical Prompt\n\n`;
    md += `**Scenario:** ${section.practicalPrompt.scenario}\n\n`;
    md += `\`\`\`\n${section.practicalPrompt.prompt}\n\`\`\`\n\n`;

    // CTA
    md += `**${section.cta.text}**\n\n`;

    // Sources
    if (section.sources.length > 0) {
      md += `**Sources:**\n`;
      for (const source of section.sources) {
        md += `- [${source.title}](${source.url})\n`;
      }
      md += `\n`;
    }

    md += `---\n\n`;
  }

  // Conclusion
  md += `## 📬 Until Next Time\n\n`;
  md += `${newsletter.conclusion}\n`;

  return md;
}

async function main() {
  console.log('=== POC 5: Newsletter Generation (Enhanced Format) ===\n');

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('ERROR: Claude API key not found.');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  console.log('Generating enhanced newsletter...\n');
  const startTime = Date.now();

  try {
    const newsletter = await generateNewsletter(client);
    const endTime = Date.now();

    console.log('Newsletter generated successfully!\n');
    console.log('=== PREVIEW ===\n');

    // Preview
    console.log(`Editor's Note: ${newsletter.editorsNote.message.substring(0, 100)}...`);
    console.log(`Tool of the Day: ${newsletter.toolOfTheDay.name}`);
    console.log(`Audience Sections: ${newsletter.audienceSections.length}`);

    for (const section of newsletter.audienceSections) {
      console.log(`  - ${section.audienceName}: "${section.title}"`);
      console.log(`    Sources: ${section.sources.length}`);
      console.log(`    Has prompt: ${section.practicalPrompt.prompt.length > 0 ? 'Yes' : 'No'}`);
    }

    console.log(`\nGeneration time: ${endTime - startTime}ms`);

    // Write JSON output
    const jsonOutput = {
      timestamp: new Date().toISOString(),
      generation_time_ms: endTime - startTime,
      newsletter,
    };

    const jsonPath = path.join(__dirname, 'output', '5-newsletter.json');
    fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
    console.log(`\nJSON written to: ${jsonPath}`);

    // Write Markdown output
    const markdown = newsletterToMarkdown(newsletter);
    const mdPath = path.join(__dirname, 'output', '5-newsletter.md');
    fs.writeFileSync(mdPath, markdown);
    console.log(`Markdown written to: ${mdPath}`);

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Generation time: ${endTime - startTime}ms`);
    console.log(`Sections generated: ${newsletter.audienceSections.length}/${audiences.length}`);
    console.log(`Total sources cited: ${newsletter.audienceSections.reduce((sum, s) => sum + s.sources.length, 0)}`);
    console.log(`All sections have prompts: ${newsletter.audienceSections.every(s => s.practicalPrompt.prompt.length > 0)}`);
  } catch (error) {
    console.error('Generation error:', error);

    const outputPath = path.join(__dirname, 'output', '5-newsletter.json');
    fs.writeFileSync(
      outputPath,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      }, null, 2)
    );
  }
}

main().catch(console.error);
