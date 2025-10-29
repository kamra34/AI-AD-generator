import { GoogleGenAI, Type, VideoGenerationReferenceImage, VideoGenerationReferenceType } from "@google/genai";
import { VideoIdea, AspectRatio, RefinementSuggestions } from "../types";

const PRODUCT_DESCRIPTION_PLACEHOLDER = '{{PRODUCT_DESCRIPTION}}';
const FEATURES_PLACEHOLDER = '{{FEATURES}}';

const ideasPrompt = `
Based on the following product description, generate 3 creative and distinct promotional video ideas. Each time this prompt is called, generate completely new and unique ideas. Ensure the ideas are varied and not repetitive.
The product is a smart wall-hanging night light with advanced features.
${FEATURES_PLACEHOLDER}
For each idea, provide a catchy title, a short description, a summary of the visuals, and a concise, powerful prompt that could be used to generate a video with an AI model like Veo.

Product Description:
${PRODUCT_DESCRIPTION_PLACEHOLDER}

Return the response as a JSON object that adheres to the provided schema.
`;

const ideasSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'A catchy title for the video ad concept.',
      },
      description: {
        type: Type.STRING,
        description: 'A brief summary of the ad concept.',
      },
      visuals: {
        type: Type.STRING,
        description: 'A description of the key visual elements and scenes.',
      },
      promptForVideo: {
        type: Type.STRING,
        description: 'A concise and effective prompt for an AI video generation model.',
      },
    },
    required: ["title", "description", "visuals", "promptForVideo"],
  },
};

const refinementPrompt = `
You are an expert creative director for advertisements.
Based on the following video ad concept, generate highly creative and specific suggestions to refine the final video prompt.
For each category (video style, environment, lighting, additional details), provide 4 distinct and imaginative options that directly relate to the provided concept. Avoid generic suggestions.
Also, recommend an ideal video duration in seconds (an integer between 3 and 15) for a short, impactful social media ad.

Video Concept Title: {{TITLE}}
Video Concept Description: {{DESCRIPTION}}

Return the response as a JSON object that adheres to the provided schema. The suggestions must be unique and directly inspired by the video concept.
`;

const refinementSchema = {
  type: Type.OBJECT,
  properties: {
    styles: {
      type: Type.ARRAY,
      description: "An array of 4 distinct video style suggestions (e.g., 'Cinematic', 'Documentary', 'Minimalist').",
      items: { type: Type.STRING },
    },
    environments: {
      type: Type.ARRAY,
      description: "An array of 4 specific environment suggestions (e.g., 'A cozy bedroom with wooden furniture', 'A futuristic, smart home hallway').",
      items: { type: Type.STRING },
    },
    lightings: {
      type: Type.ARRAY,
      description: "An array of 4 descriptive lighting suggestions (e.g., 'Soft, diffused moonlight', 'Dynamic, warm light that follows movement').",
      items: { type: Type.STRING },
    },
    details: {
        type: Type.ARRAY,
        description: "An array of 4 suggestions for additional details or narrative elements (e.g., 'Show a close-up of the 3D-printed texture', 'A pet interacting with the lights').",
        items: { type: Type.STRING },
    },
    recommendedDuration: {
        type: Type.NUMBER,
        description: "The recommended duration of the video in seconds, as an integer between 3 and 15.",
    },
  },
  required: ["styles", "environments", "lightings", "details", "recommendedDuration"],
};


export async function generateVideoIdeas(description: string, features: string[]): Promise<VideoIdea[]> {
  // IMPORTANT: A new instance must be created for each call to ensure the latest API key is used.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const featureFocusText = features.length > 0
    ? `Please create video concepts that specifically highlight the following features: ${features.join(', ')}.`
    : '';

  const finalPrompt = ideasPrompt
    .replace(PRODUCT_DESCRIPTION_PLACEHOLDER, description)
    .replace(FEATURES_PLACEHOLDER, featureFocusText);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: finalPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: ideasSchema,
      },
    });

    const jsonText = response.text.trim();
    const ideas: VideoIdea[] = JSON.parse(jsonText);
    return ideas;
  } catch (error) {
    console.error("Error generating video ideas:", error);
    throw new Error("Failed to generate video ideas. Please check the console for details.");
  }
}

