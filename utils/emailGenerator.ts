
import type { Newsletter } from '../types';

// Editorial Design Palette
const colors = {
    ink: '#1A1A1A',
    charcoal: '#333333',
    slate: '#6B7280',
    pearl: '#F7F7F5',
    paper: '#FFFFFF',
    editorialRed: '#C41E3A',
    editorialNavy: '#1E3A5F',
    editorialGold: '#F3D250',
    borderSubtle: '#E5E5E5',
    silver: '#9CA3AF',
};

const fonts = {
    display: "Georgia, 'Times New Roman', serif",
    serif: "Georgia, 'Times New Roman', serif",
    sans: "Arial, Helvetica, sans-serif",
    mono: "'Courier New', Courier, monospace",
};

export const generateEmailHtml = (newsletter: Newsletter, topics: string[]): string => {
    // Editorial Design - Email-safe CSS styles applied inline
    const bodyWrapperStyle = `margin: 0; padding: 24px; background-color: ${colors.pearl}; font-family: ${fonts.serif};`;
    const containerStyle = `width: 100%; max-width: 680px; margin: 0 auto; background-color: ${colors.paper}; box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04);`;
    const headerStyle = `padding: 48px 40px 40px 40px; border-bottom: 2px solid ${colors.ink};`;
    const topicLabelStyle = `font-family: ${fonts.sans}; font-size: 11px; font-weight: 600; color: ${colors.slate}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;`;
    const subjectStyle = `font-family: ${fonts.display}; font-size: 42px; font-weight: 400; color: ${colors.ink}; margin: 0; line-height: 1.15; letter-spacing: -0.5px;`;
    const bodyStyle = `padding: 48px 40px; font-family: ${fonts.serif}; font-size: 18px; color: ${colors.charcoal}; line-height: 1.75;`;
    const sectionTitleStyle = `font-family: ${fonts.display}; font-size: 28px; font-weight: 400; color: ${colors.ink}; margin-bottom: 16px; letter-spacing: -0.3px;`;
    const linkStyle = `color: ${colors.editorialNavy}; text-decoration: underline;`;
    const imageStyle = `width: 100%; height: auto; display: block; border: 1px solid ${colors.borderSubtle};`;
    const footerWrapperStyle = `padding: 40px; background-color: ${colors.pearl}; border-top: 1px solid ${colors.borderSubtle}; font-family: ${fonts.sans};`;
    const footerTextStyle = `font-size: 14px; color: ${colors.slate}; line-height: 1.6; text-align: center;`;
    const footerLinkStyle = `color: ${colors.editorialNavy}; text-decoration: underline; font-weight: 500;`;
    const subscribeButtonStyle = `background-color: ${colors.ink}; color: ${colors.paper}; padding: 14px 28px; text-decoration: none; font-weight: 500; display: inline-block; font-family: ${fonts.sans}; font-size: 14px;`;
    const promptCodeContainerStyle = `background-color: ${colors.ink}; color: ${colors.pearl}; padding: 20px; font-family: ${fonts.mono}; font-size: 13px; line-height: 1.6; overflow-x: auto; display: block; margin: 10px 0;`;
    const promptCodeTagStyle = `color: ${colors.editorialGold}; font-weight: bold;`;

    // Helper to inject link styles into the content HTML
    const formatContent = (content: string) => {
        return content.replace(/<a /g, `<a style="${linkStyle}" `);
    };

    const firstImagePrompt = newsletter.sections.find(s => s.imagePrompt)?.imagePrompt;

    // Format date in editorial style
    const formatDate = () => {
        return new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Create drop cap for introduction
    const formatIntroWithDropCap = (intro: string) => {
        if (!intro || intro.length === 0) return intro;
        const firstLetter = intro.charAt(0);
        const rest = intro.slice(1);
        const dropCapStyle = `float: left; font-family: ${fonts.display}; font-size: 72px; line-height: 0.8; padding-right: 12px; padding-top: 4px; color: ${colors.ink}; font-weight: 400;`;
        return `<span style="${dropCapStyle}">${firstLetter}</span>${rest}`;
    };

    const parsePromptCodeForEmail = (promptCode: string) => {
        // Escape HTML entities in the code for safe rendering
        const escaped = promptCode
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Split into lines for processing
        const lines = escaped.split('\n');

        return lines.map(line => {
            // Replace escaped tags with highlighted versions
            const highlighted = line
                .replace(/&lt;(\w+)&gt;/g, `<span style="${promptCodeTagStyle}">&lt;$1&gt;</span>`)
                .replace(/&lt;\/(\w+)&gt;/g, `<span style="${promptCodeTagStyle}">&lt;/$1&gt;</span>`);

            return `<div style="margin: 0; padding: 3px 0; word-wrap: break-word; overflow-wrap: break-word;">${highlighted}</div>`;
        }).join('');
    };

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${newsletter.subject}</title>
    </head>
    <body style="${bodyWrapperStyle}">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
                <td>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="${containerStyle}">
                        <!-- Header -->
                        <tr>
                            <td style="${headerStyle}">
                                <p style="${topicLabelStyle}">${formatDate()}${topics && topics.length > 0 ? ` <span style="color: ${colors.silver}; margin: 0 8px;">·</span> ${topics.join(' · ')}` : ''}</p>
                                <h1 style="${subjectStyle}">${newsletter.subject}</h1>
                            </td>
                        </tr>
                        <!-- Body -->
                        <tr>
                            <td style="${bodyStyle}">
                                <p style="margin-bottom: 40px; overflow: hidden;">${formatIntroWithDropCap(newsletter.introduction)}</p>
                                
                                <!-- Sections -->
                                ${newsletter.sections.map((section, index) => `
                                    ${index > 0 ? `<hr style="border: none; border-top: 1px solid ${colors.borderSubtle}; margin: 40px 0;">` : ''}
                                    <h2 style="${sectionTitleStyle}">${section.title}</h2>
                                    <div style="margin-bottom: 24px; font-family: ${fonts.serif}; font-size: 18px; color: ${colors.charcoal}; line-height: 1.75;">${formatContent(section.content)}</div>
                                    ${section.imageUrl ? `
                                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0 40px 0;">
                                            <tr>
                                                <td>
                                                    <img src="${section.imageUrl}" alt="${section.title}" style="${imageStyle}">
                                                </td>
                                            </tr>
                                            ${section.imagePrompt ? `
                                            <tr>
                                                <td style="padding-top: 8px; text-align: center;">
                                                    <p style="font-family: ${fonts.serif}; font-size: 14px; font-style: italic; color: ${colors.slate}; margin: 0;">${section.imagePrompt}</p>
                                                </td>
                                            </tr>
                                            ` : ''}
                                        </table>
                                    ` : ''}
                                `).join('')}
                                
                                <hr style="border: none; border-top: 1px solid ${colors.borderSubtle}; margin: 40px 0 32px 0;">
                                <p style="margin-top: 0; font-family: ${fonts.serif}; font-size: 18px; color: ${colors.charcoal}; line-height: 1.75;">${newsletter.conclusion}</p>
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="${footerWrapperStyle}">
                                <!-- From the AI's Desk Section -->
                                ${firstImagePrompt ? `
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; background-color: ${colors.paper}; border: 1px solid ${colors.borderSubtle};">
                                    <tr>
                                        <td style="padding: 24px;">
                                            <p style="font-family: ${fonts.sans}; font-size: 11px; font-weight: 600; color: ${colors.slate}; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 8px 0;">From the AI's Desk</p>
                                            <p style="font-family: ${fonts.serif}; font-size: 15px; color: ${colors.charcoal}; font-style: italic; margin: 0;">This week's image prompt: "${firstImagePrompt}"</p>
                                        </td>
                                    </tr>
                                </table>
                                ` : ''}

                                <!-- Share & Subscribe Section -->
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; text-align: center; padding: 24px 0; border-top: 1px solid ${colors.borderSubtle}; border-bottom: 1px solid ${colors.borderSubtle};">
                                    <tr>
                                        <td>
                                            <p style="font-family: ${fonts.sans}; font-size: 15px; color: ${colors.charcoal}; margin-bottom: 20px;">Enjoying these insights? Share with a colleague.</p>
                                            <a href="#" target="_blank" style="${subscribeButtonStyle}">Subscribe</a>
                                            <p style="margin-top: 16px; font-size: 14px;"><a href="mailto:?subject=FW: ${encodeURIComponent(newsletter.subject)}&body=I thought you'd find this interesting." style="${footerLinkStyle}">Forward this newsletter</a></p>
                                        </td>
                                    </tr>
                                </table>

                                <!-- Explore Further Section -->
                                ${topics && topics.length > 0 ? `
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                                    <tr>
                                        <td style="font-family: ${fonts.display}; font-size: 22px; color: ${colors.ink}; text-align: center; padding-bottom: 16px;">
                                            Explore Further
                                        </td>
                                    </tr>
                                    ${topics.map(topic => `
                                    <tr>
                                        <td style="padding: 12px 0; text-align: center;">
                                            <p style="font-family: ${fonts.sans}; font-size: 14px; font-weight: 500; color: ${colors.ink}; margin: 0 0 8px 0;">${topic}</p>
                                            <span style="font-family: ${fonts.sans}; font-size: 13px;">
                                                <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(topic)}" target="_blank" style="${footerLinkStyle}">YouTube</a>
                                                <span style="color: ${colors.silver}; margin: 0 8px;">·</span>
                                                <a href="https://scholar.google.com/scholar?q=${encodeURIComponent(topic)}" target="_blank" style="${footerLinkStyle}">Google Scholar</a>
                                                <span style="color: ${colors.silver}; margin: 0 8px;">·</span>
                                                <a href="https://twitter.com/search?q=${encodeURIComponent(topic)}" target="_blank" style="${footerLinkStyle}">X</a>
                                            </span>
                                        </td>
                                    </tr>
                                    `).join('')}
                                </table>
                                ` : ''}
                                
                                <!-- Prompt of the Day Section -->
                                ${newsletter.promptOfTheDay ? `
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; background-color: ${colors.paper}; border: 1px solid ${colors.borderSubtle};">
                                    <tr>
                                        <td style="padding: 24px;">
                                            <h3 style="font-family: ${fonts.display}; font-size: 22px; color: ${colors.ink}; margin: 0 0 16px 0;">Prompt of the Day</h3>
                                            <h4 style="font-family: ${fonts.sans}; font-size: 16px; font-weight: 600; color: ${colors.ink}; margin: 0 0 10px 0;">${newsletter.promptOfTheDay.title}</h4>
                                            <p style="font-family: ${fonts.serif}; font-size: 16px; color: ${colors.charcoal}; line-height: 1.65; margin-bottom: 16px;">${newsletter.promptOfTheDay.summary}</p>

                                            <p style="font-family: ${fonts.sans}; font-size: 13px; font-weight: 600; color: ${colors.slate}; margin-bottom: 8px;">Example prompts:</p>
                                            <ul style="list-style-type: disc; margin: 0 0 16px 20px; padding: 0;">
                                                ${newsletter.promptOfTheDay.examplePrompts.map(prompt => `
                                                    <li style="font-family: ${fonts.serif}; font-size: 15px; color: ${colors.charcoal}; line-height: 1.6; margin-bottom: 6px;">${prompt}</li>
                                                `).join('')}
                                            </ul>

                                            <p style="font-family: ${fonts.sans}; font-size: 13px; font-weight: 600; color: ${colors.slate}; margin-bottom: 8px;">Prompt Code:</p>
                                            <div style="${promptCodeContainerStyle}">
                                                ${parsePromptCodeForEmail(newsletter.promptOfTheDay.promptCode)}
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                                ` : ''}

                                <!-- Legal Footer -->
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="padding-top: 24px; border-top: 1px solid ${colors.borderSubtle};">
                                    <tr>
                                        <td style="${footerTextStyle}">
                                            <p style="margin: 0 0 8px 0; font-family: ${fonts.sans}; font-size: 13px; color: ${colors.slate};">© ${new Date().getFullYear()} AI for PI · Newsletter Studio</p>
                                            <p style="margin: 0 0 12px 0; font-family: ${fonts.sans}; font-size: 13px; color: ${colors.silver};">Curated and generated with AI assistance</p>
                                            <p style="margin: 0; font-family: ${fonts.sans}; font-size: 13px;">
                                                <a href="mailto:shayisa@gmail.com?subject=UNSUBSCRIBE" target="_blank" style="${footerLinkStyle}">Unsubscribe</a>
                                                <span style="color: ${colors.silver}; margin: 0 8px;">·</span>
                                                <a href="mailto:shayisa@gmail.com" target="_blank" style="${footerLinkStyle}">Contact</a>
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
};