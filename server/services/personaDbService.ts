/**
 * Persona Database Service
 * CRUD operations for writer personas stored in SQLite
 */

import db from '../db/init.ts';

// Types
export interface WriterPersona {
  id: string;
  name: string;
  tagline: string | null;
  expertise: string | null;
  values: string | null;
  writingStyle: string | null;
  signatureElements: string[];
  sampleWriting: string | null;
  isActive: boolean;
  isDefault: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DbPersonaRow {
  id: string;
  name: string;
  tagline: string | null;
  expertise: string | null;
  persona_values: string | null;
  writing_style: string | null;
  signature_elements: string | null;
  sample_writing: string | null;
  is_active: number;
  is_default: number;
  is_favorite: number;
  created_at: string;
  updated_at: string;
}

/**
 * Convert database row to WriterPersona object
 */
const rowToPersona = (row: DbPersonaRow): WriterPersona => ({
  id: row.id,
  name: row.name,
  tagline: row.tagline,
  expertise: row.expertise,
  values: row.persona_values,
  writingStyle: row.writing_style,
  signatureElements: row.signature_elements ? JSON.parse(row.signature_elements) : [],
  sampleWriting: row.sample_writing,
  isActive: row.is_active === 1,
  isDefault: row.is_default === 1,
  isFavorite: row.is_favorite === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Default personas to seed on first run
 */
const DEFAULT_PERSONAS: Omit<WriterPersona, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'persona_pragmatist',
    name: 'The Pragmatist',
    tagline: 'Cutting through hype to what actually works',
    expertise: 'Practical implementation, real-world applications, ROI-focused analysis',
    values: 'Efficiency, evidence-based decisions, actionable insights over theory',
    writingStyle: 'Direct and concise. Uses bullet points and numbered lists. Avoids fluff. Every paragraph has a clear purpose.',
    signatureElements: ["Here's what matters:", "The bottom line:", "Action items:", "Skip to the practical takeaway"],
    sampleWriting: "Let's cut to the chase: this new tool saves 3 hours per week on data entry. Here's what matters—it integrates with your existing stack without requiring a PhD to configure. The bottom line? If you're spending more than 30 minutes daily on manual data tasks, this pays for itself in two weeks.",
    isActive: false,
    isDefault: true,
    isFavorite: false,
  },
  {
    id: 'persona_explorer',
    name: 'The Explorer',
    tagline: 'Finding connections others miss',
    expertise: 'Cross-domain synthesis, pattern recognition, emerging trends',
    values: 'Curiosity, intellectual humility, connecting disparate ideas',
    writingStyle: 'Asks questions. Makes unexpected connections between fields. Often starts with "What if..." Uses analogies from diverse domains.',
    signatureElements: ["What if we're thinking about this all wrong?", "Here's a connection nobody's talking about:", "This reminds me of..."],
    sampleWriting: "What if the key to understanding AI creativity isn't in computer science at all, but in jazz improvisation? Both involve rules learned so deeply they can be broken meaningfully. Here's a connection nobody's talking about: the same neural patterns that help musicians riff also appear in GPT-4's chain-of-thought reasoning.",
    isActive: false,
    isDefault: true,
    isFavorite: false,
  },
  {
    id: 'persona_insider',
    name: 'The Insider',
    tagline: 'From the trenches of tech',
    expertise: 'Industry knowledge, behind-the-scenes access, trend forecasting',
    values: 'Transparency, informed skepticism, reading between the lines',
    writingStyle: 'Authoritative and knowing. References industry contacts and insider perspective. Distinguishes hype from substance.',
    signatureElements: ["What they're not telling you:", "According to sources close to the project:", "The real story is:", "Behind closed doors:"],
    sampleWriting: "What they're not telling you about this acquisition: it's a talent grab, pure and simple. According to sources close to the deal, the acquiring company has no plans to maintain the product. The real story is about the 12 engineers who built the underlying architecture—they're worth more than the entire user base.",
    isActive: false,
    isDefault: true,
    isFavorite: false,
  },
  {
    id: 'persona_narrator',
    name: 'The Narrator',
    tagline: 'Every innovation has a story',
    expertise: 'Storytelling, human interest angles, narrative structure',
    values: 'Human connection, emotional resonance, the story behind the story',
    writingStyle: 'Opens with a scene. Uses characters and dialogue. Builds tension and resolution. Finds the human angle in technical topics.',
    signatureElements: ["It started with a simple question:", "Picture this:", "What happened next surprised everyone:", "The lesson here is:"],
    sampleWriting: "It started with a simple question at 2 AM in a cramped apartment: 'What if passwords just... didn't exist?' Sarah had been awake for 36 hours, staring at her sixth failed authentication attempt. What happened next surprised everyone—including the VCs who would later fight over her company.",
    isActive: false,
    isDefault: true,
    isFavorite: false,
  },
  {
    id: 'persona_professional',
    name: 'The Professional',
    tagline: 'Excellence in every detail',
    expertise: 'Best practices, standards, quality assurance, process optimization',
    values: 'Precision, reliability, maintaining high standards, thoroughness',
    writingStyle: 'Polished and measured. Uses proper structure with clear sections. Maintains objectivity while being engaging. Never sensational.',
    signatureElements: ["Key considerations:", "Best practice:", "Recommended approach:", "Quality indicators:"],
    sampleWriting: "Key considerations before implementing this framework include infrastructure readiness, team training requirements, and compliance implications. Best practice dictates a phased rollout: pilot with one team, measure results against baseline metrics, then expand. The recommended approach balances innovation velocity with operational stability.",
    isActive: false,
    isDefault: true,
    isFavorite: false,
  },
  {
    id: 'persona_expert',
    name: 'The Expert',
    tagline: 'Deep knowledge, clearly explained',
    expertise: 'Technical depth, subject matter authority, research synthesis',
    values: 'Accuracy, education, demystifying complexity, intellectual honesty',
    writingStyle: 'Authoritative yet accessible. Breaks down complex concepts. Cites research and data. Teaches while informing.',
    signatureElements: ["Let me explain why:", "The technical reality is:", "Research shows:", "Here's how this actually works:"],
    sampleWriting: "Let me explain why this approach matters. The technical reality is that transformer architectures process text in parallel, not sequentially—this isn't just an implementation detail, it fundamentally changes what's computationally feasible. Research shows a 10x improvement in training efficiency, but here's how this actually works in practice...",
    isActive: false,
    isDefault: true,
    isFavorite: false,
  },
  {
    id: 'persona_everyman',
    name: 'The Everyman',
    tagline: 'Making sense of it all, together',
    expertise: 'Relatable perspective, common concerns, practical impact',
    values: 'Accessibility, empathy, shared discovery, cutting through complexity',
    writingStyle: 'Down-to-earth and relatable. Uses everyday language. Asks the questions readers have. Admits uncertainty.',
    signatureElements: ["Like you, I wondered:", "Here's what this means for us:", "I'll be honest—I was confused too:", "The simple version:"],
    sampleWriting: "Like you, I wondered: do I really need to care about this AI update? Here's what this means for us regular folks—your email just got a lot smarter at filtering spam, and your photo search actually works now. I'll be honest—I was confused too by the technical announcement. The simple version: less time searching, more time doing.",
    isActive: false,
    isDefault: true,
    isFavorite: false,
  },
];

/**
 * Generate unique ID for personas
 */
const generateId = (): string => {
  return `persona_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Seed default personas if none exist
 */
export const seedDefaultPersonas = (): void => {
  const count = db
    .prepare('SELECT COUNT(*) as count FROM writer_personas WHERE is_default = 1')
    .get() as { count: number };

  if (count.count === 0) {
    console.log('[PersonaDb] Seeding default personas...');

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO writer_personas
      (id, name, tagline, expertise, persona_values, writing_style, signature_elements, sample_writing, is_active, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    for (const persona of DEFAULT_PERSONAS) {
      stmt.run(
        persona.id,
        persona.name,
        persona.tagline,
        persona.expertise,
        persona.values,
        persona.writingStyle,
        JSON.stringify(persona.signatureElements),
        persona.sampleWriting,
        persona.isActive ? 1 : 0,
        persona.isDefault ? 1 : 0
      );
    }

    console.log(`[PersonaDb] Seeded ${DEFAULT_PERSONAS.length} default personas`);
  }
};

/**
 * Get all personas
 */
export const getAllPersonas = (): WriterPersona[] => {
  const rows = db
    .prepare('SELECT * FROM writer_personas ORDER BY is_favorite DESC, is_default DESC, name ASC')
    .all() as DbPersonaRow[];

  return rows.map(rowToPersona);
};

/**
 * Get active persona (if any)
 */
export const getActivePersona = (): WriterPersona | null => {
  const row = db
    .prepare('SELECT * FROM writer_personas WHERE is_active = 1')
    .get() as DbPersonaRow | undefined;

  if (!row) return null;
  return rowToPersona(row);
};

/**
 * Get persona by ID
 */
export const getPersonaById = (id: string): WriterPersona | null => {
  const row = db
    .prepare('SELECT * FROM writer_personas WHERE id = ?')
    .get(id) as DbPersonaRow | undefined;

  if (!row) return null;
  return rowToPersona(row);
};

/**
 * Set active persona (deactivates all others)
 */
export const setActivePersona = (id: string | null): void => {
  // Deactivate all personas
  db.prepare('UPDATE writer_personas SET is_active = 0').run();

  // Activate the selected one (if not null/none)
  if (id) {
    db.prepare('UPDATE writer_personas SET is_active = 1 WHERE id = ?').run(id);
    console.log(`[PersonaDb] Set active persona: ${id}`);
  } else {
    console.log('[PersonaDb] Deactivated all personas (None selected)');
  }
};

/**
 * Create a new custom persona
 */
export const createPersona = (
  name: string,
  tagline: string,
  expertise: string,
  values: string,
  writingStyle: string,
  signatureElements: string[],
  sampleWriting: string
): WriterPersona => {
  const id = generateId();

  db.prepare(`
    INSERT INTO writer_personas
    (id, name, tagline, expertise, persona_values, writing_style, signature_elements, sample_writing, is_active, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, datetime('now'), datetime('now'))
  `).run(id, name, tagline, expertise, values, writingStyle, JSON.stringify(signatureElements), sampleWriting);

  console.log(`[PersonaDb] Created persona: ${name} (${id})`);

  return getPersonaById(id)!;
};

/**
 * Update an existing persona
 */
export const updatePersona = (
  id: string,
  updates: Partial<{
    name: string;
    tagline: string;
    expertise: string;
    values: string;
    writingStyle: string;
    signatureElements: string[];
    sampleWriting: string;
  }>
): WriterPersona | null => {
  const existing = getPersonaById(id);
  if (!existing) return null;

  // Don't allow editing default personas
  if (existing.isDefault) {
    console.warn(`[PersonaDb] Cannot edit default persona: ${id}`);
    return existing;
  }

  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.tagline !== undefined) {
    fields.push('tagline = ?');
    values.push(updates.tagline);
  }
  if (updates.expertise !== undefined) {
    fields.push('expertise = ?');
    values.push(updates.expertise);
  }
  if (updates.values !== undefined) {
    fields.push('persona_values = ?');
    values.push(updates.values);
  }
  if (updates.writingStyle !== undefined) {
    fields.push('writing_style = ?');
    values.push(updates.writingStyle);
  }
  if (updates.signatureElements !== undefined) {
    fields.push('signature_elements = ?');
    values.push(JSON.stringify(updates.signatureElements));
  }
  if (updates.sampleWriting !== undefined) {
    fields.push('sample_writing = ?');
    values.push(updates.sampleWriting);
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE writer_personas SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  console.log(`[PersonaDb] Updated persona: ${id}`);

  return getPersonaById(id);
};

/**
 * Delete a custom persona
 */
export const deletePersona = (id: string): boolean => {
  const existing = getPersonaById(id);
  if (!existing) return false;

  // Don't allow deleting default personas
  if (existing.isDefault) {
    console.warn(`[PersonaDb] Cannot delete default persona: ${id}`);
    return false;
  }

  const result = db.prepare('DELETE FROM writer_personas WHERE id = ?').run(id);

  if (result.changes > 0) {
    console.log(`[PersonaDb] Deleted persona: ${id}`);
    return true;
  }

  return false;
};

/**
 * Get persona count
 */
export const getPersonaCount = (): { total: number; default: number; custom: number } => {
  const total = (db.prepare('SELECT COUNT(*) as count FROM writer_personas').get() as { count: number }).count;
  const defaultCount = (db.prepare('SELECT COUNT(*) as count FROM writer_personas WHERE is_default = 1').get() as { count: number }).count;

  return {
    total,
    default: defaultCount,
    custom: total - defaultCount,
  };
};

/**
 * Toggle persona favorite status
 */
export const togglePersonaFavorite = (id: string): WriterPersona | null => {
  const existing = getPersonaById(id);
  if (!existing) return null;

  const newFavoriteStatus = existing.isFavorite ? 0 : 1;

  db.prepare('UPDATE writer_personas SET is_favorite = ? WHERE id = ?').run(newFavoriteStatus, id);
  console.log(`[PersonaDb] Toggled favorite for ${id}: ${newFavoriteStatus === 1 ? 'favorited' : 'unfavorited'}`);

  return getPersonaById(id);
};

// Seed defaults on module load
seedDefaultPersonas();
