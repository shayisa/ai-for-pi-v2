/**
 * Preview Generator Service
 *
 * Generates short persona previews for A/B comparison.
 *
 * @module domains/generation/services/previewGenerator
 *
 * Phase 12.0: Added for persona A/B preview feature
 */
import { getAnthropicClient } from '../../../external/claude';
import type { WriterPersona } from '../../../../types';

/**
 * Generate a short preview paragraph in a persona's voice
 *
 * @param persona - The writer persona to use
 * @param topic - The topic to write about
 * @returns A 50-75 word paragraph in the persona's voice
 */
export async function generatePersonaPreview(
  persona: WriterPersona,
  topic: string
): Promise<string> {
  const client = await getAnthropicClient();

  const prompt = `Write a single paragraph (50-75 words) introducing an article about "${topic}" in the voice of a writer with these characteristics:

Name: ${persona.name}
${persona.tagline ? `Identity: "${persona.tagline}"` : ''}
${persona.writingStyle ? `Style: ${persona.writingStyle}` : ''}
${persona.expertise ? `Expertise: ${persona.expertise}` : ''}
${persona.values ? `Values: ${persona.values}` : ''}
${persona.signatureElements?.length ? `Signature phrases: ${persona.signatureElements.join(', ')}` : ''}

Write naturally as this persona would. Return ONLY the paragraph, no preamble or explanation.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }]
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock?.text || '';
}

/**
 * Result of persona preview generation
 */
export interface PersonaPreviewResult {
  success: boolean;
  preview?: string;
  personaName: string;
  error?: string;
}
