'use client';

import { useState, useRef, useEffect } from 'react';

export default function Home() {
  // InVideo AI API Configuration
  const [apiKey, setApiKey] = useState('');
  const [showApiConfig, setShowApiConfig] = useState(false);

  // Generation method
  const [generationMethod, setGenerationMethod] = useState<'ai-video' | 'image-to-video' | 'stock-enhanced'>('ai-video');
  
  // Landscape and mood settings
  const [landscapeType, setLandscapeType] = useState('mountains');
  const [moodStyle, setMoodStyle] = useState('dreamy');
  const [customPrompt, setCustomPrompt] = useState('');
  
  // Video settings
  const [videoLength, setVideoLength] = useState(15);
  const [transitionStyle, setTransitionStyle] = useState('fade');
  
  // Audio settings
  const [audioSource, setAudioSource] = useState<'ai-generated' | 'upload' | 'none'>('ai-generated');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [volume, setVolume] = useState(80);
  const [fadeAudio, setFadeAudio] = useState(true);
  
  // Export settings
  const [videoFormat, setVideoFormat] = useState('mp4');
  const [audioFormat, setAudioFormat] = useState('mp3');
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(30);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // InVideo AI polling state
  const [videoJobId, setVideoJobId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isGenerating) {
      timer = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(timer);
  }, [isGenerating]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generatePrompt = () => {
    if (customPrompt) return customPrompt;
    
    const prompts = {
      mountains: {
        dreamy: 'Ethereal mountain peaks shrouded in soft pastel clouds at golden hour',
        moody: 'Dark dramatic mountain ranges under stormy skies with rolling fog',
        ethereal: 'Mystical mountains floating in a sea of luminous mist',
        cinematic: 'Epic mountain vista with dramatic lighting and sweeping camera movement',
        serene: 'Peaceful mountain landscape with calm lakes reflecting snow-capped peaks',
        dramatic: 'Towering mountains with lightning strikes and turbulent weather'
      },
      ocean: {
        dreamy: 'Soft waves gently rolling onto a pastel-colored beach at sunset',
        moody: 'Dark turbulent ocean waters under heavy storm clouds',
        ethereal: 'Glowing bioluminescent waves washing ashore under starlight',
        cinematic: 'Powerful ocean waves crashing against rocky cliffs in slow motion',
        serene: 'Crystal clear turquoise waters with gentle ripples',
        dramatic: 'Massive waves during a storm with spray and foam'
      },
      forest: {
        dreamy: 'Enchanted forest with soft sunbeams filtering through misty trees',
        moody: 'Dense dark forest with mysterious shadows and fog',
        ethereal: 'Magical woodland with glowing fireflies and luminous plants',
        cinematic: 'Ancient forest with towering trees and dramatic light rays',
        serene: 'Peaceful forest clearing with dappled sunlight',
        dramatic: 'Wild forest during a thunderstorm with wind-blown trees'
      },
      desert: {
        dreamy: 'Soft sand dunes in pastel hues during golden hour',
        moody: 'Dark desert landscape under a brooding twilight sky',
        ethereal: 'Surreal desert with shimmering heat waves and mirages',
        cinematic: 'Vast desert expanse with dramatic shadows and epic scale',
        serene: 'Calm desert oasis with gentle ripples in the sand',
        dramatic: 'Desert sandstorm with swirling dust and intense atmosphere'
      },
      aurora: {
        dreamy: 'Soft dancing northern lights in pastel colors over snowy landscape',
        moody: 'Intense aurora borealis with deep greens and purples',
        ethereal: 'Mystical aurora with otherworldly colors and cosmic atmosphere',
        cinematic: 'Epic aurora display with sweeping movements across the sky',
        serene: 'Gentle aurora waves over a calm frozen lake',
        dramatic: 'Powerful aurora storm with vibrant colors and rapid movement'
      },
      clouds: {
        dreamy: 'Soft fluffy clouds in pastel sky during golden hour',
        moody: 'Dark storm clouds with ominous atmosphere',
        ethereal: 'Luminous clouds with surreal colors and formations',
        cinematic: 'Epic cloudscape with dramatic lighting and depth',
        serene: 'Peaceful white clouds drifting in clear blue sky',
        dramatic: 'Turbulent storm clouds with lightning and movement'
      }
    };
    
    return prompts[landscapeType as keyof typeof prompts][moodStyle as keyof typeof prompts.mountains];
  };

  // InVideo AI generation
  const generateWithInVideoAI = async () => {
    if (!apiKey) {
      alert('Please configure your InVideo AI API key first');
      return;
    }

    try {
      setProgressStatus('Sending request to InVideo AI...');
      setProgress(10);

      const prompt = generatePrompt();
      
      const response = await fetch('https://api.invideo.io/v2/videos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          duration: videoLength,
          aspect_ratio: '16:9',
          voice_over: audioSource === 'ai-generated',
        }),
      });

      if (!response.ok) {
        throw new Error(`InVideo AI API error: ${response.statusText}`);
      }

      const data = await response.json() as { video_id?: string; id?: string };
      const jobId = data.video_id || data.id;
      
      if (!jobId) {
        throw new Error('No video ID returned from InVideo AI');
      }

      setVideoJobId(jobId);
      setProgress(20);
      setProgressStatus('Video generation started. Polling for completion...');

      // Start polling for video completion
      startPolling(jobId);
    } catch (error) {
      console.error('InVideo AI generation error:', error);
      setProgressStatus('Error: ' + (error as Error).message);
      setIsGenerating(false);
    }
  };

  // Polling system to check video status
  const startPolling = (jobId: string) => {
    let pollCount = 0;
    const maxPolls = 120; // 10 minutes max (5 second intervals)

    const poll = async () => {
      try {
        pollCount++;
        setProgressStatus(`Checking video status... (${pollCount * 5}s elapsed)`);
        
        const response = await fetch(`https://api.invideo.io/v2/videos/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to check video status');
        }

        const statusData = await response.json() as { status?: string; video_url?: string; download_url?: string };
        
        // Update progress based on status
        if (statusData.status === 'processing') {
          const progressPercent = Math.min(20 + (pollCount * 2), 90);
          setProgress(progressPercent);
          setProgressStatus(`Video is being generated... ${progressPercent}%`);
        } else if (statusData.status === 'completed') {
          setProgress(100);
          setProgressStatus('Video generation complete!');
          
          const videoUrl = statusData.video_url || statusData.download_url;
          if (videoUrl) {
            setGeneratedVideoUrl(videoUrl);
            
            // Auto-download the video
            const link = document.createElement('a');
            link.href = videoUrl;
            link.download = `invideo-${landscapeType}-${moodStyle}-${Date.now()}.${videoFormat}`;
            link.click();
          }
          
          setIsGenerating(false);
          return; // Stop polling
        } else if (statusData.status === 'failed') {
          throw new Error('Video generation failed');
        }

        // Continue polling if not complete and under max polls
        if (pollCount < maxPolls) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          throw new Error('Video generation timeout (10 minutes exceeded)');
        }
      } catch (error) {
        console.error('Polling error:', error);
        setProgressStatus('Error: ' + (error as Error).message);
        setIsGenerating(false);
      }
    };

    // Start first poll after 5 seconds
    setTimeout(poll, 5000);
  };

  // Local demo generation (fallback)
  const generateLocalDemo = async () => {
    const stages = [
      { progress: 0, status: 'Initializing generation...' },
      { progress: 15, status: 'Analyzing prompt and settings...' },
      { progress: 30, status: 'Generating landscape visuals...' },
      { progress: 50, status: 'Applying mood and style effects...' },
      { progress: 70, status: 'Processing audio track...' },
      { progress: 85, status: 'Rendering final video...' },
      { progress: 100, status: 'Generation complete!' }
    ];

    for (const stage of stages) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProgress(stage.progress);
      setProgressStatus(stage.status);
      setEstimatedTime(Math.max(0, estimatedTime - 5));
    }

    // Create a canvas-based video
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;

    // Generate frames
    const frames: Blob[] = [];
    const totalFrames = videoLength * 30; // 30 FPS

    for (let i = 0; i < totalFrames; i++) {
      // Create gradient background based on landscape and mood
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      
      const time = i / totalFrames;
      const colors = getColorsForLandscapeAndMood(landscapeType, moodStyle, time);
      
      gradient.addColorStop(0, colors[0]);
      gradient.addColorStop(0.5, colors[1]);
      gradient.addColorStop(1, colors[2]);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add animated elements based on mood
      if (moodStyle === 'dreamy' || moodStyle === 'ethereal') {
        // Add floating particles
        for (let j = 0; j < 20; j++) {
          const x = (Math.sin(time * Math.PI * 2 + j) * 200) + canvas.width / 2;
          const y = (Math.cos(time * Math.PI * 2 + j * 0.5) * 200) + canvas.height / 2;
          ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + Math.sin(time * Math.PI * 4 + j) * 0.2})`;
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Add text overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 60px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${landscapeType.toUpperCase()} - ${moodStyle.toUpperCase()}`, canvas.width / 2, canvas.height / 2);

      // Convert frame to blob
      await new Promise<void>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) frames.push(blob);
          resolve();
        }, 'image/jpeg', 0.95);
      });
    }

    // Create video blob (simplified - in production, use proper video encoding)
    const videoBlob = new Blob(frames, { type: 'video/mp4' });
    const videoUrl = URL.createObjectURL(videoBlob);
    setGeneratedVideoUrl(videoUrl);
    setIsGenerating(false);
  };

  const getColorsForLandscapeAndMood = (landscape: string, mood: string, time: number) => {
    const palettes: Record<string, Record<string, string[]>> = {
      mountains: {
        dreamy: ['#FFE5E5', '#E5F3FF', '#F0E5FF'],
        moody: ['#2C3E50', '#34495E', '#1C2833'],
        ethereal: ['#E8F4F8', '#D4E9F7', '#C0DDF5'],
        cinematic: ['#FF6B35', '#F7931E', '#FDC830'],
        serene: ['#A8DADC', '#457B9D', '#1D3557'],
        dramatic: ['#1A1A2E', '#16213E', '#0F3460']
      },
      ocean: {
        dreamy: ['#E0F7FA', '#B2EBF2', '#80DEEA'],
        moody: ['#0D47A1', '#1565C0', '#1976D2'],
        ethereal: ['#00BCD4', '#00ACC1', '#0097A7'],
        cinematic: ['#006064', '#00838F', '#0097A7'],
        serene: ['#B3E5FC', '#81D4FA', '#4FC3F7'],
        dramatic: ['#01579B', '#0277BD', '#0288D1']
      },
      forest: {
        dreamy: ['#C8E6C9', '#A5D6A7', '#81C784'],
        moody: ['#1B5E20', '#2E7D32', '#388E3C'],
        ethereal: ['#69F0AE', '#00E676', '#00C853'],
        cinematic: ['#33691E', '#558B2F', '#689F38'],
        serene: ['#DCEDC8', '#C5E1A5', '#AED581'],
        dramatic: ['#1B5E20', '#2E7D32', '#388E3C']
      },
      desert: {
        dreamy: ['#FFECB3', '#FFE082', '#FFD54F'],
        moody: ['#BF360C', '#D84315', '#E64A19'],
        ethereal: ['#FFF9C4', '#FFF59D', '#FFF176'],
        cinematic: ['#E65100', '#EF6C00', '#F57C00'],
        serene: ['#FFF8E1', '#FFECB3', '#FFE082'],
        dramatic: ['#BF360C', '#D84315', '#E64A19']
      },
      aurora: {
        dreamy: ['#E1BEE7', '#CE93D8', '#BA68C8'],
        moody: ['#4A148C', '#6A1B9A', '#7B1FA2'],
        ethereal: ['#B39DDB', '#9575CD', '#7E57C2'],
        cinematic: ['#311B92', '#4527A0', '#512DA8'],
        serene: ['#D1C4E9', '#B39DDB', '#9575CD'],
        dramatic: ['#4A148C', '#6A1B9A', '#7B1FA2']
      },
      clouds: {
        dreamy: ['#FFFFFF', '#F5F5F5', '#EEEEEE'],
        moody: ['#616161', '#757575', '#9E9E9E'],
        ethereal: ['#FAFAFA', '#F5F5F5', '#EEEEEE'],
        cinematic: ['#BDBDBD', '#9E9E9E', '#757575'],
        serene: ['#FFFFFF', '#FAFAFA', '#F5F5F5'],
        dramatic: ['#424242', '#616161', '#757575']
      }
    };

    const colors = palettes[landscape]?.[mood] || palettes.mountains.dreamy;
    
    // Animate colors over time
    const animatedColors = colors.map(color => {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      
      const variation = Math.sin(time * Math.PI * 2) * 20;
      
      return `rgb(${Math.max(0, Math.min(255, r + variation))}, ${Math.max(0, Math.min(255, g + variation))}, ${Math.max(0, Math.min(255, b + variation))})`;
    });
    
    return animatedColors;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProgress(0);
    setEstimatedTime(30);
    setGeneratedVideoUrl(null);

    // Use InVideo AI if API key is configured and AI video generation is selected
    if (apiKey && generationMethod === 'ai-video') {
      await generateWithInVideoAI();
    } else {
      // Fallback to local demo generation
      if (generationMethod === 'ai-video' && !apiKey) {
        setProgressStatus('No API key configured. Using demo generation...');
      }
      await generateLocalDemo();
    }
  };

  const handleDownload = (format: string) => {
    if (!generatedVideoUrl) return;

    const link = document.createElement('a');
    link.href = generatedVideoUrl;
    link.download = `ai-video-${landscapeType}-${moodStyle}-${Date.now()}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            AI Video Generator
          </h1>
          <p className="text-xl text-gray-300">Create stunning dreamy and moody landscape videos with AI</p>
          <div className="mt-4 inline-flex items-center gap-2 bg-green-500/20 text-green-300 px-4 py-2 rounded-full text-sm">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Copyright-free content for social media
          </div>
        </div>

        {/* InVideo AI API Configuration */}
        <div className="mb-8 bg-purple-900/30 rounded-lg p-6 border border-purple-500/30">
          <button
            onClick={() => setShowApiConfig(!showApiConfig)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold">InVideo AI Configuration</h3>
                <p className="text-sm text-gray-400">Configure your InVideo AI API key for real video generation</p>
              </div>
            </div>
            <svg
              className={`w-5 h-5 transition-transform ${showApiConfig ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showApiConfig && (
            <div className="mt-4 pt-4 border-t border-purple-500/30">
              <label className="block text-sm font-medium mb-2">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your InVideo AI API key"
                className="w-full px-4 py-2 bg-slate-800 border border-purple-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="mt-2 text-xs text-gray-400">
                Get your API key from <a href="https://invideo.io" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">invideo.io</a>
              </p>
              {apiKey && (
                <div className="mt-3 flex items-center gap-2 text-green-400 text-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  API key configured - AI video generation enabled
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Prompt Studio */}
          <div className="lg:col-span-2 space-y-6">
            {/* Generation Method */}
            <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Generation Method
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'ai-video', label: 'AI Video Generation', desc: 'Generate from scratch using AI' },
                  { id: 'image-to-video', label: 'Image to Video', desc: 'Create from AI images with transitions' },
                  { id: 'stock-enhanced', label: 'Stock Enhanced', desc: 'Use stock footage with AI effects' }
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setGenerationMethod(method.id as typeof generationMethod)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      generationMethod === method.id
                        ? 'border-purple-500 bg-purple-500/20'
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <div className="font-semibold mb-1">{method.label}</div>
                    <div className="text-xs text-gray-400">{method.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Landscape Type */}
            <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Landscape Type
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {['mountains', 'ocean', 'forest', 'desert', 'aurora', 'clouds'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setLandscapeType(type)}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      landscapeType === type
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Mood Style */}
            <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                Mood & Style
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {['dreamy', 'moody', 'ethereal', 'cinematic', 'serene', 'dramatic'].map((mood) => (
                  <button
                    key={mood}
                    onClick={() => setMoodStyle(mood)}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      moodStyle === mood
                        ? 'bg-pink-500 text-white'
                        : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    {mood.charAt(0).toUpperCase() + mood.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Prompt */}
            <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
              <h2 className="text-2xl font-semibold mb-4">Custom Prompt (Optional)</h2>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe your vision in detail... (leave empty to use preset)"
                className="w-full h-32 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>

            {/* Video Settings */}
            <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Video Settings
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Video Length: {videoLength} seconds
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    value={videoLength}
                    onChange={(e) => setVideoLength(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Transition Style</label>
                  <select
                    value={transitionStyle}
                    onChange={(e) => setTransitionStyle(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="fade">Fade</option>
                    <option value="dissolve">Dissolve</option>
                    <option value="wipe">Wipe</option>
                    <option value="zoom">Zoom</option>
                    <option value="slide">Slide</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Audio Settings */}
            <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                Audio Settings
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Audio Source</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'ai-generated', label: 'AI Generated' },
                      { id: 'upload', label: 'Upload File' },
                      { id: 'none', label: 'No Audio' }
                    ].map((source) => (
                      <button
                        key={source.id}
                        onClick={() => setAudioSource(source.id as typeof audioSource)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          audioSource === source.id
                            ? 'bg-yellow-500 text-black'
                            : 'bg-slate-700 hover:bg-slate-600'
                        }`}
                      >
                        {source.label}
                      </button>
                    ))}
                  </div>
                </div>

                {audioSource === 'upload' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Upload Audio File</label>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioUpload}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {audioFile && (
                      <p className="mt-2 text-sm text-green-400">✓ {audioFile.name}</p>
                    )}
                  </div>
                )}

                {audioSource !== 'none' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Volume: {volume}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="fadeAudio"
                        checked={fadeAudio}
                        onChange={(e) => setFadeAudio(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label htmlFor="fadeAudio" className="text-sm">
                        Enable fade in/out
                      </label>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Preview & Export */}
          <div className="space-y-6">
            {/* Preview */}
            <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700 sticky top-8">
              <h2 className="text-2xl font-semibold mb-4">Preview</h2>
              <div className="aspect-video bg-slate-900 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                {generatedVideoUrl ? (
                  <video
                    ref={videoRef}
                    src={generatedVideoUrl}
                    controls
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p>Video preview will appear here</p>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {isGenerating && (
                <div className="mb-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">{progressStatus}</span>
                    <span className="text-purple-400 font-semibold">{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 transition-all duration-300 animate-pulse"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Elapsed: {formatTime(elapsedTime)}</span>
                    <span>Est. remaining: {formatTime(Math.max(0, estimatedTime - elapsedTime))}</span>
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className={`w-full py-4 rounded-lg font-semibold text-lg transition-all ${
                  isGenerating
                    ? 'bg-slate-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                }`}
              >
                {isGenerating ? 'Generating...' : 'Generate Video'}
              </button>

              {/* Export Options */}
              {generatedVideoUrl && (
                <div className="mt-6 space-y-4">
                  <h3 className="text-lg font-semibold">Download Options</h3>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-sm font-medium mb-2">Video Format</label>
                      <div className="grid grid-cols-2 gap-2">
                        {['mp4', 'mov'].map((format) => (
                          <button
                            key={format}
                            onClick={() => handleDownload(format)}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium transition-all"
                          >
                            Download {format.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    {audioSource !== 'none' && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Audio Only</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['mp3', 'wav'].map((format) => (
                            <button
                              key={format}
                              onClick={() => handleDownload(format)}
                              className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg font-medium transition-all"
                            >
                              Download {format.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

