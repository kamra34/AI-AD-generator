import React, { useState, useCallback, useEffect } from 'react';
import { generateVideoIdeas, generateVideo, generateRefinementSuggestions } from './services/geminiService';
import { VideoIdea, AspectRatio, RefinementSuggestions, MediaItem } from './types';
import { Loader } from './components/Loader';
import { ApiKeyHandler } from './components/ApiKeyHandler';
import { loadAndProcessPreloadedImages } from './data/preloadedImages';

const initialProductDescription = `Soo: The Adaptive Night Light That Learns You
Soo is a wall-mounted, AI-powered night light designed to bring intelligence, comfort, and sustainability to your living space.
Each unit features a light sensor, motion detector, and an onboard AI processor that together create a self-learning lighting experience. With its sleek half-cylinder design (9 cm H × 7 cm W × 5 cm D) and soft downward glow, Soo blends beautifully into any interior — providing just the right amount of light exactly when and where you need it.
Unlike traditional smart lights, Soo forms a decentralized network of up to 16 lamps, allowing them to communicate directly with one another. Over time, they learn your movement patterns to create predictive lighting paths — so as you move through your home at night, the lights ahead turn on gently before you arrive, and fade out after you pass.
Completely battery-powered and wire-free, Soo can be easily repositioned or rearranged simply move them, and they automatically re-learn new paths, no configuration needed.
Crafted through sustainable 3D printing using eco-friendly materials, Soo is available in three elegant finishes: Mocha, Bone White, and Matte Gray.
Soo doesn’t just light your path, it learns it.`;

const productFeatures = [
  'Light & Motion Sensors',
  'AI-Powered Path Learning',
  'Decentralized Mesh Network',
  'Battery-Powered & Easy Relocation',
  'Eco-Friendly 3D Printed Material',
];

type AppStep = 'ASSETS' | 'IDEAS' | 'REFINE' | 'GENERATE';
const appSteps: AppStep[] = ['ASSETS', 'IDEAS', 'REFINE', 'GENERATE'];

interface SuggestionInputProps {
  label: string;
  placeholder?: string;
  suggestions: string[];
  value: string;
  onChange: (value: string) => void;
  isTextArea?: boolean;
}

const CUSTOM_VALUE = "custom";
const MAX_USER_UPLOADS = 5;

const SuggestionInput: React.FC<SuggestionInputProps> = ({ label, placeholder, suggestions, value, onChange, isTextArea = false }) => {
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    const isValueInSuggestions = suggestions.includes(value);
    if (value && !isValueInSuggestions) {
      setIsCustom(true);
    } else if (isValueInSuggestions) {
      setIsCustom(false);
    }
  }, [suggestions, value]);
  
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    if (selectedValue === CUSTOM_VALUE) {
      setIsCustom(true);
      onChange('');
    } else {
      setIsCustom(false);
      onChange(selectedValue);
    }
  };
  
  const selectedValue = isCustom ? CUSTOM_VALUE : (value || (suggestions.length > 0 ? suggestions[0] : ''));

  return (
    <div>
      <label htmlFor={label} className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      <div className="flex flex-col sm:flex-row gap-2 items-start">
        <select
          id={label}
          value={selectedValue}
          onChange={handleSelectChange}
          className="w-full sm:w-1/2 p-2.5 bg-slate-900 border border-slate-600 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
        >
          {suggestions.map(s => <option key={s} value={s}>{s}</option>)}
          <option value={CUSTOM_VALUE}>Write my own...</option>
        </select>
        {isCustom && (
          isTextArea ? (
            <textarea
              rows={3}
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full p-2.5 bg-slate-900 border border-slate-600 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition animate-fade-in"
            />
          ) : (
            <input
              type="text"
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full p-2.5 bg-slate-900 border border-slate-600 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition animate-fade-in"
            />
          )
        )}
      </div>
    </div>
  );
};

const ErrorDisplay: React.FC<{ message: string }> = ({ message }) => {
  if (!message) return null;

  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const elements: (string | React.ReactElement)[] = [];
  let lastIndex = 0;

  for (const match of message.matchAll(linkRegex)) {
    const [fullMatch, text, url] = match;
    const matchIndex = match.index || 0;

    if (matchIndex > lastIndex) {
      elements.push(message.substring(lastIndex, matchIndex));
    }

    elements.push(
      <a key={matchIndex} href={url} target="_blank" rel="noopener noreferrer" className="underline text-amber-400 hover:text-amber-300">
        {text}
      </a>
    );

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < message.length) {
    elements.push(message.substring(lastIndex));
  }

  return (
    <div className="mt-4 p-4 bg-red-900/50 border border-red-500/50 text-red-300 text-center font-medium whitespace-pre-wrap rounded-md">
      {elements.map((el, i) => <React.Fragment key={i}>{el}</React.Fragment>)}
    </div>
  );
};

