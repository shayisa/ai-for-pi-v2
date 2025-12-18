/**
 * Prompt Parser Service
 *
 * Phase 11c: Multi-strategy parsing service for prompt import feature.
 * Implements fallback chain: regex -> template -> AI parsing.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../control-plane/feedback';
import { getApiKey } from './credentialLoader';
import type {
  ImportedPromptFields,
  ParsingMethod,
  PromptImportResult,
  PromptImportTemplate,
  FieldPatterns,
} from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface ParseOptions {
  /** Force a specific parsing method */
  forceMethod?: ParsingMethod;
  /** Template to use for template parsing */
  template?: PromptImportTemplate;
  /** Source hint for AI parsing (URL domain or file type) */
  sourceHint?: string;
  /** User email for API key lookup */
  userEmail?: string;
}

interface RegexParseResult {
  success: boolean;
  fields?: ImportedPromptFields;
  confidence: number;
  fieldsFound: string[];
}

// ============================================================================
// Regex Patterns (from PromptOfTheDayEditor.tsx)
// ============================================================================

const PATTERNS = {
  // Title: H1 markdown with or without bold
  titleBold: /^#\s*\*\*(.*?)\*\*/m,
  titlePlain: /^#\s+(.+?)(?:\s*$|\n)/m,

  // Example prompts section marker
  examplePromptsMarker: /\*\*Three example.*?prompts.*?:\*\*/i,

  // Example prompts: numbered list with quoted text (smart and standard quotes)
  examplePrompt: /\d+\.\s*[""](.*?)[""]/g,

  // Prompt code: markdown code block
  codeBlock: /```\s*([\s\S]*?)```/,
} as const;

// ============================================================================
// Regex Parsing (Primary Strategy)
// ============================================================================

/**
 * Parse prompt content using regex patterns
 * Replicates the parseFullPrompt logic from PromptOfTheDayEditor.tsx
 */
export function parseWithRegex(content: string): RegexParseResult {
  const text = content.trim();
  if (!text) {
    return { success: false, confidence: 0, fieldsFound: [] };
  }

  let title = '';
  let summary = '';
  const examplePrompts: string[] = [];
  let promptCode = '';
  const fieldsFound: string[] = [];

  // 1. Extract Title (H1 markdown - with or without bold)
  let titleMatch = text.match(PATTERNS.titleBold);
  if (!titleMatch) {
    titleMatch = text.match(PATTERNS.titlePlain);
  }

  if (titleMatch?.[1]) {
    title = titleMatch[1].trim();
    fieldsFound.push('title');
  }

  // 2. Extract Summary (between title and example prompts section)
  const markerMatch = text.match(PATTERNS.examplePromptsMarker);
  const summaryEndIndex = markerMatch ? text.indexOf(markerMatch[0]) : -1;

  let titleStartIndex = -1;
  if (title && titleMatch?.[0]) {
    titleStartIndex = text.indexOf(titleMatch[0]) + titleMatch[0].length;
  }

  if (summaryEndIndex !== -1 && titleStartIndex !== -1 && titleStartIndex < summaryEndIndex) {
    summary = text.substring(titleStartIndex, summaryEndIndex).trim();
    if (summary) {
      fieldsFound.push('summary');
    }
  } else if (summaryEndIndex !== -1) {
    // Fallback if title not found but summary end is clear
    summary = text.substring(0, summaryEndIndex).trim();
    if (summary) {
      fieldsFound.push('summary');
    }
  }

  // 3. Extract Example Prompts
  const examplePromptsSectionStartIndex = summaryEndIndex;
  if (examplePromptsSectionStartIndex !== -1) {
    const codeBlockStartIndex = text.indexOf('```', examplePromptsSectionStartIndex);
    const examplePromptsSection =
      codeBlockStartIndex !== -1
        ? text.substring(examplePromptsSectionStartIndex, codeBlockStartIndex)
        : text.substring(examplePromptsSectionStartIndex);

    // Reset lastIndex for global regex
    const regex = new RegExp(PATTERNS.examplePrompt.source, 'g');
    let match;
    while ((match = regex.exec(examplePromptsSection)) !== null) {
      examplePrompts.push(match[0].trim());
    }

    if (examplePrompts.length > 0) {
      fieldsFound.push('examplePrompts');
    }
  }

  // 4. Extract Prompt Code (first markdown code block)
  const codeMatch = text.match(PATTERNS.codeBlock);
  if (codeMatch?.[1]) {
    promptCode = codeMatch[1].trim();
    fieldsFound.push('promptCode');
  }

  // Calculate confidence based on fields found
  const confidence = (fieldsFound.length / 4) * 100;

  // Consider successful if we found at least title and promptCode (core fields)
  const success = fieldsFound.includes('title') && fieldsFound.includes('promptCode');

  return {
    success,
    confidence,
    fieldsFound,
    fields: {
      title,
      summary,
      examplePrompts,
      promptCode,
    },
  };
}

