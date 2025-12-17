/**
 * Newsletter Format Service
 * Converts newsletters to various output formats (HTML, etc.)
 */

import type { NewsletterWithFormat, Newsletter, NewsletterSection, PromptOfTheDay } from './newsletterDbService.ts';

// Enhanced newsletter types (defined locally to avoid circular deps)
interface ToolOfTheDay {
  name: string;
  url: string;
  whyNow: string;
  quickStart: string;
}

interface EnhancedAudienceSection {
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
  sources: { url: string; title: string }[];
  imageUrl?: string;
}

interface EnhancedNewsletter {
  id?: string;
  editorsNote: { message: string };
  toolOfTheDay: ToolOfTheDay;
  audienceSections: EnhancedAudienceSection[];
  conclusion: string;
  subject?: string;
  promptOfTheDay?: PromptOfTheDay;
}

/**
 * Email-safe CSS styles (inline for compatibility)
 */
const EMAIL_STYLES = {
  container: 'max-width: 600px; margin: 0 auto; font-family: Georgia, serif; color: #1a1a1a; line-height: 1.6;',
  header: 'text-align: center; padding: 24px 0; border-bottom: 1px solid #e0e0e0;',
  title: 'font-size: 28px; font-weight: bold; margin: 0; color: #1a1a1a;',
  subtitle: 'font-size: 14px; color: #666; margin-top: 8px;',
  section: 'padding: 24px 0; border-bottom: 1px solid #e0e0e0;',
  sectionTitle: 'font-size: 20px; font-weight: bold; margin: 0 0 12px 0; color: #1a1a1a;',
  content: 'font-size: 16px; color: #333; margin: 12px 0;',
  image: 'max-width: 100%; height: auto; border-radius: 4px; margin: 16px 0;',
  callout: 'background: #f8f8f8; padding: 16px; border-left: 4px solid #0a3d62; margin: 16px 0;',
  promptBox: 'background: #f0f4f8; padding: 16px; font-family: monospace; font-size: 14px; white-space: pre-wrap; border-radius: 4px;',
  footer: 'text-align: center; padding: 24px 0; font-size: 12px; color: #999;',
  link: 'color: #0a3d62; text-decoration: underline;',
  button: 'display: inline-block; padding: 12px 24px; background: #0a3d62; color: white; text-decoration: none; border-radius: 4px;',
};

/**
 * Escape HTML special characters
 */
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Convert markdown-like text to simple HTML
 */
const markdownToHtml = (text: string): string => {
  return text
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" style="${EMAIL_STYLES.link}">$1</a>`)
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
};

/**
 * Render a v1 newsletter section to HTML
 */
const renderSection = (section: NewsletterSection, index: number): string => {
  const imageHtml = section.imageUrl
    ? `<img src="${escapeHtml(section.imageUrl)}" alt="${escapeHtml(section.title)}" style="${EMAIL_STYLES.image}" />`
    : '';

  return `
    <div style="${EMAIL_STYLES.section}">
      <h2 style="${EMAIL_STYLES.sectionTitle}">${escapeHtml(section.title)}</h2>
      ${imageHtml}
      <p style="${EMAIL_STYLES.content}">${markdownToHtml(section.content)}</p>
    </div>
  `;
};

/**
 * Render a v2 audience section to HTML
 */
const renderAudienceSection = (section: EnhancedAudienceSection): string => {
  const imageHtml = section.imageUrl
    ? `<img src="${escapeHtml(section.imageUrl)}" alt="${escapeHtml(section.title)}" style="${EMAIL_STYLES.image}" />`
    : '';

  const sourcesHtml = section.sources.length > 0
    ? `
      <div style="margin-top: 16px; font-size: 14px; color: #666;">
        <strong>Sources:</strong>
        ${section.sources.map(s => `<a href="${escapeHtml(s.url)}" style="${EMAIL_STYLES.link}">${escapeHtml(s.title)}</a>`).join(', ')}
      </div>
    `
    : '';

  return `
    <div style="${EMAIL_STYLES.section}">
      <div style="font-size: 12px; color: #0a3d62; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
        For ${escapeHtml(section.audienceName)}
      </div>
      <h2 style="${EMAIL_STYLES.sectionTitle}">${escapeHtml(section.title)}</h2>
      ${imageHtml}
      <div style="${EMAIL_STYLES.callout}">
        <strong>Why it matters:</strong> ${markdownToHtml(section.whyItMatters)}
      </div>
      <p style="${EMAIL_STYLES.content}">${markdownToHtml(section.content)}</p>
      <div style="${EMAIL_STYLES.promptBox}">
        <div style="font-weight: bold; margin-bottom: 8px;">${escapeHtml(section.practicalPrompt.scenario)}</div>
        ${escapeHtml(section.practicalPrompt.prompt)}
      </div>
      ${sourcesHtml}
    </div>
  `;
};

/**
 * Render prompt of the day to HTML
 */
