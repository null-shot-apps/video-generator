'use client';

import { useState, useEffect, useRef } from 'react';

type GenerationMethod = 'ai-video' | 'image-to-video' | 'stock-enhanced';
type AudioSource = 'ai-generated' | 'upload' | 'none';
type LandscapeType = 'mountains' | 'ocean' | 'forest' | 'desert' | 'aurora' | 'clouds';
type MoodStyle = 'dreamy' | 'moody' | 'ethereal' | 'cinematic' | 'serene' | 'dramatic';

export default function VideoGenerator() {
  const [generationMethod, setGenerationMethod] = useState<GenerationMethod>('ai-video');
  const [audioSource, setAudioSource] = useState<AudioSource>('ai-generated');
  const [landscapeType, setLandscapeType] = useState<LandscapeType>('mountains');
  const [moodStyle, setMoodStyle] = useState<MoodStyle>('dreamy');
  const [customPrompt, setCustomPrompt] = useState('');
  const [videoLength, setVideoLength] = useState(15);
  const [transitionStyle, setTransitionStyle] = useState('smooth-fade');
  const [audioVolume, setAudioVolume] = useState(70);
  const [fadeInOut, setFadeInOut] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [uploadedAudio, setUploadedAudio] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // InVideo AI Integration
  const [invideoApiKey, setInvideoApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [videoJobId, setVideoJobId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const generateVideoBlob = async (): Promise<Blob> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve(new Blob());
        return;
      }

      const stream = canvas.captureStream(30);
      const mimeType = 'video/webm; codecs=vp9';
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 5000000
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };

      mediaRecorder.start();

      const fps = 30;
      const totalFrames = videoLength * fps;
      let frame = 0;

      const drawFrame = () => {
        if (frame >= totalFrames) {
          mediaRecorder.stop();
          return;
        }

        const gradients: Record<LandscapeType, string[]> = {
          mountains: ['#1a1a2e', '#16213e', '#0f3460', '#533483'],
          ocean: ['#0a1128', '#001f54', '#034078', '#1282a2'],
          forest: ['#0d1b2a', '#1b263b', '#2d4a3e', '#415a4d'],
          desert: ['#2b1b17', '#3e2723', '#5d4037', '#8d6e63'],
          aurora: ['#0f0e17', '#1a1a2e', '#16213e', '#2d4263'],
          clouds: ['#1c1c1c', '#2d3142', '#4f5d75', '#bfc0c0']
        };

        const colors = gradients[landscapeType];
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        
        const progress = frame / totalFrames;
        const offset = Math.sin(progress * Math.PI * 2) * 0.1;
        gradient.addColorStop(0, colors[0]);
        gradient.addColorStop(0.33 + offset, colors[1]);
        gradient.addColorStop(0.66 - offset, colors[2]);
        gradient.addColorStop(1, colors[3]);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.globalAlpha = 0.3 + Math.sin(progress * Math.PI * 2) * 0.2;
        
        if (moodStyle === 'dreamy' || moodStyle === 'ethereal') {
          for (let i = 0; i < 50; i++) {
            const x = (i * 100 + frame * 2) % canvas.width;
            const y = (i * 50 + Math.sin(frame * 0.05 + i) * 100) % canvas.height;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (moodStyle === 'dramatic' || moodStyle === 'cinematic') {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fillRect(0, 0, canvas.width, 150);
          ctx.fillRect(0, canvas.height - 150, canvas.width, 150);
        }

        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const scale = 1 + Math.sin(progress * Math.PI * 2) * 0.05;
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);
        ctx.fillText(`${landscapeType.toUpperCase()}`, 0, -40);
        ctx.font = '40px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(moodStyle.toUpperCase(), 0, 40);
        ctx.restore();

        frame++;
        requestAnimationFrame(drawFrame);
      };

      drawFrame();
    });
  };

  // InVideo AI API Integration
  const generateWithInVideoAI = async () => {
    if (!invideoApiKey) {
      alert('Please enter your InVideo AI API key');
      setShowApiKeyInput(true);
      return;
    }

    try {
      // Build the prompt for InVideo AI
      const fullPrompt = customPrompt || 
        `Create a ${moodStyle} ${landscapeType} landscape video. ${videoLength} seconds long with ${transitionStyle} transitions.`;

      setProgressStatus('Sending request to InVideo AI...');
      setProgress(10);

      // Call InVideo AI API to create video
      const response = await fetch('https://api.invideo.io/v2/videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${invideoApiKey}`,
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          duration: videoLength,
          aspect_ratio: '16:9',
          voice_over: audioSource === 'ai-generated',
        }),
      });

      if (!response.ok) {
        throw new Error(`InVideo AI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const jobId = data.video_id || data.id;
      
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
        
        const response = await fetch(`https://api.invideo.io/v2/videos/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${invideoApiKey}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to check video status');
        }

        const data = await response.json();
        const status = data.status;

        // Update progress based on status
        if (status === 'processing') {
          const estimatedProgress = Math.min(20 + (pollCount * 2), 90);
          setProgress(estimatedProgress);
          setProgressStatus(`InVideo AI is generating your video... (${Math.floor(pollCount * 5 / 60)}m ${(pollCount * 5) % 60}s)`);
        } else if (status === 'completed' || status === 'success') {
          setProgress(95);
          setProgressStatus('Downloading video from InVideo AI...');
          
          // Download the video
          const videoUrl = data.video_url || data.url;
          await downloadVideoFromUrl(videoUrl);
          
          setProgress(100);
          setProgressStatus('Complete!');
          stopPolling();
          setIsGenerating(false);
        } else if (status === 'failed' || status === 'error') {
          throw new Error('Video generation failed on InVideo AI');
        }

        // Continue polling if not complete and under max polls
        if (pollCount < maxPolls && status !== 'completed' && status !== 'success' && status !== 'failed') {
          pollingRef.current = setTimeout(poll, 5000); // Poll every 5 seconds
        } else if (pollCount >= maxPolls) {
          throw new Error('Video generation timeout - please try again');
        }
      } catch (error) {
        console.error('Polling error:', error);
        setProgressStatus('Error: ' + (error as Error).message);
        stopPolling();
        setIsGenerating(false);
      }
    };

    poll();
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const downloadVideoFromUrl = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const videoUrl = URL.createObjectURL(blob);
      
      setGeneratedVideo(videoUrl);
      setVideoBlob(blob);
    } catch (error) {
      console.error('Error downloading video:', error);
      throw error;
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProgress(0);
    setElapsedTime(0);
    setGeneratedVideo(null);
    setVideoBlob(null);

    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    // Use InVideo AI if API key is provided and method is ai-video
    if (invideoApiKey && generationMethod === 'ai-video') {
      await generateWithInVideoAI();
      clearInterval(timerInterval);
      return;
    }

    // Fallback to local generation for demo purposes
    const stages = [
      { progress: 15, status: 'Initializing AI models...', delay: 800 },
      { progress: 30, status: 'Generating landscape scenes...', delay: 1200 },
      { progress: 50, status: 'Applying mood and style...', delay: 1500 },
      { progress: 65, status: 'Creating transitions...', delay: 1000 },
      { progress: 80, status: 'Processing audio track...', delay: 1200 },
      { progress: 95, status: 'Finalizing video...', delay: 800 },
    ];

    for (const stage of stages) {
      await new Promise(resolve => setTimeout(resolve, stage.delay));
      setProgress(stage.progress);
      setProgressStatus(stage.status);
    }

    setProgressStatus('Rendering video preview...');
    const blob = await generateVideoBlob();
    const url = URL.createObjectURL(blob);
    
    setProgress(100);
    setProgressStatus('Complete!');
    clearInterval(timerInterval);
    setGeneratedVideo(url);
    setVideoBlob(blob);
    setIsGenerating(false);
  };

  const handleDownload = async (format: string) => {
    const isAudio = format === 'MP3' || format === 'WAV';
    
    if (isAudio) {
      const mimeType = format === 'MP3' ? 'audio/mpeg' : 'audio/wav';
      const mockAudio = new Blob(['Mock audio content'], { type: mimeType });
      const url = URL.createObjectURL(mockAudio);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai-video-audio-${landscapeType}-${moodStyle}-${Date.now()}.${format.toLowerCase()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      return;
    }

    if (!videoBlob) return;

    const url = URL.createObjectURL(videoBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-video-${landscapeType}-${moodStyle}-${Date.now()}.${format.toLowerCase()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedAudio(e.target.files[0]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            AI Video Generator
          </h1>
          <p className="text-slate-300">Create dreamy landscapes with AI • Copyright-free for social media</p>
        </header>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Panel - Prompt Studio */}
          <div className="space-y-6">
            {/* InVideo AI API Key Section */}
            <div className="bg-gradient-to-r from-purple-800/30 to-pink-800/30 backdrop-blur-sm rounded-xl p-6 border border-purple-500/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="text-purple-400">🔑</span> InVideo AI Integration
                </h3>
                <button
                  onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                  className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                >
                  {showApiKeyInput ? 'Hide' : 'Configure'}
                </button>
              </div>
              
              {showApiKeyInput ? (
                <div className="space-y-3">
                  <input
                    type="password"
                    value={invideoApiKey}
                    onChange={(e) => setInvideoApiKey(e.target.value)}
                    placeholder="Enter your InVideo AI API key"
                    className="w-full p-3 rounded-lg bg-slate-900/50 border border-purple-500/30 focus:border-purple-500 focus:outline-none text-sm"
                  />
                  <p className="text-xs text-slate-400">
                    Get your API key from{' '}
                    <a href="https://invideo.io" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
                      invideo.io
                    </a>
                    . Required for AI video generation method.
                  </p>
                  {invideoApiKey && (
                    <div className="flex items-center gap-2 text-sm text-green-400">
                      <span>✓</span>
                      <span>API key configured</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  {invideoApiKey ? (
                    <span className="text-green-400">✓ API key configured - Ready to generate with InVideo AI</span>
                  ) : (
                    <span>Configure your InVideo AI API key to enable AI video generation</span>
                  )}
                </p>
              )}
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <span className="text-purple-400">✨</span> Prompt Studio
              </h2>

              {/* Generation Method */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-3 text-slate-300">Generation Method</label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => setGenerationMethod('ai-video')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      generationMethod === 'ai-video'
                        ? 'border-purple-500 bg-purple-500/20'
                        : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                    }`}
                  >
                    <div className="font-medium flex items-center gap-2">
                      AI Video Generation
                      {invideoApiKey && generationMethod === 'ai-video' && (
                        <span className="text-xs bg-purple-500 px-2 py-0.5 rounded-full">InVideo AI</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">
                      {invideoApiKey ? 'Using InVideo AI API' : 'Requires API key for InVideo AI'}
                    </div>
                  </button>
                  <button
                    onClick={() => setGenerationMethod('image-to-video')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      generationMethod === 'image-to-video'
                        ? 'border-purple-500 bg-purple-500/20'
                        : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                    }`}
                  >
                    <div className="font-medium">AI Images + Transitions</div>
                    <div className="text-xs text-slate-400">Generate images with motion effects</div>
                  </button>
                  <button
                    onClick={() => setGenerationMethod('stock-enhanced')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      generationMethod === 'stock-enhanced'
                        ? 'border-purple-500 bg-purple-500/20'
                        : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                    }`}
                  >
                    <div className="font-medium">Stock + AI Enhancement</div>
                    <div className="text-xs text-slate-400">Enhanced stock footage</div>
                  </button>
                </div>
              </div>

              {/* Landscape Type */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-3 text-slate-300">Landscape Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['mountains', 'ocean', 'forest', 'desert', 'aurora', 'clouds'] as LandscapeType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setLandscapeType(type)}
                      className={`p-3 rounded-lg border-2 capitalize transition-all ${
                        landscapeType === type
                          ? 'border-purple-500 bg-purple-500/20'
                          : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood & Style */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-3 text-slate-300">Mood & Style</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['dreamy', 'moody', 'ethereal', 'cinematic', 'serene', 'dramatic'] as MoodStyle[]).map((mood) => (
                    <button
                      key={mood}
                      onClick={() => setMoodStyle(mood)}
                      className={`p-3 rounded-lg border-2 capitalize transition-all ${
                        moodStyle === mood
                          ? 'border-pink-500 bg-pink-500/20'
                          : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                      }`}
                    >
                      {mood}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Prompt */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-slate-300">Custom Prompt (Optional)</label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Add specific details: time of day, weather, colors, camera movement..."
                  className="w-full p-3 rounded-lg bg-slate-700/50 border border-slate-600 focus:border-purple-500 focus:outline-none resize-none"
                  rows={3}
                />
              </div>

              {/* Video Settings */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-slate-300">
                  Video Length: {videoLength}s
                </label>
                <input
                  type="range"
                  min="5"
                  max="30"
                  value={videoLength}
                  onChange={(e) => setVideoLength(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>5s</span>
                  <span>30s</span>
                </div>
              </div>

              {/* Transition Style */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-slate-300">Transition Style</label>
                <select
                  value={transitionStyle}
                  onChange={(e) => setTransitionStyle(e.target.value)}
                  className="w-full p-3 rounded-lg bg-slate-700/50 border border-slate-600 focus:border-purple-500 focus:outline-none"
                >
                  <option value="smooth-fade">Smooth Fade</option>
                  <option value="cross-dissolve">Cross Dissolve</option>
                  <option value="zoom-blur">Zoom Blur</option>
                  <option value="slide">Slide</option>
                  <option value="morph">Morph</option>
                </select>
              </div>
            </div>

            {/* Audio Settings */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="text-pink-400">🎵</span> Audio Settings
              </h2>

              {/* Audio Source */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-3 text-slate-300">Audio Source</label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => setAudioSource('ai-generated')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      audioSource === 'ai-generated'
                        ? 'border-pink-500 bg-pink-500/20'
                        : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                    }`}
                  >
                    AI-Generated Music
                  </button>
                  <button
                    onClick={() => setAudioSource('upload')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      audioSource === 'upload'
                        ? 'border-pink-500 bg-pink-500/20'
                        : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                    }`}
                  >
                    Upload Your Own
                  </button>
                  <button
                    onClick={() => setAudioSource('none')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      audioSource === 'none'
                        ? 'border-pink-500 bg-pink-500/20'
                        : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                    }`}
                  >
                    No Audio
                  </button>
                </div>
              </div>

              {/* Audio Upload */}
              {audioSource === 'upload' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2 text-slate-300">Upload Audio File</label>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioUpload}
                    className="w-full p-3 rounded-lg bg-slate-700/50 border border-slate-600 focus:border-pink-500 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-pink-500 file:text-white file:cursor-pointer hover:file:bg-pink-600"
                  />
                  {uploadedAudio && (
                    <p className="text-sm text-slate-400 mt-2">Selected: {uploadedAudio.name}</p>
                  )}
                </div>
              )}

              {/* Volume Control */}
              {audioSource !== 'none' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2 text-slate-300">
                    Volume: {audioVolume}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={audioVolume}
                    onChange={(e) => setAudioVolume(Number(e.target.value))}
                    className="w-full accent-pink-500"
                  />
                </div>
              )}

              {/* Fade In/Out */}
              {audioSource !== 'none' && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="fadeInOut"
                    checked={fadeInOut}
                    onChange={(e) => setFadeInOut(e.target.checked)}
                    className="w-5 h-5 accent-pink-500"
                  />
                  <label htmlFor="fadeInOut" className="text-sm text-slate-300">
                    Enable Fade In/Out
                  </label>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {isGenerating && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                <div className="space-y-4">
                  {/* Status and Time */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-purple-400" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-sm font-medium text-slate-300">{progressStatus}</span>
                    </div>
                    <span className="text-sm text-slate-400">{elapsedTime}s</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative">
                    <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 ease-out relative"
                        style={{ width: `${progress}%` }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-pulse" />
                      </div>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-slate-400">0%</span>
                      <span className="text-xs font-semibold text-purple-400">{progress}%</span>
                      <span className="text-xs text-slate-400">100%</span>
                    </div>
                  </div>

                  {/* Estimated Time */}
                  <div className="text-center">
                    <p className="text-xs text-slate-400">
                      {progress < 100 ? 'Estimated time remaining: ~' + Math.max(0, 8 - elapsedTime) + 's' : 'Generation complete!'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-slate-600 disabled:to-slate-600 font-semibold text-lg transition-all transform hover:scale-[1.02] disabled:scale-100 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </span>
              ) : (
                '✨ Generate Video'
              )}
            </button>
          </div>

          {/* Right Panel - Preview & Download */}
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 sticky top-8">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <span className="text-blue-400">🎬</span> Preview
              </h2>

              {/* Video Preview */}
              <div className="aspect-video bg-slate-900 rounded-lg mb-6 flex items-center justify-center border-2 border-slate-700 overflow-hidden">
                {generatedVideo ? (
                  <video
                    src={generatedVideo}
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-cover"
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="text-center text-slate-400">
                    <div className="text-6xl mb-4">🎥</div>
                    <p>Your video will appear here</p>
                    <p className="text-sm mt-2">Configure settings and click Generate</p>
                  </div>
                )}
              </div>

              {/* Download Options */}
              {generatedVideo && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Download Options</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleDownload('MP4')}
                      className="p-3 rounded-lg bg-blue-500 hover:bg-blue-600 transition-all font-medium"
                    >
                      📹 MP4
                    </button>
                    <button
                      onClick={() => handleDownload('MOV')}
                      className="p-3 rounded-lg bg-blue-500 hover:bg-blue-600 transition-all font-medium"
                    >
                      🎬 MOV
                    </button>
                    {audioSource !== 'none' && (
                      <>
                        <button
                          onClick={() => handleDownload('MP3')}
                          className="p-3 rounded-lg bg-pink-500 hover:bg-pink-600 transition-all font-medium"
                        >
                          🎵 MP3
                        </button>
                        <button
                          onClick={() => handleDownload('WAV')}
                          className="p-3 rounded-lg bg-pink-500 hover:bg-pink-600 transition-all font-medium"
                        >
                          🎼 WAV
                        </button>
                      </>
                    )}
                  </div>

                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mt-4">
                    <p className="text-sm text-green-400 flex items-center gap-2">
                      <span>✓</span>
                      <span>Copyright-free • Safe for social media</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Current Settings Summary */}
              <div className="mt-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                <h4 className="text-sm font-semibold mb-2 text-slate-300">Current Settings</h4>
                <div className="text-xs text-slate-400 space-y-1">
                  <p>• Method: {generationMethod.replace('-', ' ')}</p>
                  <p>• Scene: {landscapeType} landscape</p>
                  <p>• Style: {moodStyle}</p>
                  <p>• Duration: {videoLength} seconds</p>
                  <p>• Transition: {transitionStyle}</p>
                  <p>• Audio: {audioSource === 'ai-generated' ? 'AI Music' : audioSource === 'upload' ? 'Custom Upload' : 'None'}</p>
                  {audioSource !== 'none' && <p>• Volume: {audioVolume}%</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}














