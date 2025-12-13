// utils/stringUtils.ts

/**
 * Attempts to extract a strict JSON string from a raw string,
 * handling markdown code block wrappers and discarding leading/trailing non-JSON text.
 * This is useful when an LLM is expected to output JSON but might include
 * markdown formatting or conversational filler.
 * @param rawStr The raw string potentially containing JSON.
 * @returns A string that is hopefully valid JSON, or the most relevant part of it.
 */
export const extractStrictJson = (rawStr: string): string => {
    let cleanedStr = rawStr.trim();

    // First, attempt to strip markdown code block wrappers
    // This looks for '```json' or '```' at the beginning and '```' at the end.
    if (cleanedStr.startsWith('```json')) {
        // Ensure there's a closing '```' and enough length to remove it
        if (cleanedStr.endsWith('```') && cleanedStr.length >= 10) { // '```json' (7) + '```' (3) = 10 minimum
            cleanedStr = cleanedStr.substring(7, cleanedStr.length - 3).trim();
        } else {
            // If it starts with '```json' but doesn't end cleanly, remove only the start
            cleanedStr = cleanedStr.substring(7).trim();
        }
    } else if (cleanedStr.startsWith('```')) {
        // Ensure there's a closing '```' and enough length to remove it
        if (cleanedStr.endsWith('```') && cleanedStr.length >= 6) { // '```' (3) + '```' (3) = 6 minimum
            cleanedStr = cleanedStr.substring(3, cleanedStr.length - 3).trim();
        } else {
            // If it starts with '```' but doesn't end cleanly, remove only the start
            cleanedStr = cleanedStr.substring(3).trim();
        }
    }

    // Now, try to find the outermost JSON structure (object or array)
    const firstBracket = cleanedStr.indexOf('[');
    const firstBrace = cleanedStr.indexOf('{');

    let startIndex = -1;
    let endIndex = -1;

    // Determine if it's an array or object, and find its start index
    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) { // Starts with an array
        startIndex = firstBracket;
        endIndex = cleanedStr.lastIndexOf(']');
    } else if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) { // Starts with an object
        startIndex = firstBrace;
        endIndex = cleanedStr.lastIndexOf('}');
    }

    // If both a valid start and end index are found, and end is after start
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        return cleanedStr.substring(startIndex, endIndex + 1);
    }

    // If no clear JSON structure found, or extraction failed, return the cleaned string
    // JSON.parse will then attempt to parse this, and if it fails, the error will be caught.
    return cleanedStr;
};