export async function generateRefinementSuggestions(idea: VideoIdea): Promise<RefinementSuggestions> {
  // IMPORTANT: A new instance must be created for each call to ensure the latest API key is used.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const finalPrompt = refinementPrompt
    .replace('{{TITLE}}', idea.title)
    .replace('{{DESCRIPTION}}', idea.description);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: finalPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: refinementSchema,
      },
    });

    const jsonText = response.text.trim();
    const suggestions: RefinementSuggestions = JSON.parse(jsonText);
    return suggestions;
  } catch (error) {
    console.error("Error generating refinement suggestions:", error);
    throw new Error("Failed to generate AI-powered suggestions. Please try again.");
  }
}

export async function generateVideo(
  prompt: string,
  images: { base64: string; mimeType: string }[],
  aspectRatio: AspectRatio,
  onStatusUpdate: (status: string) => void,
  onApiKeyError: () => void,
): Promise<string> {
    // IMPORTANT: A new instance must be created for each call to ensure the latest API key is used.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        onStatusUpdate("Initiating video generation...");
        let operation;

        if (images.length > 1) {
            // Fix: Use `VideoGenerationReferenceImage` type and `VideoGenerationReferenceType.ASSET` enum from `@google/genai`.
            const referenceImagesPayload: VideoGenerationReferenceImage[] = images.map(img => ({
                image: {
                    imageBytes: img.base64,
                    mimeType: img.mimeType,
                },
                referenceType: VideoGenerationReferenceType.ASSET,
            }));

            operation = await ai.models.generateVideos({
                model: 'veo-3.1-generate-preview',
                prompt: prompt,
                config: {
                    numberOfVideos: 1,
                    referenceImages: referenceImagesPayload,
                    resolution: '720p',
                    aspectRatio: '16:9', // This model requires 16:9
                }
            });

        } else if (images.length === 1) {
            operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: prompt,
                image: {
                    imageBytes: images[0].base64,
                    mimeType: images[0].mimeType,
                },
                config: {
                    numberOfVideos: 1,
                    resolution: '720p',
                    aspectRatio: aspectRatio,
                }
            });
        } else {
            throw new Error("At least one image must be selected to generate a video.");
        }
        
        onStatusUpdate("Processing request... This may take a few minutes.");
        const pollingInterval = 10000;
        
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, pollingInterval));
            onStatusUpdate("Checking video status...");
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        onStatusUpdate("Video generated! Fetching data...");

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) {
            throw new Error("Video generation succeeded, but no download link was found.");
        }

        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        if (!videoResponse.ok) {
            throw new Error(`Failed to download video file. Status: ${videoResponse.statusText}`);
        }

        const videoBlob = await videoResponse.blob();
        const videoUrl = URL.createObjectURL(videoBlob);
        
        onStatusUpdate("Done!");
        return videoUrl;

    } catch (error) {
        console.error("Error generating video:", error);

        if (error instanceof Error) {
            if (error.message.includes("RESOURCE_EXHAUSTED") || error.message.includes('"code":429')) {
                throw new Error(
                    "API quota exceeded. Please check your plan and billing details.\n\nFor more information, visit: [Google AI Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits) or [Monitor Your Usage](https://ai.dev/usage?tab=rate-limit)."
                );
            }
            if (error.message.includes("Requested entity was not found.")) {
                 onApiKeyError();
                 throw new Error("Your API key is invalid or not found. Please select a valid API key and try again.");
            }
        }
        
        throw new Error("Failed to generate video. Please check the console for details.");
    }
}