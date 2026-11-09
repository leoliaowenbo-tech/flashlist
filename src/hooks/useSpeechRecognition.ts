import { useState, useEffect, useRef, useCallback } from 'react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    webkit?: {
      messageHandlers?: {
        nativeSpeech?: {
          postMessage: (msg: any) => void;
        };
      };
    };
    onNativeSpeechResult?: (text: string, isFinal: boolean) => void;
    onNativeSpeechError?: (error: string) => void;
  }
}

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useSpeechRecognition(onFinalTranscript?: (text: string) => void): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const webRecognitionRef = useRef<any>(null);

  const isNativeMacApp = typeof window !== 'undefined' && 
    !!window.webkit?.messageHandlers?.nativeSpeech;

  const isBrowserSupported = typeof window !== 'undefined' && 
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const isSupported = isNativeMacApp || isBrowserSupported;

  useEffect(() => {
    window.onNativeSpeechResult = (text: string, isFinal: boolean) => {
      setTranscript(text);
      setError(null);
      if (isFinal) {
        setIsListening(false);
        if (onFinalTranscript) {
          onFinalTranscript(text);
        }
      }
    };

    window.onNativeSpeechError = (errMsg: string) => {
      setError(errMsg);
      setIsListening(false);
    };

    return () => {
      delete window.onNativeSpeechResult;
      delete window.onNativeSpeechError;
    };
  }, [onFinalTranscript]);

  useEffect(() => {
    if (isNativeMacApp || !isBrowserSupported) return;

    const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionConstructor();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let currentInterim = '';
      let finalSpeech = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          finalSpeech += item[0].transcript;
        } else {
          currentInterim += item[0].transcript;
        }
      }

      const fullTranscript = finalSpeech || currentInterim;
      setTranscript(fullTranscript);

      if (finalSpeech && onFinalTranscript) {
        onFinalTranscript(finalSpeech);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setError('麦克风权限未开启，请在系统设置中允许使用麦克风');
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`语音提示: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    webRecognitionRef.current = recognition;

    return () => {
      if (webRecognitionRef.current) {
        webRecognitionRef.current.abort();
      }
    };
  }, [isNativeMacApp, isBrowserSupported, onFinalTranscript]);

  const startListening = useCallback(() => {
    setError(null);
    setTranscript('');
    setIsListening(true);

    if (isNativeMacApp) {
      try {
        window.webkit?.messageHandlers?.nativeSpeech?.postMessage('start');
      } catch (e: any) {
        setError(`无法连接原生语音模块: ${e.message}`);
        setIsListening(false);
      }
      return;
    }

    if (isBrowserSupported) {
      try {
        webRecognitionRef.current?.start();
      } catch (e) {
        console.warn('Web speech error', e);
      }
    } else {
      setError('当前环境不支持语音识别');
      setIsListening(false);
    }
  }, [isNativeMacApp, isBrowserSupported]);

  const stopListening = useCallback(() => {
    setIsListening(false);

    if (isNativeMacApp) {
      try {
        window.webkit?.messageHandlers?.nativeSpeech?.postMessage('stop');
      } catch (e) {
        console.warn('Native speech stop error', e);
      }
      return;
    }

    if (webRecognitionRef.current) {
      try {
        webRecognitionRef.current.stop();
      } catch (e) {
        console.warn('Web speech stop error', e);
      }
    }
  }, [isNativeMacApp]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