// ============================================================================
// Template Parsing
// ============================================================================

/**
 * Parse content using a custom template's field patterns
 */
export function parseWithTemplate(
  content: string,
  template: PromptImportTemplate
): RegexParseResult {
  const text = content.trim();
  if (!text) {
    return { success: false, confidence: 0, fieldsFound: [] };
  }

  const fieldsFound: string[] = [];
  const fields: ImportedPromptFields = {
    title: '',
    summary: '',
    examplePrompts: [],
    promptCode: '',
  };

  // Helper to apply a pattern
  const applyPattern = (
    fieldName: keyof FieldPatterns,
    targetField: keyof ImportedPromptFields
  ): boolean => {
    const pattern = template.fieldPatterns[fieldName];
    if (!pattern?.pattern) return false;

    try {
      const regex = new RegExp(pattern.pattern, pattern.flags || '');
      const match = text.match(regex);

      if (match) {
        const groupIndex = pattern.groupIndex ?? 1;
        const value = match[groupIndex] || match[0];

        if (targetField === 'examplePrompts') {
          // For example prompts, collect all matches
          const globalRegex = new RegExp(pattern.pattern, (pattern.flags || '') + 'g');
          let m;
          while ((m = globalRegex.exec(text)) !== null) {
            const val = m[groupIndex] || m[0];
            fields.examplePrompts.push(val.trim());
          }
          return fields.examplePrompts.length > 0;
        } else if (targetField === 'title') {
          fields.title = value.trim();
          return true;
        } else if (targetField === 'summary') {
          fields.summary = value.trim();
          return true;
        } else if (targetField === 'promptCode') {
          fields.promptCode = value.trim();
          return true;
        }
        return false;
      }
    } catch (error) {
      logger.warn('prompt-parser', 'template_pattern_error', `Invalid pattern for ${fieldName}`, {
        pattern: pattern.pattern,
        error: (error as Error).message,
      });
    }

    return false;
  };

  // Apply each field pattern
  if (applyPattern('title', 'title')) fieldsFound.push('title');
  if (applyPattern('summary', 'summary')) fieldsFound.push('summary');
  if (applyPattern('examplePrompts', 'examplePrompts')) fieldsFound.push('examplePrompts');
  if (applyPattern('promptCode', 'promptCode')) fieldsFound.push('promptCode');

  const confidence = (fieldsFound.length / 4) * 100;
  const success = fieldsFound.includes('title') && fieldsFound.includes('promptCode');

  return {
    success,
    confidence,
    fieldsFound,
    fields,
  };
}

// ============================================================================
// AI Parsing (Fallback)
// ============================================================================

/**
 * Parse content using Claude AI for complex/unknown formats
 */
export async function parseWithAi(
  content: string,
  options: {
    sourceHint?: string;
    userEmail?: string;
  } = {}
): Promise<RegexParseResult & { tokensUsed?: number }> {
  const apiKey = getApiKey('claude', options.userEmail);

  if (!apiKey) {
    return {
      success: false,
      confidence: 0,
      fieldsFound: [],
      fields: { title: '', summary: '', examplePrompts: [], promptCode: '' },
    };
  }

  const startTime = Date.now();

  try {
    const client = new Anthropic({ apiKey });

    const sourceContext = options.sourceHint
      ? `The content was imported from: ${options.sourceHint}`
      : '';

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `You are a prompt parsing assistant. Extract structured fields from prompt content.
Return ONLY valid JSON with no explanation or markdown formatting.`,
      messages: [
        {
          role: 'user',
          content: `Extract the following fields from this prompt content:
- title: The prompt's title or name
- summary: A brief description of what the prompt does
- examplePrompts: An array of example user messages that could use this prompt (look for numbered lists, bullet points, or quoted examples)
- promptCode: The actual prompt template/code (often in code blocks or XML-like tags)

${sourceContext}

Content to parse:
---
${content.substring(0, 8000)}
---

Return JSON with exactly this structure:
{
  "title": "extracted title",
  "summary": "extracted summary",
  "examplePrompts": ["example 1", "example 2"],
  "promptCode": "the prompt template code"
}

If a field cannot be found, use an empty string or empty array.`,
        },
      ],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.Messages.TextBlock => block.type === 'text'
    );

    if (!textBlock) {
      logger.warn('prompt-parser', 'ai_no_response', 'No text response from Claude');
      return {
        success: false,
        confidence: 0,
        fieldsFound: [],
        fields: { title: '', summary: '', examplePrompts: [], promptCode: '' },
      };
    }

    // Parse JSON response
    let jsonText = textBlock.text.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonText) as ImportedPromptFields;

    // Determine which fields were found
    const fieldsFound: string[] = [];
    if (parsed.title?.trim()) fieldsFound.push('title');
    if (parsed.summary?.trim()) fieldsFound.push('summary');
    if (parsed.examplePrompts?.length > 0) fieldsFound.push('examplePrompts');
    if (parsed.promptCode?.trim()) fieldsFound.push('promptCode');

    const confidence = (fieldsFound.length / 4) * 100;
    const success = fieldsFound.includes('title') && fieldsFound.includes('promptCode');

    const tokensUsed =
      (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    logger.info('prompt-parser', 'ai_parse_complete', `AI parsed ${fieldsFound.length} fields`, {
      timeMs: Date.now() - startTime,
      tokensUsed,
      fieldsFound,
    });

    return {
      success,
      confidence,
      fieldsFound,
      fields: {
        title: parsed.title || '',
        summary: parsed.summary || '',
        examplePrompts: parsed.examplePrompts || [],
        promptCode: parsed.promptCode || '',
      },
      tokensUsed,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('prompt-parser', 'ai_parse_error', err.message, err);

    return {
      success: false,
      confidence: 0,
      fieldsFound: [],
      fields: { title: '', summary: '', examplePrompts: [], promptCode: '' },
    };
  }
}

