
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { withRetry } from "../utils/retry";

// The Gemini API Key is provided by the execution environment.
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

const newsletterGenerationModel = 'gemini-2.5-flash';
const imageModel = 'gemini-2.5-flash-image';

const getAudienceDescription = (audience: string[]): string => {
    const audienceMap: Record<string, string> = {
        academics: "- Forensic anthropology and digital/computational archeology professors.",
        business: "- Business administrators and leaders upskilling in AI.",
        analysts: "- Business analytics analysts seeking new ways to extract intelligence from structured and unstructured data lakes."
    };

    if (audience.length === 0 || audience.length === 3) {
        return `
- Forensic anthropology and digital/computational archeology professors teaching university courses.
- Business administrators and leaders looking to upskill their AI knowledge to maintain career goals and improve efficiency.
- Business analytics analysts seeking new ways to extract intelligence from structured and unstructured data lakes.
        `;
    }
    
    return audience.map(key => audienceMap[key]).join('\n');
};

const getFlavorInstructions = (flavors: string[]): string => {
    if (flavors.length === 0) return '';

    const flavorMap: Record<string, string> = {
        includeHumor: "- You may sprinkle in one or two instances of light-hearted, clever humor where appropriate, without undermining the main tone.",
        useSlang: "- You may incorporate some modern, conversational slang to make the content feel more relatable and authentic.",
        useJargon: "- You should incorporate relevant technical jargon where it adds precision and is appropriate for the expert audience.",
        useAnalogies: "- You should use relatable analogies and simple metaphors to explain complex technical concepts.",
        citeData: "- Wherever possible, you should cite specific data points, statistics, or findings to add authority and credibility to your points."
    };

    const instructions = flavors.map(key => flavorMap[key]).filter(Boolean);

    if (instructions.length === 0) return '';

    return `
    
    Additionally, adhere to the following stylistic instructions:
    ${instructions.join('\n')}
    `;
};

const searchGuidance = `\nWhen conducting your web search using the googleSearch tool, you MUST prioritize information from reputable, high-quality sources. Your search should focus on major tech news sites (like TechCrunch AI), official AI research blogs (like OpenAI, Google DeepMind), academic publications, and domain-specific resources for forensics and archaeology. The goal is to find the most relevant, accurate, and current information to fulfill the user's request.`;


