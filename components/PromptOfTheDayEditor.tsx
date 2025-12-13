
import React, { useState, useEffect } from 'react';
import type { PromptOfTheDay } from '../types';
import { CodeIcon, SaveIcon, XIcon } from './IconComponents';

interface PromptOfTheDayEditorProps {
    initialPrompt: PromptOfTheDay | null;
    onSave: (prompt: PromptOfTheDay | null) => void;
}

export const PromptOfTheDayEditor: React.FC<PromptOfTheDayEditorProps> = ({ initialPrompt, onSave }) => {
    const [fullPromptText, setFullPromptText] = useState('');
    const [title, setTitle] = useState('');
    const [summary, setSummary] = useState('');
    const [examplePrompts, setExamplePrompts] = useState<string[]>(['', '', '']); // Start with 3 empty fields
    const [promptCode, setPromptCode] = useState('');

    useEffect(() => {
        if (initialPrompt) {
            setTitle(initialPrompt.title);
            setSummary(initialPrompt.summary);
            // Ensure at least 3 fields, pad with empty if less
            setExamplePrompts([...initialPrompt.examplePrompts, ...Array(Math.max(0, 3 - initialPrompt.examplePrompts.length)).fill('')].slice(0, Math.max(3, initialPrompt.examplePrompts.length)));
            setPromptCode(initialPrompt.promptCode);
        } else {
            setTitle('');
            setSummary('');
            setExamplePrompts(['', '', '']);
            setPromptCode('');
        }
    }, [initialPrompt]);

    const handleExamplePromptChange = (index: number, value: string) => {
        const newPrompts = [...examplePrompts];
        newPrompts[index] = value;
        setExamplePrompts(newPrompts);
    };

    const parseFullPrompt = () => {
        const text = fullPromptText.trim();
        if (!text) {
            console.log("No text to parse.");
            return;
        }

        let parsedTitle = '';
        let parsedSummary = '';
        const parsedExamplePrompts: string[] = [];
        let parsedPromptCode = '';

        console.log("Starting parse for text length:", text.length);

        // 1. Extract Title (H1 markdown)
        const titleRegex = new RegExp('^#\\s*\\*\\*(.*?)\\*\\*', 'm');
        const titleMatch = text.match(titleRegex);
        console.log("Title match:", titleMatch);
        if (titleMatch && titleMatch[1]) {
            parsedTitle = titleMatch[1].trim();
        }

        // 2. Extract Summary (between title and "**Three example prompts:**")
        const summaryHeadingMarker = '**Three example prompts:**';
        const summaryEndIndex = text.indexOf(summaryHeadingMarker);
        
        let titleStartIndex = -1;
        if (parsedTitle && titleMatch && titleMatch[0]) {
            titleStartIndex = text.indexOf(titleMatch[0]) + titleMatch[0].length;
        }

        console.log("Summary end index:", summaryEndIndex);
        console.log("Title start index for summary:", titleStartIndex);

        if (summaryEndIndex !== -1 && titleStartIndex !== -1 && titleStartIndex < summaryEndIndex) {
            parsedSummary = text.substring(titleStartIndex, summaryEndIndex).trim();
            // Remove any leading/trailing newlines or spaces
            parsedSummary = parsedSummary.replace(/^\s+|\s+$/g, '');
        } else if (summaryEndIndex !== -1) { // Fallback if title not found but summary end is clear
            parsedSummary = text.substring(0, summaryEndIndex).trim();
        }
        console.log("Parsed Summary:", parsedSummary);


        // 3. Extract Example Prompts
        const examplePromptsSectionStartIndex = text.indexOf(summaryHeadingMarker);
        if (examplePromptsSectionStartIndex !== -1) {
            const codeBlockStartIndex = text.indexOf('```', examplePromptsSectionStartIndex);
            const examplePromptsSection = codeBlockStartIndex !== -1
                ? text.substring(examplePromptsSectionStartIndex, codeBlockStartIndex)
                : text.substring(examplePromptsSectionStartIndex);

            // Regex to match "1. " followed by a quoted string (handles smart and standard quotes)
            const examplePromptRegex = new RegExp('\\d+\\.\\s*[“"](.*?)[”"]', 'g'); 
            let match;
            console.log("Example Prompts section content:", examplePromptsSection);
            while ((match = examplePromptRegex.exec(examplePromptsSection)) !== null) {
                // We want the whole matched string, including the number and quotes
                parsedExamplePrompts.push(match[0].trim());
            }
        }
        console.log("Parsed Example Prompts:", parsedExamplePrompts);
        
        // Ensure at least 3 example prompt fields are set
        const finalExamplePrompts = [...parsedExamplePrompts, ...Array(Math.max(0, 3 - parsedExamplePrompts.length)).fill('')].slice(0, Math.max(3, parsedExamplePrompts.length));

        // 4. Extract Prompt Code (first markdown code block)
        const codeBlockRegex = new RegExp('```\\s*([\\s\\S]*?)```');
        const codeMatch = text.match(codeBlockRegex);
        console.log("Code block match:", codeMatch);
        if (codeMatch && codeMatch[1]) {
            parsedPromptCode = codeMatch[1].trim();
        }
        console.log("Parsed Prompt Code:", parsedPromptCode);
        
        // Update states after all parsing is done
        setTitle(parsedTitle);
        setSummary(parsedSummary);
        setExamplePrompts(finalExamplePrompts);
        setPromptCode(parsedPromptCode);
        setFullPromptText(''); // Clear the paste area after parsing
        console.log("Parsing complete. State updated.");
    };


    const handleSavePrompt = () => {
        const cleanedExamplePrompts = examplePrompts.filter(p => p.trim() !== '');

        if (title.trim() || summary.trim() || cleanedExamplePrompts.length > 0 || promptCode.trim()) {
            onSave({
                title: title.trim(),
                summary: summary.trim(),
                examplePrompts: cleanedExamplePrompts,
                promptCode: promptCode.trim(),
            });
        } else {
            // If all fields are empty, treat as clearing the prompt of the day
            onSave(null);
        }
    };

    const handleClearPrompt = () => {
        setTitle('');
        setSummary('');
        setExamplePrompts(['', '', '']);
        setPromptCode('');
        setFullPromptText('');
        onSave(null);
    };

    const hasContent = title.trim() || summary.trim() || examplePrompts.some(p => p.trim() !== '') || promptCode.trim();

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-border-light p-6 md:p-8">
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-light-blue to-accent-yellow mb-4 flex items-center gap-2">
                <CodeIcon className="h-6 w-6" />
                Prompt of the Day <span className="text-secondary-text font-normal text-lg">(Optional)</span>
            </h2>
            <p className="text-secondary-text mb-6">Include a curated prompt for your audience in the newsletter.</p>
            
            <div className="mb-6 border-b border-border-light pb-6">
                <h3 className="text-lg font-semibold text-primary-text mb-2">Paste Full Prompt</h3>
                <p className="text-sm text-secondary-text mb-3">Paste the entire prompt text (including title, summary, examples, and code block) here, then click "Parse Prompt".</p>
                <textarea
                    id="full-prompt-paste"
                    value={fullPromptText}
                    onChange={(e) => setFullPromptText(e.target.value)}
                    placeholder="Paste full prompt text here..."
                    rows={8}
                    className="w-full bg-gray-50 border border-border-light rounded-lg p-2 focus:ring-2 focus:ring-accent-yellow focus:outline-none transition resize-y font-mono text-sm text-primary-text mb-3"
                />
                <button
                    onClick={parseFullPrompt}
                    disabled={!fullPromptText.trim()}
                    className="flex items-center justify-center gap-2 bg-accent-light-blue hover:bg-opacity-90 disabled:bg-accent-light-blue/40 disabled:text-secondary-text disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition duration-200"
                >
                    <SaveIcon className="h-5 w-5 rotate-90" /> {/* Using save icon rotated to suggest import/paste */}
                    <span>Parse Prompt</span>
                </button>
            </div>


            <div className="space-y-6">
                <div>
                    <label htmlFor="prompt-title" className="block text-sm font-medium text-primary-text mb-1">
                        Title
                    </label>
                    <input
                        type="text"
                        id="prompt-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Strategic Leverage Lab"
                        className="w-full bg-gray-50 border border-border-light rounded-lg p-2 focus:ring-2 focus:ring-accent-light-blue focus:outline-none transition text-primary-text"
                    />
                </div>

                <div>
                    <label htmlFor="prompt-summary" className="block text-sm font-medium text-primary-text mb-1">
                        Summary of what the prompt does
                    </label>
                    <textarea
                        id="prompt-summary"
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        placeholder="e.g., This prompt turns AI into a high-level decision and opportunity analysis framework..."
                        rows={4}
                        className="w-full bg-gray-50 border border-border-light rounded-lg p-2 focus:ring-2 focus:ring-accent-light-blue focus:outline-none transition resize-y text-primary-text"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-primary-text mb-1">
                        Three Example Prompts
                    </label>
                    <div className="space-y-2">
                        {examplePrompts.map((prompt, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={prompt}
                                    onChange={(e) => handleExamplePromptChange(index, e.target.value)}
                                    placeholder={`Example prompt ${index + 1}`}
                                    className="flex-grow bg-gray-50 border border-border-light rounded-lg p-2 focus:ring-2 focus:ring-accent-light-blue focus:outline-none transition text-primary-text"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <label htmlFor="prompt-code" className="block text-sm font-medium text-primary-text mb-1">
                        Prompt Code
                    </label>
                    <textarea
                        id="prompt-code"
                        value={promptCode}
                        onChange={(e) => setPromptCode(e.target.value)}
                        placeholder="e.g., <role>You are a strategist...</role><context>...</context>"
                        rows={10}
                        className="w-full bg-gray-50 border border-border-light rounded-lg p-2 focus:ring-2 focus:ring-accent-light-blue focus:outline-none transition font-mono text-sm resize-y text-primary-text"
                    />
                        <p className="text-xs text-secondary-text mt-1">Use XML-like tags (e.g., &lt;role&gt;, &lt;context&gt;) for structured prompts.</p>
                </div>
            </div>

            <div className="flex justify-end gap-4 mt-6 border-t border-border-light pt-6">
                {hasContent && (
                    <button
                        onClick={handleClearPrompt}
                        className="flex items-center gap-2 text-sm text-secondary-text hover:text-accent-salmon font-semibold py-2 px-4 rounded-lg transition duration-200"
                    >
                        <XIcon className="h-4 w-4" />
                        Clear Prompt
                    </button>
                )}
                <button
                    onClick={handleSavePrompt}
                    className="flex items-center justify-center gap-2 bg-accent-salmon hover:bg-opacity-90 disabled:bg-accent-salmon/40 disabled:text-secondary-text disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition duration-200 shadow-lg shadow-accent-salmon/30"
                >
                    <SaveIcon className="h-5 w-5" />
                    <span>{hasContent ? 'Update Prompt' : 'Add Prompt'}</span>
                </button>
            </div>
        </div>
    );
};
