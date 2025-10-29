import React, { useState, useEffect, useCallback } from 'react';

interface ApiKeyHandlerProps {
  children: (status: {
    isChecking: boolean;
    isStudioEnv: boolean;
    apiKeySelected: boolean;
    handleSelectKey: () => Promise<void>;
    resetKeyState: () => void;
  }) => React.ReactNode;
}

export const ApiKeyHandler: React.FC<ApiKeyHandlerProps> = ({ children }) => {
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isStudioEnv, setIsStudioEnv] = useState(false);

  const checkApiKey = useCallback(async () => {
    if (!(window as any).aistudio) return;
    try {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      setApiKeySelected(hasKey ?? false);
    } catch (e) {
      console.error("Error checking API key status:", e);
      setApiKeySelected(false);
    }
  }, []);

  useEffect(() => {
    let envFound = false;
    let cancelled = false;
    
    const detectStudioEnv = async () => {
        if (envFound) return;

        const studio = (window as any).aistudio;
        if (studio && typeof studio.hasSelectedApiKey === 'function' && typeof studio.openSelectKey === 'function') {
            envFound = true;
            if (cancelled) return;
            setIsStudioEnv(true);
            await checkApiKey();
            if (cancelled) return;
            setIsChecking(false);
        }
    };
    
    // Check immediately
    detectStudioEnv();
    // Check again after a delay to handle script loading races
    const timer = setTimeout(() => {
        if (!envFound) {
            detectStudioEnv().then(() => {
              if (!envFound && !cancelled) {
                  setIsStudioEnv(false);
                  setIsChecking(false);
              }
            });
        }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [checkApiKey]);

  const handleSelectKey = async () => {
    if ((window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
        // Optimistically assume success to provide a smoother UX
        setApiKeySelected(true);
    } else {
        console.error("AI Studio environment not detected. Cannot open API key selector.");
    }
  };

  const resetKeyState = useCallback(() => {
    setApiKeySelected(false);
  }, []);
  
  return <>{children({ isChecking, isStudioEnv, apiKeySelected, handleSelectKey, resetKeyState })}</>;
};
