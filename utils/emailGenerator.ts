

import type { Newsletter } from '../types';

export const generateEmailHtml = (newsletter: Newsletter, topics: string[]): string => {
    // Email-safe CSS styles are applied inline.
    const bodyWrapperStyle = `margin: 0; padding: 20px; background-color: #F5F5F5; font-family: Georgia, 'Times New Roman', Times, serif;`;
    const containerStyle = `width: 100%; max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);`;
    const headerStyle = `padding: 40px; border-bottom: 1px solid #E0E0E0;`;
    const topicLabelStyle = `font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; color: #666666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;`;
    const subjectStyle = `font-family: Arial, sans-serif; font-size: 36px; font-weight: 800; color: #333333; margin: 0;`;
    const bodyStyle = `padding: 40px; font-family: Georgia, 'Times New Roman', Times, serif; font-size: 18px; color: #333333; line-height: 1.75;`;
    const sectionTitleStyle = `font-family: Arial, sans-serif; font-size: 28px; font-weight: bold; color: #333333; margin-bottom: 16px;`;
    const linkStyle = `color: #5DA2D5; text-decoration: underline;`; // accent-muted-blue
    const imageStyle = `width: 100%; height: auto; display: block; border-radius: 8px; border: 1px solid #dddddd;`;
    const footerWrapperStyle = `padding: 40px; background-color: #f9f9f9; border-top: 1px solid #E0E0E0; font-family: Arial, sans-serif;`;
    const footerTextStyle = `font-size: 14px; color: #666666; line-height: 1.6; text-align: center;`;
    const footerLinkStyle = `color: #5DA2D5; text-decoration: none; font-weight: bold;`; // accent-muted-blue
    const subscribeButtonStyle = `background-color: #F78888; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;`; // accent-salmon
    const promptCodeContainerStyle = `background-color: #2C2C2C; color: #eeeeee; padding: 15px; border-radius: 5px; font-family: 'Courier New', Courier, monospace; font-size: 13px; line-height: 1.5; overflow-x: auto; border: 1px solid #1a1a1a; display: block; margin: 10px 0;`; // dark-code
    const promptCodeTagStyle = `color: #F3D250; font-weight: bold;`; // accent-yellow

    // Helper to inject link styles into the content HTML
    const formatContent = (content: string) => {
        return content.replace(/<a /g, `<a style="${linkStyle}" `);
    };

    const firstImagePrompt = newsletter.sections.find(s => s.imagePrompt)?.imagePrompt;

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
                                ${topics && topics.length > 0 ? `<p style="${topicLabelStyle}">Topic</p>` : ''}
                                <h1 style="${subjectStyle}">${newsletter.subject}</h1>
                            </td>
                        </tr>
                        <!-- Body -->
                        <tr>
                            <td style="${bodyStyle}">
                                <p style="margin-bottom: 32px;">${newsletter.introduction}</p>
                                
                                <!-- Sections -->
                                ${newsletter.sections.map(section => `
                                    <h2 style="${sectionTitleStyle}">${section.title}</h2>
                                    <div style="margin-bottom: 24px;">${formatContent(section.content)}</div>
                                    ${section.imageUrl ? `
                                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
                                            <tr>
                                                <td>
                                                    <img src="${section.imageUrl}" alt="${section.title}" style="${imageStyle}">
                                                </td>
                                            </tr>
                                        </table>
                                    ` : ''}
                                `).join('')}
                                
                                <p style="margin-top: 32px;">${newsletter.conclusion}</p>
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="${footerWrapperStyle}">
                                <!-- From the AI's Desk Section -->
                                ${firstImagePrompt ? `
                                <hr style="border: 0; border-top: 1px solid #E0E0E0; margin: 24px 0;">
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; background-color: #f0f0f0; border-radius: 5px;">
                                    <tr>
                                        <td style="padding: 20px; text-align: center;">
                                            <p style="font-size: 16px; font-weight: bold; color: #333333; margin: 0 0 8px 0;">From the AI's Desk</p>
                                            <p style="font-size: 13px; color: #555555; font-style: italic; margin: 0;">This week's image prompt:</p>
                                            <p style="font-size: 13px; color: #555555; font-style: italic; margin: 8px 0 0 0;">"${firstImagePrompt}"</p>
                                        </td>
                                    </tr>
                                </table>
                                ` : ''}

                                <!-- Viral Loop Section -->
                                <hr style="border: 0; border-top: 1px solid #E0E0E0; margin: 24px 0;">
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; text-align: center;">
                                    <tr>
                                        <td>
                                            <p style="font-size: 16px; color: #333333; margin-bottom: 16px;">Enjoying these insights? Share them with a colleague!</p>
                                            <a href="#" target="_blank" style="${subscribeButtonStyle}">Subscribe Here</a>
                                            <p style="margin-top: 16px; font-size: 14px;"><a href="mailto:?subject=FW: ${encodeURIComponent(newsletter.subject)}&body=Hey, I thought you'd find this interesting. You can subscribe here: [Your Subscribe Link]" style="${footerLinkStyle}">Forward this email</a></p>
                                        </td>
                                    </tr>
                                </table>

                                <!-- Explore Further Section -->
                                <hr style="border: 0; border-top: 1px solid #E0E0E0; margin: 24px 0;">
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                                    <tr>
                                        <td style="font-size: 18px; font-weight: bold; color: #333333; text-align: center; margin-bottom: 16px;">
                                            Explore Further
                                        </td>
                                    </tr>
                                    ${topics.map(topic => `
                                    <tr>
                                        <td style="padding: 10px 0; text-align: center;">
                                            <p style="font-size: 14px; color: #333333; margin: 0 0 8px 0;">${topic}</p>
                                            <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(topic)}" target="_blank" style="${footerLinkStyle}">YouTube</a> &nbsp;&nbsp;&nbsp;
                                            <a href="https://scholar.google.com/scholar?q=${encodeURIComponent(topic)}" target="_blank" style="${footerLinkStyle}">Google Scholar</a> &nbsp;&nbsp;&nbsp;
                                            <a href="https://twitter.com/search?q=${encodeURIComponent(topic)}" target="_blank" style="${footerLinkStyle}">X/Twitter</a>
                                        </td>
                                    </tr>
                                    `).join('')}
                                </table>
                                
                                <!-- Prompt of the Day Section -->
                                ${newsletter.promptOfTheDay ? `
                                <hr style="border: 0; border-top: 1px solid #E0E0E0; margin: 24px 0;">
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                                    <tr>
                                        <td style="font-size: 20px; font-weight: bold; color: #333333; text-align: center; margin-bottom: 16px;">
                                            Prompt of the Day
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="background-color: #f0f0f0; border-radius: 8px; padding: 20px;">
                                            <h4 style="font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; color: #111111; margin-top: 0; margin-bottom: 10px;">${newsletter.promptOfTheDay.title}</h4>
                                            <p style="font-family: Georgia, 'Times New Roman', Times, serif; font-size: 16px; color: #333333; line-height: 1.6; margin-bottom: 15px;">${newsletter.promptOfTheDay.summary}</p>
                                            
                                            <p style="font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; color: #666666; margin-bottom: 8px;">Three example prompts:</p>
                                            <ul style="list-style-type: disc; margin: 0 0 15px 20px; padding: 0;">
                                                ${newsletter.promptOfTheDay.examplePrompts.map(prompt => `
                                                    <li style="font-family: Georgia, 'Times New Roman', Times, serif; font-size: 16px; color: #333333; line-height: 1.6; margin-bottom: 5px;">${prompt}</li>
                                                `).join('')}
                                            </ul>

                                            <p style="font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; color: #666666; margin-bottom: 8px;">Prompt Code:</p>
                                            <div style="${promptCodeContainerStyle}">
                                                ${parsePromptCodeForEmail(newsletter.promptOfTheDay.promptCode)}
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                                ` : ''}

                                <hr style="border: 0; border-top: 1px solid #E0E0E0; margin: 24px 0;">

                                <!-- Professional Essentials -->
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td style="${footerTextStyle}">
                                            <p style="margin: 0 0 8px 0;">© 2024 AI for PI</p>
                                            <p style="margin: 0 0 8px 0;">This newsletter was curated and generated with the assistance of AI.</p>
                                            <p style="margin: 0;">
                                                <a href="mailto:shayisa@gmail.com?subject=UNSUBSCRIBE" target="_blank" style="${footerLinkStyle}">Unsubscribe</a> | 
                                                <a href="mailto:shayisa@gmail.com" target="_blank" style="${footerLinkStyle}">Contact Us</a>
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