const App: React.FC = () => {
  const [productDescription, setProductDescription] = useState<string>(initialProductDescription);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [videoIdeas, setVideoIdeas] = useState<VideoIdea[]>([]);
  
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([]);
  const [isLoadingPreloadedImages, setIsLoadingPreloadedImages] = useState<boolean>(true);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  
  const [step, setStep] = useState<AppStep>('ASSETS');
  const [selectedIdea, setSelectedIdea] = useState<VideoIdea | null>(null);
  const [refinementSuggestions, setRefinementSuggestions] = useState<RefinementSuggestions | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  
  const [videoStyle, setVideoStyle] = useState<string>('');
  const [environment, setEnvironment] = useState<string>('');
  const [lighting, setLighting] = useState<string>('');
  const [additionalDetails, setAdditionalDetails] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState<number>(7);
  
  const [isPromptConstructed, setIsPromptConstructed] = useState(false);
  const [finalVideoPrompt, setFinalVideoPrompt] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string>('');
  
  const [isLoadingIdeas, setIsLoadingIdeas] = useState<boolean>(false);
  const [isVideoGenerating, setIsVideoGenerating] = useState<boolean>(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const initPreloadedImages = async () => {
      setIsLoadingPreloadedImages(true);
      try {
        const images = await loadAndProcessPreloadedImages();
        setMediaLibrary(images);
      } catch (error) {
        console.error("Failed to load preloaded images:", error);
        setError("Could not load initial product images. Please try refreshing the page.");
      } finally {
        setIsLoadingPreloadedImages(false);
      }
    };
    initPreloadedImages();
  }, []);
  
  useEffect(() => {
    if (selectedMediaIds.length > 1) {
      setAspectRatio('16:9');
    }
  }, [selectedMediaIds]);

  const handleFeatureToggle = (feature: string) => {
    setSelectedFeatures(prev =>
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setError('');
    const userImageCount = mediaLibrary.filter(item => !item.isPreloaded).length;
    
    const filesToProcess = Array.from(files).filter(file => file.type.startsWith('image/'));

    if (userImageCount + filesToProcess.length > MAX_USER_UPLOADS) {
        setError(`Upload limit reached. You can only upload ${MAX_USER_UPLOADS} additional images.`);
        filesToProcess.splice(MAX_USER_UPLOADS - userImageCount);
    }
    
    filesToProcess.forEach(file => {
      const reader = new FileReader();
      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        const newItem: MediaItem = { 
            id, 
            type: 'image', 
            file, 
            previewUrl, 
            base64, 
            mimeType: file.type,
            isPreloaded: false 
        };
        setMediaLibrary(prev => [...prev, newItem]);
      };
      
      reader.readAsDataURL(file);
    });
  };

  const deleteMediaItem = (idToDelete: string) => {
    const itemToDelete = mediaLibrary.find(item => item.id === idToDelete);
    if(itemToDelete) {
      URL.revokeObjectURL(itemToDelete.previewUrl);
    }
    setMediaLibrary(prev => prev.filter(item => item.id !== idToDelete));
    setSelectedMediaIds(prev => prev.filter(id => id !== idToDelete));
  };
  
  const handleMediaSelection = (id: string) => {
    setError('');
    setSelectedMediaIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      } else {
        if (prev.length < 3) {
          return [...prev, id];
        } else {
          setError("You can select a maximum of 3 images.");
          return prev;
        }
      }
    });
  };

  const handleGenerateIdeas = async () => {
    setError('');
    setIsLoadingIdeas(true);
    setVideoIdeas([]);
    try {
      const ideas = await generateVideoIdeas(productDescription, selectedFeatures);
      setVideoIdeas(ideas);
      setStep('IDEAS');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingIdeas(false);
    }
  };
  
  const handleUseIdea = async (idea: VideoIdea) => {
    setSelectedIdea(idea);
    setStep('REFINE');
    setIsLoadingSuggestions(true);
    setRefinementSuggestions(null);
    setError('');

    try {
      const suggestions = await generateRefinementSuggestions(idea);
      setRefinementSuggestions(suggestions);
      setVideoStyle(suggestions.styles[0] || '');
      setEnvironment(suggestions.environments[0] || '');
      setLighting(suggestions.lightings[0] || '');
      setAdditionalDetails(suggestions.details[0] || '');
      setVideoDuration(suggestions.recommendedDuration || 7);
    } catch (err: any) {
      setError(err.message || 'Could not load AI suggestions.');
    } finally {
      setIsLoadingSuggestions(false);
    }
  };
  
  const handleConstructFinalPrompt = () => {
    if (!selectedIdea) return;
    
    const SHAPE_GUIDELINE = "Important: The generated video must strictly adhere to the exact shape of the product shown in the reference images. The lamps must look realistic and identical to the product. The dimensions (height: 10 centimeters, width: 8.5 centimeters, depth: 5 centimeters) must always be maintained. No changes to the product's shape or dimensions are allowed. The lamps must be depicted as wall-mounted, approximately 40 to 60 centimeters above the ground. They should never be shown sitting on the floor or mounted higher than 60 centimeters on the wall.";
    
    let prompt = `${selectedIdea.promptForVideo} ${SHAPE_GUIDELINE}`;
    if (videoStyle) prompt += ` The video style should be ${videoStyle}.`;
    if (environment) prompt += ` The environment is a ${environment}.`;
    if (lighting) prompt += ` The lighting should be ${lighting}.`;
    if (additionalDetails) prompt += ` Additional details: ${additionalDetails}.`;
    prompt += ` The video should be approximately ${videoDuration} seconds long.`;
    
    setFinalVideoPrompt(prompt);
    setIsPromptConstructed(true);
  };

  const handleProceedToGenerate = () => {
    setStep('GENERATE');
    handleConstructFinalPrompt();
  };

  const handleGenerateVideo = async (onApiKeyError: () => void) => {
    const selectedImages = mediaLibrary
        .filter(item => selectedMediaIds.includes(item.id))
        .map(item => ({ base64: item.base64, mimeType: item.mimeType }));

    if (!finalVideoPrompt || selectedImages.length < 1 || selectedImages.length > 3) {
      setError("Please provide a video prompt and select between 1 to 3 product images.");
      return;
    }
    setError('');
    setIsVideoGenerating(true);
    setGeneratedVideoUrl('');

    try {
      const videoUrl = await generateVideo(finalVideoPrompt, selectedImages, aspectRatio, setGenerationStatus, onApiKeyError);
      setGeneratedVideoUrl(videoUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsVideoGenerating(false);
      setGenerationStatus('');
    }
  };

  const resetProcess = () => {
    setStep('ASSETS');
    setVideoIdeas([]);
    setSelectedIdea(null);
    setFinalVideoPrompt('');
    setGeneratedVideoUrl('');
    setError('');
    setSelectedFeatures([]);
    setIsPromptConstructed(false);
    setSelectedMediaIds([]);
  }

  const Section = ({ icon, title, children }: { icon: React.ReactNode, title: string, children: React.ReactNode }) => (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 p-6 rounded-xl shadow-2xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 text-cyan-400">{icon}</div>
        <h2 className="text-2xl font-bold text-slate-100">{title}</h2>
      </div>
      {children}
    </div>
  );

  const Stepper = ({ currentStep }: { currentStep: AppStep }) => {
    const currentIndex = appSteps.indexOf(currentStep);
    return (
      <div className="flex justify-center items-center mb-12">
        <div className="flex items-center p-2 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-full shadow-lg">
          {appSteps.map((s, index) => (
            <div key={s} className="flex items-center">
              <div
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                  index <= currentIndex ? 'bg-cyan-500 text-white' : 'text-slate-400'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()}
              </div>
              {index < appSteps.length - 1 && (
                <div className={`w-12 h-px mx-2 transition-all duration-300 ${
                  index < currentIndex ? 'bg-cyan-500' : 'bg-slate-700'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen font-sans">
      <div className="container mx-auto p-4 md:p-8 max-w-4xl">
        <header className="text-center mb-10">
          <div className="flex justify-center items-center gap-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-cyan-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9a2.25 2.25 0 0 0-2.25 2.25v9A2.25 2.25 0 0 0 4.5 18.75Z" />
              </svg>
              <h1 className="text-4xl md:text-5xl font-extrabold text-slate-50">
                Soo AI Video Ad Generator
              </h1>
          </div>
          <p className="text-lg text-slate-400 mt-2">Create Promotional Videos for Soo</p>
        </header>

        <Stepper currentStep={step} />

        <div className="space-y-8">
            <Section icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>} title="Step 1: Media Assets">
                {isLoadingPreloadedImages ? (
                    <div className="flex justify-center items-center p-8">
                        <Loader message="Loading image library..." />
                    </div>
                ) : (
                    <>
                        <div className="p-4 bg-slate-950/50 rounded-lg border border-dashed border-slate-700">
                            <div className="flex justify-center items-center">
                                <label htmlFor="media-upload" className="relative cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-2.5 px-5 rounded-lg transition-colors flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
                                    <span>Upload More Images</span>
                                    <input id="media-upload" name="media-upload" type="file" className="sr-only" multiple accept="image/*" onChange={handleMediaUpload} />
                                </label>
                            </div>
                            <p className="text-xs text-slate-500 text-center mt-2">A library of product images is loaded. You can add up to {MAX_USER_UPLOADS} more.</p>
                        </div>
                        {mediaLibrary.length > 0 && (
                            <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                            {mediaLibrary.map(item => (
                                <div key={item.id} className="relative group aspect-square">
                                <img src={item.previewUrl} alt="Product image" className="w-full h-full object-cover rounded-md" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                                    {!item.isPreloaded && (
                                        <button onClick={() => deleteMediaItem(item.id)} className="absolute top-1.5 right-1.5 bg-red-600/80 hover:bg-red-500 text-white p-1 rounded-full z-10">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                        </button>
                                    )}
                                </div>
                                </div>
                            ))}
                            </div>
                        )}
                    </>
                )}
            </Section>

            {step === 'IDEAS' || step === 'ASSETS' ? (
                <Section icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.354a15.057 15.057 0 0 1-4.5 0m3.75-12.311a15.057 15.057 0 0 0-4.5 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>} title="Step 2: Video Concept">
                    <div className="space-y-6">
                        <div>
                        <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-1">Product Description</label>
                        <textarea id="description" rows={6} className="w-full p-3 bg-slate-950/80 border border-slate-700 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition" value={productDescription} onChange={(e) => setProductDescription(e.target.value)} />
                        </div>
                        <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Select Key Features to Highlight (Optional)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {productFeatures.map(feature => (
                            <button key={feature} onClick={() => handleFeatureToggle(feature)} className={`p-3 text-sm rounded-md transition-all duration-200 text-left flex items-center gap-3 ${selectedFeatures.includes(feature) ? 'bg-cyan-600 text-white font-semibold ring-2 ring-cyan-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}>
                                <div className={`w-4 h-4 rounded-full border-2 ${selectedFeatures.includes(feature) ? 'border-cyan-200 bg-white' : 'border-slate-500'}`}/>
                                {feature}
                            </button>
                            ))}
                        </div>
                        </div>
                        <button onClick={handleGenerateIdeas} disabled={isLoadingIdeas} className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-90 text-white font-bold rounded-lg transition-all duration-300 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed transform hover:scale-[1.02]">
                          {isLoadingIdeas ? 'Generating...' : 'Generate 3 Ideas'}
                        </button>
                    </div>
                    {isLoadingIdeas && <div className="mt-4"><Loader message="Crafting creative concepts..." /></div>}
                    {videoIdeas.length > 0 && step === 'IDEAS' && (
                        <div className="mt-6 space-y-4 animate-fade-in">
                            {videoIdeas.map((idea, index) => (
                                <div key={index} className="bg-slate-950/50 p-4 rounded-lg border border-slate-800 transition-all duration-300">
                                <h3 className="font-bold text-lg text-indigo-400">{idea.title}</h3>
                                <p className="text-sm text-slate-400 mt-1"><strong className="text-slate-300">Concept:</strong> {idea.description}</p>
                                <p className="text-sm text-slate-400 mt-1"><strong className="text-slate-300">Visuals:</strong> {idea.visuals}</p>
                                <button onClick={() => handleUseIdea(idea)} className="mt-3 px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 rounded-md text-white transition-colors">Use this Idea &rarr;</button>
                                </div>
                            ))}
                        </div>
                    )}
                    {(step === 'IDEAS' || step === 'ASSETS') && <ErrorDisplay message={error} />}
                </Section>
            ) : null}

            {step === 'REFINE' && selectedIdea && (
                <Section icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>} title="Step 3: Refine Idea">
                    <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-700">
                      <h3 className="font-bold text-lg text-indigo-400">{selectedIdea.title}</h3>
                      <p className="text-sm text-slate-400 mt-1">{selectedIdea.description}</p>
                    </div>
                    {isLoadingSuggestions && <div className="mt-4"><Loader message="Generating creative suggestions..." /></div>}
                    {!isLoadingSuggestions && <ErrorDisplay message={error} />}
                    {refinementSuggestions && !isLoadingSuggestions && (
                    <div className="mt-6 space-y-6">
                        <div>
                            <label htmlFor="duration" className="block text-sm font-medium text-slate-300 mb-2">
                                Video Duration: <span className="font-bold text-cyan-400">{videoDuration}s</span>
                                {refinementSuggestions?.recommendedDuration === videoDuration && (
                                    <span className="ml-2 text-xs bg-cyan-800 text-cyan-200 px-2 py-0.5 rounded-full">AI Recommended</span>
                                )}
                            </label>
                            <input
                                id="duration"
                                type="range"
                                min="3"
                                max="15"
                                step="1"
                                value={videoDuration}
                                onChange={(e) => setVideoDuration(parseInt(e.target.value, 10))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                            />
                        </div>

                        <SuggestionInput label="Video Style" suggestions={refinementSuggestions.styles} value={videoStyle} onChange={setVideoStyle} />
                        <SuggestionInput label="Environment" placeholder="e.g., A modern, minimalist apartment hallway at night" suggestions={refinementSuggestions.environments} value={environment} onChange={setEnvironment} />
                        <SuggestionInput label="Lighting" placeholder="e.g., Soft, warm glow from the lights, moonlight from a window" suggestions={refinementSuggestions.lightings} value={lighting} onChange={setLighting} />
                        <SuggestionInput label="Additional Details" placeholder="e.g., A cat walks down the hallway, focus on the eco-friendly texture" suggestions={refinementSuggestions.details} value={additionalDetails} onChange={setAdditionalDetails} isTextArea />

                        <div className="pt-4 border-t border-slate-800">
                             <button onClick={handleProceedToGenerate} className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-90 text-white font-bold rounded-lg transition-all duration-300 transform hover:scale-[1.02]">
                                Proceed to Video Generation &rarr;
                             </button>
                        </div>
                    </div>
                    )}
                </Section>
            )}

            {step === 'GENERATE' && (
            <Section icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" /></svg>} title="Step 4: Generate Video">
                 <ApiKeyHandler>
                  {({ isChecking, isStudioEnv, apiKeySelected, handleSelectKey, resetKeyState }) => {
                    if (isChecking) {
                      return <Loader message="Verifying environment..." />;
                    }

                    if (!isStudioEnv) {
                      return (
                        <div className="p-6 my-4 bg-slate-900/80 backdrop-blur-sm border border-cyan-500/50 rounded-lg text-center shadow-lg">
                          <div className="w-12 h-12 mx-auto mb-3 text-cyan-400">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                            </svg>
                          </div>
                          <h2 className="text-xl font-bold mb-2 text-cyan-300">Feature Availability</h2>
                          <p className="mb-5 text-slate-300">
                            Video generation with Veo requires a specific environment provided by Google AI Studio for API key management. To use this feature, please run this application within AI Studio.
                          </p>
                          <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="inline-block px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold rounded-md transition-colors duration-300">
                            Go to AI Studio
                          </a>
                        </div>
                      );
                    }
                    
                    if (!apiKeySelected) {
                      return (
                        <div className="p-6 my-4 bg-slate-900/80 backdrop-blur-sm border border-amber-500/50 rounded-lg text-center shadow-lg animate-fade-in">
                          <div className="w-12 h-12 mx-auto mb-3 text-amber-400">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.25-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
                            </svg>
                          </div>
                          <h2 className="text-xl font-bold mb-2 text-amber-300">API Key Required for Video Generation</h2>
                          <p className="mb-5 text-slate-300">
                            To generate videos with Veo, you must select an API key associated with a project that has billing enabled.
                          </p>
                          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <button onClick={handleSelectKey} className="w-full sm:w-auto px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-md transition-colors duration-300 transform hover:scale-105 shadow-md">
                              Select API Key
                            </button>
                            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto px-6 py-2.5 border border-slate-500 text-slate-300 hover:bg-slate-700 hover:text-slate-100 font-semibold rounded-md transition-colors duration-300">
                              Learn about Billing
                            </a>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Select 1 to 3 Images for Video Generation</label>
                                <p className="text-xs text-slate-400 mb-2">Selected {selectedMediaIds.length} of 3 images.</p>
                                {mediaLibrary.length === 0 ? (<p className="text-slate-500 text-center py-4">No images available.</p>) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                                    {mediaLibrary.map(item => {
                                        const isSelected = selectedMediaIds.includes(item.id);
                                        const isSelectable = isSelected || selectedMediaIds.length < 3;
                                        return (
                                            <div key={item.id} onClick={() => isSelectable && handleMediaSelection(item.id)} className={`relative group aspect-square rounded-md overflow-hidden transition-all duration-200 ${isSelectable ? 'cursor-pointer' : ''}`}>
                                                <img src={item.previewUrl} alt="Product image" className="w-full h-full object-cover" />
                                                <div className={`absolute inset-0 ring-4 ${isSelected ? 'ring-cyan-500' : 'ring-transparent'} pointer-events-none transition-all`}></div>
                                                {isSelected && <div className="absolute top-1.5 right-1.5 bg-cyan-500 text-white rounded-full w-5 h-5 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.052-.143Z" clipRule="evenodd" /></svg></div>}
                                                {!isSelectable && <div className="absolute inset-0 bg-black/70"></div>}
                                            </div>
                                        )
                                    })}
                                </div>
                                )}
                            </div>
                            
                            <div>
                                <label htmlFor="prompt" className="block text-sm font-medium text-slate-300 mb-1">Final Video Prompt</label>
                                <p className="text-xs text-slate-400 mb-2">This prompt was built from your selections. You can edit it before generating.</p>
                                <textarea id="prompt" rows={6} className="w-full p-3 bg-slate-950/80 border border-slate-700 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition" value={finalVideoPrompt} onChange={(e) => setFinalVideoPrompt(e.target.value)} />
                            </div>

                            <div>
                                <span className="block text-sm font-medium text-slate-300 mb-2">Aspect Ratio</span>
                                {selectedMediaIds.length > 1 && <p className="text-xs text-amber-400 mb-2">Multiple reference images require 16:9 aspect ratio.</p>}
                                <div className="flex gap-4">
                                {(['16:9', '9:16'] as AspectRatio[]).map(ratio => (
                                    <button key={ratio} onClick={() => setAspectRatio(ratio)} disabled={selectedMediaIds.length > 1 && ratio !== '16:9'} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${aspectRatio === ratio ? 'bg-cyan-600 text-white' : 'bg-slate-800 hover:bg-slate-700'} disabled:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed`}>
                                    {ratio} {ratio === '16:9' ? '(Landscape)' : '(Portrait)'}
                                    </button>
                                ))}
                                </div>
                            </div>

                            <button onClick={() => handleGenerateVideo(resetKeyState)} disabled={isVideoGenerating || !apiKeySelected || selectedMediaIds.length < 1 || selectedMediaIds.length > 3} className="w-full px-6 py-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-90 text-white font-extrabold text-lg rounded-lg transition-all duration-300 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed transform hover:scale-105">
                                {isVideoGenerating ? 'Creating Video...' : '✨ Generate Video'}
                            </button>

                            {(isVideoGenerating || generatedVideoUrl || (error && step === 'GENERATE')) && (
                                <div className="mt-6 p-4 bg-slate-950/50 rounded-lg">
                                {isVideoGenerating && <Loader message={generationStatus} />}
                                {step === 'GENERATE' && <ErrorDisplay message={error} />}
                                {generatedVideoUrl && (
                                    <div className="animate-fade-in">
                                    <h3 className="text-xl font-bold text-center mb-4 text-green-400">Your Video is Ready!</h3>
                                    <video controls autoPlay muted loop className="w-full rounded-lg shadow-2xl">
                                        <source src={generatedVideoUrl} type="video/mp4" />
                                        Your browser does not support the video tag.
                                    </video>
                                    </div>
                                )}
                                </div>
                            )}
                        </div>
                    );
                  }}
                 </ApiKeyHandler>
                 <div className="mt-6 flex justify-center">
                    <button onClick={resetProcess} className="text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors">&larr; Start Over</button>
                </div>
            </Section>
            )}
        </div>
      </div>
    </div>
  );
};

export default App;