const generateNewsletterContentInternal = async (topics: string[], audience: string[], tone: string, flavors: string[], imageStyle: string): Promise<GenerateContentResponse> => {
  const audienceDescription = getAudienceDescription(audience);
  const flavorInstructions = getFlavorInstructions(flavors);
  
  const imageStyleMap: Record<string, string> = {
      photorealistic: 'photorealistic',
      vector: 'vector illustration',
      watercolor: 'watercolor painting',
      pixel: 'pixel art',
      minimalist: 'minimalist line art',
  };
  const styleDescription = imageStyleMap[imageStyle] || 'photorealistic';

  const prompt = `
    You are an expert AI researcher and newsletter writer. Your task is to scour the internet for the latest AI-related how-tos and new AI tools based on the following topic(s): "${topics.join(', ')}".

    Your newsletter has a very specific and diverse audience:
    ${audienceDescription}
    
    You MUST tailor the content, examples, and language to be relevant and valuable to the specified group(s).
    
    The primary tone of the newsletter must be strictly ${tone}. It should be reflected in the subject, introduction, section content, and conclusion.
    ${flavorInstructions}
    
    When you find relevant web pages, you MUST embed hyperlinks directly within the text of the 'content' field for each section using HTML \`<a>\` tags. For example: \`<a href='URL' target="_blank" rel="noopener noreferrer">this new tool</a>\`.
    
    The final output MUST be a valid JSON object. Do not include any text outside of the JSON object, including markdown backticks.
    The JSON object should have the following structure:
    { 
      "subject": "A catchy email subject line", 
      "introduction": "A brief, welcoming introduction to the newsletter, acknowledging the diverse audience. This must be plain text, without any HTML tags.", 
      "sections": [ 
        { 
          "title": "Title for this section (e.g., a specific tool or how-to)", 
          "content": "A detailed but easy-to-understand explanation of the tool or how-to guide. Explain what it does and how to use it. This content MUST include inline HTML \`<a>\` tags linking to the original sources or examples. The text should be formatted with HTML paragraph tags \`<p>\` for readability.", 
          "imagePrompt": "A simple, descriptive prompt for an AI image generator to create a relevant image for this section. The final image MUST be in a ${styleDescription} style." 
        } 
      ], 
      "conclusion": "A concluding paragraph. This must be plain text, without any HTML tags." 
    }
  ` + searchGuidance;

  const result = await ai.models.generateContent({
    model: newsletterGenerationModel,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  return result;
};

const generateTopicSuggestionsInternal = async (audience: string[]): Promise<GenerateContentResponse> => {
  const audienceDescription = getAudienceDescription(audience);
  const prompt = `
    Based on the latest trends and news in AI, generate a list of 10 compelling newsletter topic suggestions.
    The newsletter is for a specific audience:
    ${audienceDescription}

    The topics should be relevant, interesting, and engaging for this specific audience.
    
    The final output MUST be a valid JSON object. Do not include any text outside of the JSON object.
    The JSON object should be an array of 10 strings.
    Example format:
    [
      "AI in Cold Case Analysis: A New Frontier for Forensic Anthropology",
      "Upskilling for the AI Era: Essential Tools for Business Leaders",
      "Automated Data Storytelling with Generative AI for Analysts"
    ]
  ` + searchGuidance;

  const result = await ai.models.generateContent({
    model: newsletterGenerationModel,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  return result;
};

const generateTrendingTopicsInternal = async (audience: string[]): Promise<GenerateContentResponse> => {
    const audienceDescription = getAudienceDescription(audience);
    const prompt = `
    You are an AI news analyst. Your task is to identify and summarize 2-3 of the most new, trending, and compelling developments in the world of AI right now.
    Your summary MUST be tailored for a specific audience:
    ${audienceDescription}
    
    For each development, provide a concise title and a brief, easy-to-understand summary explaining what it is and why it's important for this audience.
    
    The final output MUST be a valid JSON array of objects. Do not include any text outside of the JSON object, including markdown backticks.
    Each object in the array should have the following structure:
    { 
      "title": "A concise title for the trending topic", 
      "summary": "A brief summary of the topic and its relevance to the audience."
    }
    
    Example format:
    [
        {
            "title": "Generative AI in Archaeological Site Reconstruction",
            "summary": "Recent advancements in generative models are now allowing researchers to create detailed 3D reconstructions of historical sites from fragmented data, a breakthrough for computational archeology."
        },
        {
            "title": "AI-Powered Automation for Business Process Optimization",
            "summary": "New AI tools are emerging that can analyze and automate complex business workflows, enabling leaders to significantly improve efficiency and reduce operational costs."
        }
    ]
  ` + searchGuidance;

  const result = await ai.models.generateContent({
    model: newsletterGenerationModel,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  return result;
};


const generateImageInternal = async (prompt: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: imageModel,
    contents: {
      parts: [
        {
          text: prompt,
        },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });

  const firstPart = response.candidates?.[0]?.content?.parts?.[0];
  if (firstPart && firstPart.inlineData) {
    return firstPart.inlineData.data;
  }
  throw new Error("API did not return image data. The prompt may have been blocked.");
};

const editImageInternal = async (base64ImageData: string, mimeType: string, prompt: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: imageModel,
        contents: {
          parts: [
            {
              inlineData: {
                data: base64ImageData,
                mimeType: mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });

      const firstPart = response.candidates?.[0]?.content?.parts?.[0];
      if (firstPart && firstPart.inlineData) {
        return firstPart.inlineData.data;
      }
      throw new Error("API did not return edited image data. The prompt may have been blocked.");
};

export const generateNewsletterContent = withRetry(generateNewsletterContentInternal);
export const generateTopicSuggestions = withRetry(generateTopicSuggestionsInternal);
export const generateTrendingTopics = withRetry(generateTrendingTopicsInternal);
export const generateImage = withRetry(generateImageInternal);
export const editImage = withRetry(editImageInternal);
