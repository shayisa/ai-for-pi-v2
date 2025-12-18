
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PromptOfTheDay, PromptImportResult, PromptImportTemplate } from '../types';
import type { SavedPrompt } from '../services/promptClientService';
import { CodeIcon, SaveIcon, XIcon, CheckIcon, BookOpenIcon, ChevronDownIcon, LinkIcon } from './IconComponents';
import { FileDropZone } from './FileDropZone';

interface PromptOfTheDayEditorProps {
    initialPrompt: PromptOfTheDay | null;
    onSave: (prompt: PromptOfTheDay | null) => void;
    onSaveToLibrary?: (prompt: PromptOfTheDay) => Promise<void>;
    // Phase 9a: Load from library support
    savedPrompts?: SavedPrompt[];
    onLoadFromLibrary?: (prompt: SavedPrompt) => void;
    // Phase 11: Import from URL/File support
    onImportFromUrl?: (url: string) => Promise<PromptImportResult>;
    onImportFromFile?: (file: File) => Promise<PromptImportResult>;
    isImporting?: boolean;
    importError?: string | null;
    templates?: PromptImportTemplate[];
}

export const PromptOfTheDayEditor: React.FC<PromptOfTheDayEditorProps> = ({
    initialPrompt,
    onSave,
    onSaveToLibrary,
    savedPrompts,
    onLoadFromLibrary,
    onImportFromUrl,
    onImportFromFile,
    isImporting = false,
    importError = null,
    templates = [],
}) => {
    const [fullPromptText, setFullPromptText] = useState('');
    const [title, setTitle] = useState('');
    const [summary, setSummary] = useState('');
    const [examplePrompts, setExamplePrompts] = useState<string[]>(['', '', '']); // Start with 3 empty fields
    const [promptCode, setPromptCode] = useState('');
    const [parseStatus, setParseStatus] = useState<'idle' | 'success'>('idle');
    const [libraryStatus, setLibraryStatus] = useState<'idle' | 'saving' | 'success'>('idle');
    // Phase 11: Import state
    const [importUrl, setImportUrl] = useState('');
    const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [localImportError, setLocalImportError] = useState<string | null>(null);

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

        // 1. Extract Title (H1 markdown - with or without bold)
        // Try bold format first: # **Title**
        let titleRegex = new RegExp('^#\\s*\\*\\*(.*?)\\*\\*', 'm');
        let titleMatch = text.match(titleRegex);

        // Fallback to plain format: # Title
        if (!titleMatch) {
            titleRegex = new RegExp('^#\\s+(.+?)(?:\\s*$|\\n)', 'm');
            titleMatch = text.match(titleRegex);
        }

        console.log("Title match:", titleMatch);
        if (titleMatch && titleMatch[1]) {
            parsedTitle = titleMatch[1].trim();
        }

        // 2. Extract Summary (between title and example prompts section)
        // Match variations: "**Three example prompts:**", "**Three example user prompts:**", etc.
        const examplePromptsMarkerRegex = /\*\*Three example.*?prompts.*?:\*\*/i;
        const markerMatch = text.match(examplePromptsMarkerRegex);
        const summaryEndIndex = markerMatch ? text.indexOf(markerMatch[0]) : -1;

        let titleStartIndex = -1;
        if (parsedTitle && titleMatch && titleMatch[0]) {
            titleStartIndex = text.indexOf(titleMatch[0]) + titleMatch[0].length;
        }

        console.log("Summary end index:", summaryEndIndex);
        console.log("Title start index for summary:", titleStartIndex);
        console.log("Example prompts marker found:", markerMatch ? markerMatch[0] : null);

        if (summaryEndIndex !== -1 && titleStartIndex !== -1 && titleStartIndex < summaryEndIndex) {
            parsedSummary = text.substring(titleStartIndex, summaryEndIndex).trim();
            // Remove any leading/trailing newlines or spaces
            parsedSummary = parsedSummary.replace(/^\s+|\s+$/g, '');
        } else if (summaryEndIndex !== -1) { // Fallback if title not found but summary end is clear
            parsedSummary = text.substring(0, summaryEndIndex).trim();
        }
        console.log("Parsed Summary:", parsedSummary);


        // 3. Extract Example Prompts
        const examplePromptsSectionStartIndex = summaryEndIndex;
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

        // Immediately save the parsed prompt
        const cleanedExamplePrompts = finalExamplePrompts.filter(p => p.trim() !== '');
        if (parsedTitle.trim() || parsedSummary.trim() || cleanedExamplePrompts.length > 0 || parsedPromptCode.trim()) {
            onSave({
                title: parsedTitle.trim(),
                summary: parsedSummary.trim(),
                examplePrompts: cleanedExamplePrompts,
                promptCode: parsedPromptCode.trim(),
            });
            // Show success feedback
            setParseStatus('success');
            setTimeout(() => setParseStatus('idle'), 2000);
        }
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

    const handleSaveToLibrary = async () => {
        if (!onSaveToLibrary) return;

        const cleanedExamplePrompts = examplePrompts.filter(p => p.trim() !== '');
        if (!title.trim() && !promptCode.trim()) {
            console.log('Cannot save to library: title and prompt code are both empty');
            return;
        }

        setLibraryStatus('saving');
        try {
            await onSaveToLibrary({
                title: title.trim(),
                summary: summary.trim(),
                examplePrompts: cleanedExamplePrompts,
                promptCode: promptCode.trim(),
            });
            setLibraryStatus('success');
            setTimeout(() => setLibraryStatus('idle'), 2000);
        } catch (error) {
            console.error('Failed to save to library:', error);
            setLibraryStatus('idle');
        }
    };

    // Phase 11: Import handlers
    const applyImportResult = (result: PromptImportResult) => {
        if (result.fields) {
            setTitle(result.fields.title);
            setSummary(result.fields.summary);
            const examples = result.fields.examplePrompts;
            // Ensure at least 3 fields
            setExamplePrompts([...examples, ...Array(Math.max(0, 3 - examples.length)).fill('')].slice(0, Math.max(3, examples.length)));
            setPromptCode(result.fields.promptCode);

            // Save to newsletter context
            const cleanedExamplePrompts = examples.filter(p => p.trim() !== '');
            if (result.fields.title.trim() || result.fields.promptCode.trim()) {
                onSave({
                    title: result.fields.title.trim(),
                    summary: result.fields.summary.trim(),
                    examplePrompts: cleanedExamplePrompts,
                    promptCode: result.fields.promptCode.trim(),
                });
            }
        }
    };

    const handleImportFromUrl = async () => {
        if (!onImportFromUrl || !importUrl.trim()) return;

        setLocalImportError(null);
        setImportStatus('idle');

        try {
            const result = await onImportFromUrl(importUrl.trim());
            if (result.success) {
                applyImportResult(result);
                setImportUrl('');
                setImportStatus('success');
                setTimeout(() => setImportStatus('idle'), 2000);
            } else {
                setLocalImportError(result.error || 'Import failed');
                setImportStatus('error');
                // Still apply partial results if available
                if (result.fields?.title || result.fields?.promptCode) {
                    applyImportResult(result);
                }
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Import failed';
            setLocalImportError(msg);
            setImportStatus('error');
        }
    };

    const handleImportFromFile = async (file: File) => {
        if (!onImportFromFile) return;

        setLocalImportError(null);
        setImportStatus('idle');

        try {
            const result = await onImportFromFile(file);
            if (result.success) {
                applyImportResult(result);
                setImportStatus('success');
                setTimeout(() => setImportStatus('idle'), 2000);
            } else {
                setLocalImportError(result.error || 'Import failed');
                setImportStatus('error');
                // Still apply partial results if available
                if (result.fields?.title || result.fields?.promptCode) {
                    applyImportResult(result);
                }
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Import failed';
            setLocalImportError(msg);
            setImportStatus('error');
        }
    };

    const hasContent = title.trim() || summary.trim() || examplePrompts.some(p => p.trim() !== '') || promptCode.trim();
    const displayImportError = importError || localImportError;

    return (
        <div className="bg-paper border border-border-subtle">
            <div className="flex items-baseline gap-3 mb-4">
                <span className="font-sans text-overline text-slate uppercase tracking-widest">Optional</span>
                <h2 className="font-display text-h3 text-ink flex items-center gap-2">
                    <CodeIcon className="h-6 w-6" />
                    Prompt of the Day
                </h2>
            </div>
            <p className="font-serif text-body text-charcoal mb-6">Include a curated prompt for your audience in the newsletter.</p>

            {/* Phase 9a: Load from Library Section */}
            {savedPrompts && savedPrompts.length > 0 && onLoadFromLibrary && (
                <div className="mb-6 border-b border-border-subtle pb-6">
                    <h3 className="font-sans text-ui font-medium text-ink mb-2">Load from Library</h3>
                    <p className="font-sans text-caption text-slate mb-3">
                        Select a saved prompt to load into the editor.
                    </p>
                    <div className="relative">
                        <select
                            onChange={(e) => {
                                const selected = savedPrompts.find(p => p.id === e.target.value);
                                if (selected && onLoadFromLibrary) {
                                    onLoadFromLibrary(selected);
                                }
                                // Reset the select to show placeholder again
                                e.target.value = '';
                            }}
                            className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink appearance-none cursor-pointer hover:border-slate transition-colors focus:outline-none focus:border-ink"
                            defaultValue=""
                        >
                            <option value="" disabled>Select a saved prompt...</option>
                            {savedPrompts.map((prompt) => (
                                <option key={prompt.id} value={prompt.id}>
                                    {prompt.title}
                                </option>
                            ))}
                        </select>
                        <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate pointer-events-none" />
                    </div>
                </div>
            )}

            {/* Phase 11: Import from URL/File Section */}
            {(onImportFromUrl || onImportFromFile) && (
                <div className="mb-6 border-b border-border-subtle pb-6">
                    <h3 className="font-sans text-ui font-medium text-ink mb-2">Import from URL or File</h3>
                    <p className="font-sans text-caption text-slate mb-4">
                        Import a prompt from a web page or document. Supports PDF, Word, PowerPoint, Excel, and text files.
                    </p>

                    {/* URL Import */}
                    {onImportFromUrl && (
                        <div className="mb-4">
                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate" />
                                    <input
                                        type="url"
                                        value={importUrl}
                                        onChange={(e) => setImportUrl(e.target.value)}
                                        placeholder="https://example.com/prompt"
                                        disabled={isImporting}
                                        className="w-full bg-pearl border border-border-subtle pl-9 pr-3 py-2 font-sans text-ui text-ink focus:outline-none focus:border-ink transition-colors disabled:opacity-50"
                                    />
                                </div>
                                <button
                                    onClick={handleImportFromUrl}
                                    disabled={isImporting || !importUrl.trim()}
                                    className={`flex items-center justify-center gap-2 font-sans text-ui py-2 px-4 transition-all duration-200 min-w-[100px] ${
                                        importStatus === 'success'
                                            ? 'bg-green-600 text-paper'
                                            : 'bg-ink text-paper hover:bg-charcoal disabled:bg-silver disabled:text-slate disabled:cursor-not-allowed'
                                    }`}
                                >
                                    <AnimatePresence mode="wait">
                                        <motion.span
                                            key={isImporting ? 'loading' : importStatus}
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -5 }}
                                            transition={{ duration: 0.15 }}
                                            className="flex items-center gap-2"
                                        >
                                            {isImporting ? (
                                                'Importing...'
                                            ) : importStatus === 'success' ? (
                                                <>
                                                    <CheckIcon className="h-4 w-4" />
                                                    <span>Imported!</span>
                                                </>
                                            ) : (
                                                'Import'
                                            )}
                                        </motion.span>
                                    </AnimatePresence>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* File Import */}
                    {onImportFromFile && (
                        <FileDropZone
                            onFileSelect={handleImportFromFile}
                            isLoading={isImporting}
                            disabled={isImporting}
                            compact
                        />
                    )}

                    {/* Import Error Display */}
                    {displayImportError && (
                        <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="font-sans text-caption text-coral mt-3"
                        >
                            {displayImportError}
                        </motion.p>
                    )}

                    {/* Import Success with partial warning */}
                    {importStatus === 'success' && (
                        <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="font-sans text-caption text-green-600 mt-3"
                        >
                            Prompt imported successfully. Review the fields below.
                        </motion.p>
                    )}
                </div>
            )}

            <div className="mb-6 border-b border-border-subtle pb-6">
                <h3 className="font-sans text-ui font-medium text-ink mb-2">Paste Full Prompt</h3>
                <p className="font-sans text-caption text-slate mb-3">Paste the entire prompt text (including title, summary, examples, and code block) here, then click "Parse & Save" to extract and save all fields at once.</p>
                <textarea
                    id="full-prompt-paste"
                    value={fullPromptText}
                    onChange={(e) => setFullPromptText(e.target.value)}
                    placeholder="Paste full prompt text here..."
                    rows={8}
                    className="w-full bg-pearl border border-border-subtle p-3 focus:outline-none focus:border-ink transition-colors resize-y font-mono text-sm text-ink mb-3"
                />
                <button
                    onClick={parseFullPrompt}
                    disabled={!fullPromptText.trim()}
                    className={`flex items-center justify-center gap-2 font-sans text-ui py-2 px-6 transition-all duration-200 ${
                        parseStatus === 'success'
                            ? 'bg-green-600 text-paper'
                            : 'bg-ink text-paper hover:bg-charcoal disabled:bg-silver disabled:text-slate disabled:cursor-not-allowed'
                    }`}
                >
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={parseStatus}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center gap-2"
                        >
                            {parseStatus === 'success' ? (
                                <>
                                    <CheckIcon className="h-5 w-5" />
                                    <span>Saved!</span>
                                </>
                            ) : (
                                <>
                                    <SaveIcon className="h-5 w-5" />
                                    <span>Parse & Save</span>
                                </>
                            )}
                        </motion.span>
                    </AnimatePresence>
                </button>
            </div>


            <div className="space-y-6">
                <div>
                    <label htmlFor="prompt-title" className="block font-sans text-ui font-medium text-ink mb-1">
                        Title
                    </label>
                    <input
                        type="text"
                        id="prompt-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Strategic Leverage Lab"
                        className="w-full bg-pearl border border-border-subtle px-3 py-2 focus:outline-none focus:border-ink transition-colors font-sans text-ui text-ink"
                    />
                </div>

                <div>
                    <label htmlFor="prompt-summary" className="block font-sans text-ui font-medium text-ink mb-1">
                        Summary of what the prompt does
                    </label>
                    <textarea
                        id="prompt-summary"
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        placeholder="e.g., This prompt turns AI into a high-level decision and opportunity analysis framework..."
                        rows={4}
                        className="w-full bg-pearl border border-border-subtle px-3 py-2 focus:outline-none focus:border-ink transition-colors resize-y font-serif text-body text-ink"
                    />
                </div>

                <div>
                    <label className="block font-sans text-ui font-medium text-ink mb-1">
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
                                    className="flex-grow bg-pearl border border-border-subtle px-3 py-2 focus:outline-none focus:border-ink transition-colors font-sans text-ui text-ink"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <label htmlFor="prompt-code" className="block font-sans text-ui font-medium text-ink mb-1">
                        Prompt Code
                    </label>
                    <textarea
                        id="prompt-code"
                        value={promptCode}
                        onChange={(e) => setPromptCode(e.target.value)}
                        placeholder="e.g., <role>You are a strategist...</role><context>...</context>"
                        rows={10}
                        className="w-full bg-pearl border border-border-subtle px-3 py-2 focus:outline-none focus:border-ink transition-colors font-mono text-sm resize-y text-ink"
                    />
                    <p className="font-sans text-caption text-slate mt-1">Use XML-like tags (e.g., &lt;role&gt;, &lt;context&gt;) for structured prompts.</p>
                </div>
            </div>

            <div className="flex justify-end gap-4 mt-6 border-t border-border-subtle pt-6">
                {hasContent && (
                    <button
                        onClick={handleClearPrompt}
                        className="flex items-center gap-2 font-sans text-ui text-slate hover:text-editorial-red font-medium py-2 px-4 transition-colors"
                    >
                        <XIcon className="h-4 w-4" />
                        Clear Prompt
                    </button>
                )}
                {hasContent && onSaveToLibrary && (
                    <button
                        onClick={handleSaveToLibrary}
                        disabled={libraryStatus === 'saving'}
                        className={`flex items-center justify-center gap-2 font-sans text-ui py-2 px-4 transition-all duration-200 ${
                            libraryStatus === 'success'
                                ? 'bg-green-600 text-paper'
                                : 'border border-ink text-ink hover:bg-ink hover:text-paper disabled:border-silver disabled:text-slate disabled:cursor-not-allowed'
                        }`}
                    >
                        <AnimatePresence mode="wait">
                            <motion.span
                                key={libraryStatus}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                transition={{ duration: 0.15 }}
                                className="flex items-center gap-2"
                            >
                                {libraryStatus === 'success' ? (
                                    <>
                                        <CheckIcon className="h-4 w-4" />
                                        <span>Saved!</span>
                                    </>
                                ) : libraryStatus === 'saving' ? (
                                    <span>Saving...</span>
                                ) : (
                                    <>
                                        <BookOpenIcon className="h-4 w-4" />
                                        <span>Save to Library</span>
                                    </>
                                )}
                            </motion.span>
                        </AnimatePresence>
                    </button>
                )}
                <button
                    onClick={handleSavePrompt}
                    className="flex items-center justify-center gap-2 bg-ink text-paper hover:bg-charcoal disabled:bg-silver disabled:text-slate disabled:cursor-not-allowed font-sans text-ui py-3 px-6 transition-colors"
                >
                    <SaveIcon className="h-5 w-5" />
                    <span>{hasContent ? 'Update Prompt' : 'Add Prompt'}</span>
                </button>
            </div>
        </div>
    );
};