// ============================================================================
// Main Parser (Fallback Chain)
// ============================================================================

/**
 * Parse prompt content using fallback chain: regex -> template -> AI
 *
 * Decision flow per user preferences:
 * - AI parsing: Only when regex/template fails
 * - Returns result with parsing method used
 */
export async function parsePromptContent(
  content: string,
  options: ParseOptions = {}
): Promise<PromptImportResult> {
  const startTime = Date.now();

  // If forced method specified, use only that method
  if (options.forceMethod === 'regex') {
    const result = parseWithRegex(content);
    return {
      success: result.success,
      fields: result.fields,
      parsingMethod: 'regex',
      confidence: result.confidence,
      processingTimeMs: Date.now() - startTime,
    };
  }

  if (options.forceMethod === 'template' && options.template) {
    const result = parseWithTemplate(content, options.template);
    return {
      success: result.success,
      fields: result.fields,
      parsingMethod: 'template',
      templateId: options.template.id,
      confidence: result.confidence,
      processingTimeMs: Date.now() - startTime,
    };
  }

  if (options.forceMethod === 'ai') {
    const result = await parseWithAi(content, {
      sourceHint: options.sourceHint,
      userEmail: options.userEmail,
    });
    return {
      success: result.success,
      fields: result.fields,
      parsingMethod: 'ai',
      confidence: result.confidence,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Fallback chain: regex -> template -> AI

  // Step 1: Try regex parsing first (fastest, no API cost)
  logger.info('prompt-parser', 'chain_start', 'Starting fallback chain with regex');
  const regexResult = parseWithRegex(content);

  if (regexResult.success && regexResult.confidence >= 50) {
    logger.info('prompt-parser', 'chain_complete', 'Regex parsing succeeded', {
      confidence: regexResult.confidence,
      fieldsFound: regexResult.fieldsFound,
    });
    return {
      success: true,
      fields: regexResult.fields,
      parsingMethod: 'regex',
      confidence: regexResult.confidence,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Step 2: Try template parsing if template provided
  if (options.template) {
    logger.info('prompt-parser', 'chain_template', 'Trying template parsing');
    const templateResult = parseWithTemplate(content, options.template);

    if (templateResult.success && templateResult.confidence >= 50) {
      logger.info('prompt-parser', 'chain_complete', 'Template parsing succeeded', {
        confidence: templateResult.confidence,
        fieldsFound: templateResult.fieldsFound,
      });
      return {
        success: true,
        fields: templateResult.fields,
        parsingMethod: 'template',
        templateId: options.template.id,
        confidence: templateResult.confidence,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  // Step 3: Fall back to AI parsing
  logger.info('prompt-parser', 'chain_ai', 'Falling back to AI parsing');
  const aiResult = await parseWithAi(content, {
    sourceHint: options.sourceHint,
    userEmail: options.userEmail,
  });

  if (aiResult.success) {
    logger.info('prompt-parser', 'chain_complete', 'AI parsing succeeded', {
      confidence: aiResult.confidence,
      fieldsFound: aiResult.fieldsFound,
    });
    return {
      success: true,
      fields: aiResult.fields,
      parsingMethod: 'ai',
      confidence: aiResult.confidence,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // All methods failed - return best partial result
  // Prefer regex result if it found some fields
  if (regexResult.fieldsFound.length > 0) {
    return {
      success: false,
      fields: regexResult.fields,
      parsingMethod: 'regex',
      confidence: regexResult.confidence,
      error: 'Partial extraction: could not extract all required fields',
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Return AI result even if it failed
  return {
    success: false,
    fields: aiResult.fields,
    parsingMethod: 'ai',
    confidence: 0,
    error: 'Could not extract prompt fields from content',
    processingTimeMs: Date.now() - startTime,
  };
}

export default {
  parsePromptContent,
  parseWithRegex,
  parseWithTemplate,
  parseWithAi,
};
