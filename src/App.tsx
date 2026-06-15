import React, { useState, useRef, useEffect } from 'react';
import { 
  Video, 
  Upload, 
  Languages, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  RotateCcw, 
  Sparkles, 
  Check, 
  AlertTriangle, 
  HelpCircle,
  Clock, 
  User, 
  AudioWaveform, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Download, 
  RefreshCw,
  Sliders,
  Volume1,
  Youtube
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DialogueSegment, VoiceName, AVAILABLE_VOICES, TARGET_LANGUAGES } from './types';
import { SAMPLE_PROJECTS } from './data/samples';
import { audioBufferToWavBase64, encodeWAV } from './utils/audioEncoder';

interface PlayingItem {
  id: string;
  audio: HTMLAudioElement;
  startedAt: number;
  hasPlayed: boolean;
}

export default function App() {
  // App state
  const [selectedProjectId, setSelectedProjectId] = useState<string>('sample_jobs');
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [videoName, setVideoName] = useState<string>('');
  
  // Custom uploaded states
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [currentAudioBuffer, setCurrentAudioBuffer] = useState<AudioBuffer | null>(null);

  // YouTube features states
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
  const [youtubeId, setYoutubeId] = useState<string>('');
  const [isAnalyzingYoutube, setIsAnalyzingYoutube] = useState<boolean>(false);

  // Workflow states
  const [segments, setSegments] = useState<DialogueSegment[]>([]);
  const [targetLang, setTargetLang] = useState<string>('vi');
  const [defaultVoice, setDefaultVoice] = useState<VoiceName>('Kore');
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  
  // Custom segment audio playback controls
  const [originalVolume, setOriginalVolume] = useState<number>(0.3); // Duck the original audio by default!
  const [dubbedVolume, setDubbedVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Error / Info states
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Video / Audio references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  
  // Track audio nodes currently speaking to avoid overlapping or duplicate plays
  const playingAudiosRef = useRef<Record<string, PlayingItem>>({});

  // Initialize with Sample Project
  useEffect(() => {
    const sample = SAMPLE_PROJECTS.find(p => p.id === selectedProjectId);
    if (sample) {
      // Clear previously loaded segment audio URLs
      cleanupAllAudioUrls();
      
      setVideoSrc(sample.videoUrl);
      setVideoName(sample.name);
      setTargetLang(sample.targetLanguage);
      setSegments(sample.segments.map(s => ({
        ...s,
        audioUrl: undefined, // Let them synthesize dynamically
        isGenerating: false
      })));
      setCurrentAudioBuffer(null);
      setYoutubeId('');
      setYoutubeUrl('');
      setApiError(null);
      setSuccessMsg(`Đã tải mẫu: ${sample.name}`);
    } else if (selectedProjectId === 'custom_project' || selectedProjectId === 'youtube_project') {
      cleanupAllAudioUrls();
      setVideoSrc('');
      setVideoName('');
      setSegments([]);
      setCurrentAudioBuffer(null);
      setYoutubeId('');
      setYoutubeUrl('');
    }
  }, [selectedProjectId]);

  // Analyze YouTube Link and get Translated cues
  const triggerYoutubeDub = async () => {
    if (!youtubeUrl) {
      setApiError("Vui lòng nhập đường dẫn video YouTube.");
      return;
    }

    setIsAnalyzingYoutube(true);
    setApiError(null);
    setSuccessMsg(null);
    setSegments([]);

    try {
      const response = await fetch('/api/dub/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeUrl,
          targetLanguage: targetLang
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Không thể phân tích video YouTube.");
      }

      setYoutubeId(data.videoId);
      setVideoName(`YouTube: ${data.videoId}`);
      setVideoSrc(''); // Clear standard file source since we use YouTube player

      const parsedSegments: DialogueSegment[] = data.segments.map((s: any) => ({
        id: s.id || `yt_seg_${Math.random().toString(36).substr(2, 9)}`,
        start: Number(s.start),
        end: Number(s.end),
        speaker: s.speaker || "Speaker",
        originalText: s.originalText || "",
        translatedText: s.translatedText || "",
        isGenerating: false
      }));

      // Sort segments
      parsedSegments.sort((a, b) => a.start - b.start);
      setSegments(parsedSegments);
      setCurrentTime(0);
      setSuccessMsg(`Tuyệt vời! Đã dịch thành công thành ${parsedSegments.length} phân đoạn từ YouTube video.`);
    } catch (err: any) {
      console.error(err);
      setApiError(`Lỗi phân tích YouTube: ${err.message}`);
    } finally {
      setIsAnalyzingYoutube(false);
    }
  };

  // Simulated timeline update when playing a YouTube Video
  useEffect(() => {
    if (!youtubeId || !isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime(prevTime => {
        const nextTime = Math.round((prevTime + 0.1) * 10) / 10;
        
        // Find if we are currently inside any segment timeline to play audio
        segments.forEach(seg => {
          if (nextTime >= seg.start && nextTime <= seg.end) {
            // Trigger automated audio dub play!
            if (seg.audioUrl) {
              const playedState = playingAudiosRef.current[seg.id];
              const needsPlay = !playedState || !playedState.hasPlayed;

              if (needsPlay) {
                if (playedState) playedState.audio.pause();

                const audioObj = new Audio(seg.audioUrl);
                audioObj.volume = dubbedVolume;
                audioObj.play().catch(e => console.log("Audio play deferred:", e));

                playingAudiosRef.current[seg.id] = {
                  id: seg.id,
                  audio: audioObj,
                  startedAt: nextTime,
                  hasPlayed: true
                };
              }
            }
          } else {
            // Stop segment audio if head moves out
            const playedState = playingAudiosRef.current[seg.id];
            if (playedState && !playedState.audio.paused && (nextTime < seg.start || nextTime > seg.end + 0.5)) {
              playedState.audio.pause();
              playedState.hasPlayed = false;
            }
          }
        });

        // Loop playhead if it exceeds maximum end
        const maxTimeline = Math.max(...segments.map(s => s.end), 20);
        if (nextTime > maxTimeline + 2) {
          // Stop all
          (Object.values(playingAudiosRef.current) as PlayingItem[]).forEach(item => {
            item.audio.pause();
          });
          playingAudiosRef.current = {};
          return 0;
        }

        // Update active segment
        const activeSeg = segments.find(s => nextTime >= s.start && nextTime <= s.end);
        setActiveSegmentId(activeSeg ? activeSeg.id : null);

        return nextTime;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [youtubeId, isPlaying, segments, dubbedVolume]);

  // Handle segment cleanup
  const cleanupAllAudioUrls = () => {
    // Stop all active playbacks
    (Object.values(playingAudiosRef.current) as PlayingItem[]).forEach(item => {
      item.audio.pause();
    });
    playingAudiosRef.current = {};

    segments.forEach(seg => {
      if (seg.audioUrl && seg.audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(seg.audioUrl);
      }
    });
  };

  // Sync Video and Dubbed audio playhead
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);

      // Find if we are currently inside any segment timeline
      let activeId: string | null = null;
      segments.forEach(seg => {
        if (time >= seg.start && time <= seg.end) {
          activeId = seg.id;

          // Trigger automated audio dub play!
          if (seg.audioUrl && isPlaying) {
            const playedState = playingAudiosRef.current[seg.id];
            
            // If not initialized, or timeline seeked past start/re-entered
            const needsPlay = !playedState || 
              (!playedState.hasPlayed && Math.abs(time - seg.start) < 0.5) ||
              (playedState.audio.paused && Math.abs(time - playedState.startedAt) > 1.0);

            if (needsPlay) {
              // Stop previous play of this segment if any
              if (playedState) playedState.audio.pause();

              const audioObj = new Audio(seg.audioUrl);
              audioObj.volume = dubbedVolume;
              audioObj.play().catch(e => console.log("Audio play deferred:", e));

              playingAudiosRef.current[seg.id] = {
                id: seg.id,
                audio: audioObj,
                startedAt: time,
                hasPlayed: true
              };

              // Temporarily duck original video if desired
              updateVideoVolume(originalVolume * 0.3); // extra ducking during speech
            }
          }
        } else {
          // Play head is outside this segment. Stop its audio if it's currently playing
          const playedState = playingAudiosRef.current[seg.id];
          if (playedState && !playedState.audio.paused && (time < seg.start || time > seg.end + 0.5)) {
            playedState.audio.pause();
            playedState.hasPlayed = false;
            updateVideoVolume(originalVolume); // restore original video volume
          }
        }
      });

      setActiveSegmentId(activeId);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      // Synchronize video muted state
      video.muted = isMuted;
      video.volume = originalVolume;
    };

    const handlePause = () => {
      setIsPlaying(false);
      // Pause all playing dialogues too
      (Object.values(playingAudiosRef.current) as PlayingItem[]).forEach(item => {
        item.audio.pause();
      });
      updateVideoVolume(originalVolume);
    };

    const handleSeeked = () => {
      // Seeked event, reset the "hasPlayed" flag for all segment audios
      (Object.values(playingAudiosRef.current) as PlayingItem[]).forEach(item => {
        item.audio.pause();
      });
      playingAudiosRef.current = {};
      updateVideoVolume(originalVolume);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeked', handleSeeked);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, [segments, isPlaying, originalVolume, dubbedVolume, isMuted]);

  // Adjust volume of video safely
  const updateVideoVolume = (vol: number) => {
    if (videoRef.current && !isMuted) {
      videoRef.current.volume = Math.max(0, Math.min(1, vol));
    }
  };

  // Listen to manual original volume slider updates
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = originalVolume;
    }
  }, [originalVolume]);

  // Drag and drop video file upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setApiError(null);
    setSuccessMsg(null);
    setVideoName(file.name);
    
    try {
      // Create Object URL for previewing in the local video player
      const objUrl = URL.createObjectURL(file);
      setVideoSrc(objUrl);
      
      // Decode audio in browser to create compact downsampled WAV payload
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Read file into block array
      const response = await fetch(objUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      setTranscriptionProgress(25);
      // Decode audio asynchronously
      const audioBuf = await audioCtx.decodeAudioData(arrayBuffer);
      setCurrentAudioBuffer(audioBuf);
      
      setTranscriptionProgress(50);
      setSuccessMsg(`Đã trích xuất dải âm thanh từ file "${file.name}" thành công! Sẵn sàng lồng tiếng.`);
    } catch (err: any) {
      console.error(err);
      setApiError(`Không thể giải mã mã âm thanh từ video: ${err.message}. Hãy đảm bảo tệp video có tiếng và đúng định dạng.`);
    } finally {
      setIsUploading(false);
      setTranscriptionProgress(0);
    }
  };

  // Execute automatic AI audio transcription and translation on backend
  const triggerAutoDubDescription = async () => {
    if (!currentAudioBuffer) {
      setApiError("Vui lòng tải lên một tệp video hoặc âm thanh hợp lệ trước khi phân tích.");
      return;
    }

    setIsTranscribing(true);
    setApiError(null);
    setSuccessMsg(null);
    setTranscriptionProgress(60);

    try {
      // Extract, downsample and compress audio buffer to 16kHz WAV base64
      const { base64, mimeType } = await audioBufferToWavBase64(currentAudioBuffer);
      setTranscriptionProgress(80);

      const response = await fetch('/api/dub/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64,
          mimeType,
          targetLanguage: targetLang
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Gặp sự cố giải bài lồng tiếng.");
      }

      const parsedSegments: DialogueSegment[] = data.segments.map((s: any) => ({
        id: s.id || `seg_${Math.random().toString(36).substr(2, 9)}`,
        start: Number(s.start),
        end: Number(s.end),
        speaker: s.speaker || "Speaker",
        originalText: s.originalText || "",
        translatedText: s.translatedText || "",
        isGenerating: false
      }));

      // Sort by start timestamp
      parsedSegments.sort((a, b) => a.start - b.start);

      setSegments(parsedSegments);
      setSuccessMsg(`Tuyệt vời! Gemini đã phân tách video thành ${parsedSegments.length} phân đoạn lời thoại tự nhiên.`);
    } catch (err: any) {
      console.error(err);
      setApiError(`Phân tích thất bại: ${err.message}`);
    } finally {
      setIsTranscribing(false);
      setTranscriptionProgress(0);
    }
  };

  // Synthesize voice over audio track using TTS for a specific segment row
  const synthesizeSegment = async (id: string) => {
    const segIndex = segments.findIndex(s => s.id === id);
    if (segIndex === -1) return;

    // Mutate state to busy
    const updatedSegments = [...segments];
    updatedSegments[segIndex].isGenerating = true;
    setSegments(updatedSegments);
    setApiError(null);

    try {
      const seg = updatedSegments[segIndex];
      // Select appropriate voice based on priority: custom speaker voice designation or overall default active voice
      const selectedVoice = defaultVoice;

      const response = await fetch('/api/dub/synthesize-segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: seg.translatedText,
          voice: selectedVoice
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Lỗi tạo giọng lồng tiếng.");
      }

      // Convert audio data key to temporary client Blob URL
      const audioBytesStr = data.audioContent;
      const responseBinary = atob(audioBytesStr);
      const outputBuffer = new Uint8Array(responseBinary.length);
      for (let i = 0; i < responseBinary.length; i++) {
        outputBuffer[i] = responseBinary.charCodeAt(i);
      }

      const audioBlob = new Blob([outputBuffer], { type: 'audio/wav' });
      const localUrl = URL.createObjectURL(audioBlob);

      // Clean up previous local URL for memory
      if (seg.audioUrl && seg.audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(seg.audioUrl);
      }

      setSegments(prev => prev.map(s => s.id === id ? {
        ...s,
        audioUrl: localUrl,
        isGenerating: false
      } : s));

      // Visual success notification (gentle)
      setSuccessMsg(`Đã tạo giọng lồng tiếng cho phân đoạn: "${seg.translatedText.substring(0, 20)}..."`);
    } catch (err: any) {
      console.error(err);
      setApiError(`Tổng hợp giọng nói thất bại: ${err.message}`);
      setSegments(prev => prev.map(s => s.id === id ? { ...s, isGenerating: false } : s));
    }
  };

  // Generate dubbed speech audio for ALL segments in sequence
  const synthesizeAllSegments = async () => {
    setIsGeneratingAll(true);
    setApiError(null);
    let successCount = 0;

    try {
      for (const seg of segments) {
        await synthesizeSegment(seg.id);
        successCount++;
      }
      setSuccessMsg(`Hoàn tất tổng hợp mọi lồng tiếng! Nhấn "Play" video để thưởng thức dải phối âm thanh mượt mà.`);
    } catch (err: any) {
      console.error(err);
      setApiError(`Lỗi hàng đợi: ${err.message}`);
    } finally {
      setIsGeneratingAll(false);
    }
  };

  // Modify individual subtitle translations dynamically
  const handleTranslationChange = (id: string, text: string) => {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, translatedText: text } : s));
  };

  // Modify timing bounds directly
  const handleTimingChange = (id: string, field: 'start' | 'end', val: string) => {
    const numVal = parseFloat(val);
    if (isNaN(numVal)) return;
    setSegments(prev => prev.map(s => s.id === id ? { ...s, [field]: numVal } : s));
  };

  // Jump video playhead to a selected time in the editor
  const seekToSegment = (start: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = start;
      if (!isPlaying) {
        videoRef.current.play().catch(e => console.log(e));
      }
    }
  };

  // Delete an existing segment
  const removeSegment = (id: string) => {
    setSegments(prev => prev.filter(s => s.id !== id));
  };

  // Append a empty custom segment cue at current video timeline
  const addNewSegment = () => {
    const currentPlayhead = videoRef.current ? Math.round(videoRef.current.currentTime * 10) / 10 : 0;
    const newSeg: DialogueSegment = {
      id: `custom_${Math.random().toString(36).substr(2, 9)}`,
      start: currentPlayhead,
      end: currentPlayhead + 4.0,
      speaker: 'Speaker',
      originalText: 'Nhập câu nói gốc...',
      translatedText: 'Nhập câu lồng tiếng...',
      isGenerating: false
    };
    setSegments(prev => {
      const updated = [...prev, newSeg];
      updated.sort((a, b) => a.start - b.start);
      return updated;
    });
  };

  // Sound merge compiler to download the entire sync translation tracks as a single PCM WAV audio!
  // This is ultimate level backend engineering capability in browser!
  const downloadDubbedAudioTrack = async () => {
    if (segments.some(s => !s.audioUrl)) {
      setApiError("Vui lòng tạo giọng lồng tiếng (TTS) cho tất cả các phân đoạn trước khi xuất.");
      return;
    }

    try {
      setSuccessMsg("Đang kết xuất và đồng bộ hóa dải âm thanh...");
      
      // We will perform multi-track audio buffer recording in the browser directly!
      const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Find maximum project length
      const totalDuration = Math.max(...segments.map(s => s.end)) + 2.0;
      
      // Offline context to render the mixed channels
      const offlineCtx = new OfflineAudioContext(1, Math.round(44100 * totalDuration), 44100);
      
      // Decode and schedule every dialogue chunk at its exact start timing
      for (const seg of segments) {
        if (!seg.audioUrl) continue;
        const res = await fetch(seg.audioUrl);
        const arrayBuf = await res.arrayBuffer();
        const decoded = await actx.decodeAudioData(arrayBuf);
        
        const source = offlineCtx.createBufferSource();
        source.buffer = decoded;
        
        // Gain node to control volume correctly
        const gainNode = offlineCtx.createGain();
        gainNode.gain.value = dubbedVolume;
        
        source.connect(gainNode);
        gainNode.connect(offlineCtx.destination);
        
        // Schedule accurately
        source.start(seg.start);
      }
      
      const renderedBuffer = await offlineCtx.startRendering();
      
      // Encode as beautiful clean WAV
      const wavBytes = encodeWAV(renderedBuffer.getChannelData(0), 44100);
      const blob = new Blob([wavBytes], { type: 'audio/wav' });
      
      const fileUrl = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = fileUrl;
      downloadAnchor.download = `${videoName.replace(/\.[^/.]+$/, "")}_LồngTiếng_AI.wav`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      
      setSuccessMsg("Đã tải xuống thành công băng âm lồng tiếng chất lượng cao!");
    } catch (e: any) {
      console.error(e);
      setApiError(`Xuất âm thanh thất bại: ${e.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased overflow-x-hidden selection:bg-indigo-600 selection:text-white" id="main_container">
      
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-[-300px] left-[-200px] w-[600px] h-[600px] bg-purple-900/10 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-100px] w-[500px] h-[500px] bg-indigo-900/10 rounded-full filter blur-[100px] pointer-events-none" />

      {/* TOP HEADER */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-4 sticky top-0 z-50 flex flex-wrap items-center justify-between gap-4" id="header">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
            <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">AI Video Auto Dubbing</h1>
            <p className="text-xs text-indigo-400 font-medium">Auto-translation & Speech Voice-over Studio</p>
          </div>
        </div>

        {/* Global Select Preset Example */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">Dự án mẫu:</span>
          <select 
            id="preset_select"
            className="bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-3 text-xs font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {SAMPLE_PROJECTS.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            <option value="custom_project">🆕 Tải Video của riêng bạn (+ Upload)</option>
            <option value="youtube_project">🎬 Dịch qua link YouTube (AI lồng tiếng)</option>
          </select>
        </div>
      </header>

      {/* ERROR & SUCCESS NOTIFICATIONS */}
      <AnimatePresence>
        {apiError && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-red-950/80 border-b border-red-800 text-red-200 px-6 py-3.5 text-xs flex items-center gap-3"
            id="error_banner"
          >
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            <div className="flex-1 font-medium">{apiError}</div>
            <button onClick={() => setApiError(null)} className="hover:text-white font-extrabold focus:outline-none">✕</button>
          </motion.div>
        )}

        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-emerald-950/80 border-b border-emerald-800 text-emerald-200 px-6 py-3.5 text-xs flex items-center gap-3"
            id="success_banner"
          >
            <Check className="h-4 w-4 text-emerald-400 shrink-0" />
            <div className="flex-1 font-medium">{successMsg}</div>
            <button onClick={() => setSuccessMsg(null)} className="hover:text-white font-extrabold focus:outline-none">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CORE WORKSPACE PANEL */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-hidden max-w-[1700px] w-full mx-auto" id="workspace_frame">
        
        {/* LEFT COLUMN: PLAYER & CONFIG (5 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-6" id="player_column">
          
          {/* UPLOAD BOX FOR CUSTOM VIDEOS */}
          {selectedProjectId === 'custom_project' && (
            <div className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-2xl p-5" id="upload_box">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-indigo-400">
                <Video className="h-4 w-4" /> 1. Tải Video lên
              </h3>
              <div 
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-6 text-center cursor-pointer transition bg-slate-950/50 hover:bg-slate-900/30 relative"
                id="drop_zone"
              >
                <input 
                  type="file" 
                  accept="video/*,audio/*"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploading || isTranscribing}
                />
                
                {isUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin" />
                    <p className="text-xs text-slate-300 font-medium">Đang nạp video cấu hình hệ thống...</p>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 max-w-xs mt-1">
                      <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${transcriptionProgress}%` }} />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-200">Kéo thả tệp hoặc click</p>
                    <p className="text-xs text-slate-400">Hỗ trợ MP4, WebM, MKV, MP3, WAV... dung lượng bất kỳ</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* YOUTUBE LINK TRANSLATION BOX */}
          {selectedProjectId === 'youtube_project' && (
            <div className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-2xl p-5" id="youtube_box">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-red-400">
                <Youtube className="h-4.5 w-4.5" /> 1. Dịch qua link YouTube
              </h3>
              <p className="text-xs text-slate-400 mb-3.5 leading-relaxed">
                Nhập đường dẫn video bất kỳ trên YouTube. Gemini sẽ phân tích ngữ cảnh, chuyển ngữ đối thoại tinh tế và phân vai lồng tiếng hoàn chỉnh.
              </p>
              <div className="flex flex-col gap-2.5">
                <input 
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition text-slate-200"
                />
                <button
                  onClick={triggerYoutubeDub}
                  disabled={isAnalyzingYoutube}
                  className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {isAnalyzingYoutube ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Gemini đang phân tích và dịch video...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                      Phân tích & Dịch qua YouTube
                    </>
                  )}
                </button>
              </div>

              {/* Quick suggestions link list */}
              <div className="mt-4 border-t border-slate-800/60 pt-3">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">Gợi ý link hot có sẵn thoại:</span>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => {
                      setYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
                      setSuccessMsg("Đã điền: Rick Astley - Never Gonna Give You Up! Nhấn 'Phân tích & Dịch qua YouTube' để thưởng thức.");
                    }}
                    className="text-[10px] text-left bg-slate-950 hover:bg-slate-900 border border-slate-800/60 hover:border-red-500/40 text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg transition"
                  >
                    🎵 Rick Astley - Never Gonna Give You Up (MV Huyền thoại)
                  </button>
                  <button
                    onClick={() => {
                      setYoutubeUrl("https://www.youtube.com/watch?v=9HAa2V7uAnE");
                      setSuccessMsg("Đã điền: Steve Jobs Stanford Speech! Nhấn 'Phân tích & Dịch qua YouTube' để thưởng thức.");
                    }}
                    className="text-[10px] text-left bg-slate-950 hover:bg-slate-900 border border-slate-800/60 hover:border-red-500/40 text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg transition"
                  >
                    🎓 Steve Jobs' 2005 Stanford Commencement Address
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DUBBING GLOBAL CONFIG */}
          <div className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-2xl p-5" id="global_config">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-indigo-400">
              <Sliders className="h-4 w-4" /> 2. Cấu hình lồng tiếng
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Ngôn ngữ đích (Lọc giọng):</label>
                <div className="relative">
                  <select
                    id="target_lang_select"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-3 pr-8 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 select-arrow"
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                  >
                    {TARGET_LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.flag} &nbsp; {lang.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Giọng đọc chủ đạo:</label>
                <select
                  id="default_voice_select"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  value={defaultVoice}
                  onChange={(e) => setDefaultVoice(e.target.value as VoiceName)}
                >
                  {AVAILABLE_VOICES.map(voice => (
                    <option key={voice.id} value={voice.id}>{voice.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick action button for custom users */}
            {selectedProjectId === 'custom_project' && currentAudioBuffer && (
              <div className="mt-4">
                <button
                  id="analyze_audio_btn"
                  onClick={triggerAutoDubDescription}
                  disabled={isTranscribing}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/10 disabled:opacity-50"
                >
                  {isTranscribing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Gemini đang nghe và dịch lồng tiếng...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Phân tích & Dịch tự động bằng AI (Gemini)
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* DYNAMIC STUDIO DUB GRAPH PLAYER */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative" id="studio_player">
            <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 tracking-wide flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                DUBBING VIDEO MONITOR
              </span>
              <span className="text-[10px] font-mono bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-900">
                {currentTime.toFixed(1)}s
              </span>
            </div>

            {/* Simulated Canvas Waveform / Dynamic Visualizer overlay on Video play */}
            <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden rounded-xl border border-slate-800" id="monitor_stage">
              {youtubeId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&enablejsapi=1&origin=${window.location.origin}`}
                  className="w-full h-full aspect-video border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : videoSrc ? (
                <video 
                  ref={videoRef}
                  src={videoSrc}
                  className="w-full h-full object-contain"
                  controls={false} // Custom controls instead
                />
              ) : (
                <div className="text-center p-6 flex flex-col items-center gap-3">
                  <Video className="h-12 w-12 text-slate-700" />
                  <p className="text-xs text-slate-400">Chọn dự án mẫu, tải video hoặc nhập link YouTube để dịch lồng tiếng</p>
                </div>
              )}

              {/* Dynamic Overlay Dialogs (Dual Subtitles!) */}
              {activeSegmentId && (
                <div className="absolute inset-x-0 bottom-4 text-center px-4 pointer-events-none select-none z-10">
                  <div className="inline-block bg-slate-950/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800/60 max-w-[85%] shadow-xl">
                    {/* Showing original text smaller */}
                    <p className="text-[10px] text-slate-400 italic mb-0.5">
                      {segments.find(s => s.id === activeSegmentId)?.originalText}
                    </p>
                    {/* Showing heavy lồng tiếng translated text */}
                    <p className="text-sm font-bold text-indigo-300 tracking-wide leading-relaxed">
                      {segments.find(s => s.id === activeSegmentId)?.translatedText}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Interactive Player Bar */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button 
                    id="play_btn"
                    onClick={() => {
                      if (youtubeId) {
                        setIsPlaying(!isPlaying);
                      } else if (videoRef.current) {
                        if (isPlaying) videoRef.current.pause();
                        else videoRef.current.play().catch(e => console.log(e));
                      }
                    }}
                    className="h-8 w-8 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white cursor-pointer transition shadow"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
                  </button>
                  <button 
                    id="reset_btn"
                    onClick={() => {
                      if (youtubeId) {
                        setCurrentTime(0);
                        setIsPlaying(false);
                      } else if (videoRef.current) {
                        videoRef.current.currentTime = 0;
                        setIsPlaying(false);
                      }
                    }}
                    className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>

                {/* Simulated Audio Spectrum while talking */}
                <div className="flex-1 flex items-center justify-center gap-1.5 h-6">
                  {[1, 2, 3, 4, 5, 4, 3, 2, 1, 3, 5, 3, 1].map((val, i) => (
                    <div 
                      key={i} 
                      className="w-1 bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ 
                        height: isPlaying ? `${val * (activeSegmentId ? 5 : 2)}px` : '4px',
                        opacity: activeSegmentId ? 1 : 0.4
                      }}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="mute_btn"
                    onClick={() => {
                      setIsMuted(!isMuted);
                      if (videoRef.current) videoRef.current.muted = !isMuted;
                    }}
                    className="text-slate-400 hover:text-white transition"
                  >
                    {isMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* MIXING CONSOLE SLIDERS */}
              <div className="mt-2 border-t border-slate-800/60 pt-3 flex flex-col gap-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sliders className="h-3 w-3 text-indigo-400" /> Bệ Trộn Âm Thanh (Mixing Console)
                </span>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold text-slate-300">Âm lượng Gốc:</span>
                      <span className="text-[10px] font-mono font-bold text-slate-400">{Math.round(originalVolume * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Volume1 className="h-3 w-3 text-slate-500" />
                      <input 
                        id="original_vol"
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={originalVolume} 
                        onChange={(e) => setOriginalVolume(parseFloat(e.target.value))}
                        className="flex-1 accent-indigo-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold text-slate-300">Âm lượng Lồng tiếng:</span>
                      <span className="text-[10px] font-mono font-bold text-indigo-400">{Math.round(dubbedVolume * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3 w-3 text-indigo-500" />
                      <input 
                        id="dubbed_vol"
                        type="range" 
                        min="0" 
                        max="2" 
                        step="0.05" 
                        value={dubbedVolume} 
                        onChange={(e) => setDubbedVolume(parseFloat(e.target.value))}
                        className="flex-1 accent-indigo-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: INTERACTIVE DIALOGUE WORKSPACE (7 cols) */}
        <section className="lg:col-span-7 flex flex-col gap-4 bg-slate-900/40 backdrop-blur border border-slate-800 rounded-2xl p-5" id="workspace_column">
          
          {/* Section title & Bulk actions */}
          <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-800/80">
            <div>
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <AudioWaveform className="h-4.5 w-4.5 text-indigo-400" /> Phân đoạn & Dịch thuật hội thoại
              </h2>
              <p className="text-xs text-slate-400">Tổng quan phụ đề, tinh chỉnh bản dịch và tổng hợp âm lồng tiếng</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="generate_all_btn"
                onClick={synthesizeAllSegments}
                disabled={isGeneratingAll || segments.length === 0}
                className="bg-indigo-600/30 hover:bg-indigo-600/55 border border-indigo-500/50 hover:border-indigo-500 text-indigo-300 hover:text-white font-medium py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {isGeneratingAll ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Đang lồng tất cả...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Lồng tiếng toàn bộ
                  </>
                )}
              </button>

              <button
                id="export_audio_btn"
                onClick={downloadDubbedAudioTrack}
                disabled={segments.length === 0}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-200 hover:text-white font-medium py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Xuất phối âm (.WAV)
              </button>
            </div>
          </div>

          {/* Quick instructions / Empty state indicator */}
          {segments.length === 0 && (
            <div className="my-10 text-center flex flex-col items-center justify-center p-8 border border-dashed border-slate-800 rounded-xl" id="empty_slate">
              <Languages className="h-10 w-10 text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-300">Chưa có phân đoạn đối thoại nào</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
                {selectedProjectId === 'custom_project' 
                  ? 'Hãy tải video lên để Gemini tự động lắng nghe ngôn ngữ hội thoại, chia mốc thời gian và dịch thuật điện ảnh.'
                  : 'Đang tải thông tin tệp mẫu...'}
              </p>
            </div>
          )}

          {/* Intereactive Dialogue segments table list */}
          <div className="flex-1 overflow-y-auto max-h-[520px] pr-1 space-y-3.5 custom-scrollbar" id="segment_list">
            <AnimatePresence initial={false}>
              {segments.map((seg, idx) => (
                <motion.div
                  key={seg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  className={`border transition rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden bg-slate-950/60 ${
                    activeSegmentId === seg.id 
                      ? 'border-indigo-500 ring-1 ring-indigo-500/30' 
                      : 'border-slate-800/80 hover:border-slate-700'
                  }`}
                  id={`segment_row_${seg.id}`}
                >
                  {/* Decorative glowing marker for currently active speaking segment */}
                  {activeSegmentId === seg.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
                  )}

                  {/* Header info of segment (Timeline, speaker identifier) */}
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      {/* Interactive timing row */}
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800/75 py-1 px-2.5 rounded-lg text-xs font-mono text-indigo-300 font-semibold">
                        <Clock className="h-3 w-3 text-slate-500" />
                        <input
                          type="number"
                          step="0.1"
                          value={seg.start}
                          onChange={(e) => handleTimingChange(seg.id, 'start', e.target.value)}
                          className="w-10 bg-transparent text-center focus:outline-none focus:text-indigo-400"
                        />
                        <span className="text-slate-600">-</span>
                        <input
                          type="number"
                          step="0.1"
                          value={seg.end}
                          onChange={(e) => handleTimingChange(seg.id, 'end', e.target.value)}
                          className="w-10 bg-transparent text-center focus:outline-none focus:text-indigo-400"
                        />
                        <span className="text-[10px] text-slate-500 ml-1">giây</span>
                      </div>

                      {/* Speaker Badge */}
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800/75 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300">
                        <User className="h-3 w-3 text-slate-500" />
                        <input 
                          type="text"
                          value={seg.speaker}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, speaker: val } : s));
                          }}
                          className="bg-transparent max-w-[70px] focus:outline-none focus:text-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => seekToSegment(seg.start)}
                        className="text-[11px] font-semibold text-slate-400 hover:text-indigo-300 bg-slate-900 border border-slate-800/60 px-2.5 py-1.5 rounded-lg transition"
                      >
                        Chuyển cảnh
                      </button>

                      {/* Trigger Synthesis for only this Segment */}
                      <button
                        onClick={() => synthesizeSegment(seg.id)}
                        disabled={seg.isGenerating}
                        className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1 cursor-pointer ${
                          seg.audioUrl 
                            ? 'bg-indigo-950/40 border-indigo-900/60 text-indigo-400 hover:bg-indigo-900/30' 
                            : 'bg-emerald-950/40 border-emerald-900/60 text-emerald-400 hover:bg-emerald-900/30'
                        }`}
                      >
                        {seg.isGenerating ? (
                          <>
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            Đang tạo...
                          </>
                        ) : seg.audioUrl ? (
                          <>
                            <Check className="h-3 w-3" />
                            Đã lồng giọng
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3" />
                            Lồng giọng
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => removeSegment(seg.id)}
                        className="p-1 px-1.5 rounded bg-slate-900 hover:bg-red-950 text-slate-500 hover:text-red-400 border border-slate-800 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Side-by-side Translation Interface */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {/* Original transcription display */}
                    <div className="bg-slate-900/50 border border-slate-800/40 rounded-lg p-2.5 flex flex-col justify-between">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Gốc / Transcribed</p>
                      <textarea
                        value={seg.originalText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSegments(prev => prev.map(s => s.id === seg.id ? { ...s, originalText: val } : s));
                        }}
                        className="w-full bg-transparent text-xs text-slate-300 resize-none focus:outline-none min-h-[40px] leading-relaxed"
                      />
                    </div>

                    {/* Target translation box */}
                    <div className="bg-slate-900 border border-indigo-950/50 rounded-lg p-2.5 flex flex-col justify-between focus-within:border-indigo-500/50 transition">
                      <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest block mb-1">Lồng Tiếng / Translation</p>
                      <textarea
                        value={seg.translatedText}
                        onChange={(e) => handleTranslationChange(seg.id, e.target.value)}
                        placeholder="Hãy nhập bản dịch lồng tiếng tự nhiên..."
                        className="w-full bg-transparent text-xs text-slate-200 resize-none focus:outline-none min-h-[40px] leading-relaxed font-medium"
                      />
                    </div>
                  </div>

                  {/* Segment Audio Playback Preview line */}
                  {seg.audioUrl && (
                    <div className="flex items-center gap-2 bg-indigo-950/10 border border-indigo-900/10 rounded-lg py-1.5 px-2.5">
                      <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-widest">Nghe thử dòng:</span>
                      <audio src={seg.audioUrl} controls className="h-6 flex-1 max-w-sm rounded" />
                    </div>
                  )}

                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Add a custom subtitle block button */}
          <button
            id="add_seg_btn"
            onClick={addNewSegment}
            className="w-full py-2 bg-slate-950 border border-slate-800 hover:border-indigo-500/40 text-slate-400 hover:text-slate-200 rounded-xl text-xs flex items-center justify-center gap-2 transition"
          >
            <Plus className="h-4 w-4" /> Thêm mốc thoại mới (Tại vị trí Playhead)
          </button>
        </section>

      </main>

      {/* FOOTER & EDUCATION EXPLANATION */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-5 text-center mt-auto" id="footer">
        <div className="max-w-2xl mx-auto flex flex-col gap-2">
          <p className="text-xs text-slate-500">
            Hệ thống lồng tiếng tự động sử dụng mô hình trí tuệ nhân tạo thế hệ mới <strong className="text-slate-400">Gemini 3.5 Flash</strong> (để lắng nghe tách dòng thoại tự nhiên) và <strong className="text-slate-400">Gemini 3.1 Flash TTS</strong> (cho giọng đọc tự nhiên sinh động).
          </p>
          <p className="text-[10px] text-slate-600">
            © 2026 AI Video Dubbing Studio. Developed via Google AI Studio Build. All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