const renderPromptOfTheDay = (prompt: PromptOfTheDay): string => {
  return `
    <div style="${EMAIL_STYLES.section}">
      <h2 style="${EMAIL_STYLES.sectionTitle}">Prompt of the Day</h2>
      <h3 style="font-size: 18px; margin: 8px 0;">${escapeHtml(prompt.title)}</h3>
      <p style="${EMAIL_STYLES.content}">${markdownToHtml(prompt.summary)}</p>
      <div style="${EMAIL_STYLES.promptBox}">${escapeHtml(prompt.promptCode)}</div>
      ${prompt.examplePrompts.length > 0 ? `
        <div style="margin-top: 16px;">
          <strong>Try these variations:</strong>
          <ul>
            ${prompt.examplePrompts.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `;
};

/**
 * Render tool of the day to HTML (v2)
 */
const renderToolOfTheDay = (tool: ToolOfTheDay): string => {
  if (!tool.name) return '';

  return `
    <div style="${EMAIL_STYLES.section}">
      <h2 style="${EMAIL_STYLES.sectionTitle}">Tool of the Day</h2>
      <h3 style="font-size: 18px; margin: 8px 0;">
        <a href="${escapeHtml(tool.url)}" style="${EMAIL_STYLES.link}">${escapeHtml(tool.name)}</a>
      </h3>
      <div style="${EMAIL_STYLES.callout}">
        <strong>Why now:</strong> ${markdownToHtml(tool.whyNow)}
      </div>
      <p style="${EMAIL_STYLES.content}"><strong>Quick start:</strong> ${markdownToHtml(tool.quickStart)}</p>
    </div>
  `;
};

/**
 * Convert v1 Newsletter to HTML email
 */
const v1NewsletterToHtml = (newsletter: Newsletter): string => {
  const sectionsHtml = newsletter.sections.map((s, i) => renderSection(s, i)).join('');
  const promptHtml = newsletter.promptOfTheDay ? renderPromptOfTheDay(newsletter.promptOfTheDay) : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(newsletter.subject)}</title>
</head>
<body style="margin: 0; padding: 0; background: #f5f5f5;">
  <div style="${EMAIL_STYLES.container}; background: white; padding: 24px;">
    <div style="${EMAIL_STYLES.header}">
      <h1 style="${EMAIL_STYLES.title}">${escapeHtml(newsletter.subject)}</h1>
      <p style="${EMAIL_STYLES.subtitle}">${new Date(newsletter.createdAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>

    <div style="${EMAIL_STYLES.section}">
      <p style="${EMAIL_STYLES.content}">${markdownToHtml(newsletter.introduction)}</p>
    </div>

    ${sectionsHtml}

    ${promptHtml}

    <div style="${EMAIL_STYLES.section}">
      <p style="${EMAIL_STYLES.content}">${markdownToHtml(newsletter.conclusion)}</p>
    </div>

    <div style="${EMAIL_STYLES.footer}">
      <p>Generated with AI Newsletter Generator</p>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Convert v2 Enhanced Newsletter to HTML email
 */
const v2NewsletterToHtml = (newsletter: EnhancedNewsletter, subject: string, createdAt: string): string => {
  const toolHtml = renderToolOfTheDay(newsletter.toolOfTheDay);
  const sectionsHtml = newsletter.audienceSections.map(s => renderAudienceSection(s)).join('');
  const promptHtml = newsletter.promptOfTheDay ? renderPromptOfTheDay(newsletter.promptOfTheDay) : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background: #f5f5f5;">
  <div style="${EMAIL_STYLES.container}; background: white; padding: 24px;">
    <div style="${EMAIL_STYLES.header}">
      <h1 style="${EMAIL_STYLES.title}">${escapeHtml(subject)}</h1>
      <p style="${EMAIL_STYLES.subtitle}">${new Date(createdAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>

    <div style="${EMAIL_STYLES.section}">
      <p style="${EMAIL_STYLES.content}">${markdownToHtml(newsletter.editorsNote.message)}</p>
    </div>

    ${toolHtml}

    ${sectionsHtml}

    ${promptHtml}

    <div style="${EMAIL_STYLES.section}">
      <p style="${EMAIL_STYLES.content}">${markdownToHtml(newsletter.conclusion)}</p>
    </div>

    <div style="${EMAIL_STYLES.footer}">
      <p>Generated with AI Newsletter Generator</p>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Convert any newsletter format to HTML email
 */
export const newsletterToHtml = (data: NewsletterWithFormat): string => {
  if (data.formatVersion === 'v2') {
    return v2NewsletterToHtml(
      data.newsletter as EnhancedNewsletter,
      data.subject,
      data.createdAt
    );
  }

  return v1NewsletterToHtml(data.newsletter as Newsletter);
};

/**
 * Get plain text version for email fallback
 */
export const newsletterToPlainText = (data: NewsletterWithFormat): string => {
  const lines: string[] = [];

  lines.push(data.subject);
  lines.push('='.repeat(data.subject.length));
  lines.push('');

  if (data.formatVersion === 'v2') {
    const newsletter = data.newsletter as EnhancedNewsletter;
    lines.push(newsletter.editorsNote.message);
    lines.push('');

    if (newsletter.toolOfTheDay.name) {
      lines.push(`TOOL OF THE DAY: ${newsletter.toolOfTheDay.name}`);
      lines.push(newsletter.toolOfTheDay.url);
      lines.push(newsletter.toolOfTheDay.whyNow);
      lines.push('');
    }

    for (const section of newsletter.audienceSections) {
      lines.push(`[For ${section.audienceName}]`);
      lines.push(section.title);
      lines.push('-'.repeat(section.title.length));
      lines.push(section.content);
      lines.push('');
    }

    lines.push(newsletter.conclusion);
  } else {
    const newsletter = data.newsletter as Newsletter;
    lines.push(newsletter.introduction);
    lines.push('');

    for (const section of newsletter.sections) {
      lines.push(section.title);
      lines.push('-'.repeat(section.title.length));
      lines.push(section.content);
      lines.push('');
    }

    lines.push(newsletter.conclusion);
  }

  return lines.join('\n');
};
