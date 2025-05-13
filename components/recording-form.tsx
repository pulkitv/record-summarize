"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mic, MicOff, Pause, Play, Save, Send, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Progress } from "@/components/ui/progress"
import { CardFooter } from "./ui/card"

// Import types from FFmpeg (will be dynamically imported at runtime)
type FFmpeg = any; // We'll use 'any' until we load the actual type
type ToBlobURL = (url: string, type: string) => Promise<string>;

interface User {
  email: string;
}

export function RecordingForm({ user }: { user: User }) {
  // State
  const { toast } = useToast()
  const [meetingName, setMeetingName] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingComplete, setRecordingComplete] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [downloadClicked, setDownloadClicked] = useState(false)
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<number>(0)
  
  // Separate loading states for each button
  const [isDownloading, setIsDownloading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  
  // FFmpeg refs (only initialized in browser)
  const ffmpegRef = useRef<FFmpeg | null>(null)
  const toBlobURLRef = useRef<ToBlobURL | null>(null)
  
  // Load FFmpeg only on client-side
  useEffect(() => {
    // Skip on server-side
    if (typeof window === 'undefined') return
  
    const loadFFmpeg = async () => {
      try {
        // Dynamically import FFmpeg modules
        const { FFmpeg } = await import('@ffmpeg/ffmpeg')
        const { toBlobURL } = await import('@ffmpeg/util')
        
        // Create FFmpeg instance
        const ffmpegInstance = new FFmpeg()
        ffmpegRef.current = ffmpegInstance
        toBlobURLRef.current = toBlobURL
        
        // Load FFmpeg core files
        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd"
        await ffmpegInstance.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
        })
        
        setFfmpegLoaded(true)
        console.log("FFmpeg loaded successfully")
      } catch (error) {
        console.error("Failed to load FFmpeg:", error)
        toast({ 
          title: "Audio conversion unavailable",
          description: "MP3 conversion may not work. This won't affect recording.",
          variant: "destructive"
        })
      }
    }
  
    loadFFmpeg()
    
    // Clean up on unmount
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (audioContextRef.current) audioContextRef.current.close()
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [toast])
  
  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  
  // Set up audio analyzer for visualizing sound levels
  const setupAudioAnalyser = (stream: MediaStream) => {
    audioStreamRef.current = stream
    const audioContext = new AudioContext()
    audioContextRef.current = audioContext
    const analyser = audioContext.createAnalyser()
    analyserRef.current = analyser
    analyser.fftSize = 256
    const source = audioContext.createMediaStreamSource(stream)
    source.connect(analyser)
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    
    const checkAudioLevel = () => {
      if (analyserRef.current && isRecording && !isPaused) {
        analyserRef.current.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i]
        const average = sum / bufferLength
        const level = Math.min(100, Math.max(0, average * 2))
        setAudioLevel(level)
        requestAnimationFrame(checkAudioLevel)
      }
    }
    
    checkAudioLevel()
  }
  
  // Start recording audio
  const startRecording = async () => {
    if (!meetingName.trim()) {
      toast({ 
        title: "Meeting name required", 
        description: "Please enter a name for your meeting", 
        variant: "destructive" 
      })
      return
    }
    
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      
      // Set up audio analyzer for visualizing levels
      setupAudioAnalyser(stream)
      
      // Handle data from mic
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }
      
      // Handle when recording stops
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        setAudioBlob(audioBlob)
        setRecordingComplete(true)
        stream.getTracks().forEach((track) => track.stop())
        setAudioLevel(0)
      }
      
      // Start recording
      mediaRecorder.start(1000)
      setIsRecording(true)
      setIsPaused(false)
      setRecordingComplete(false)
      setDownloadClicked(false)
      setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000)
      
      toast({ 
        title: "Recording started", 
        description: "Your meeting is now being recorded" 
      })
    } catch (error) {
      console.error("Error accessing microphone:", error)
      toast({ 
        title: "Microphone access denied", 
        description: "Please allow microphone access to record", 
        variant: "destructive" 
      })
    }
  }
  
  // Pause/resume recording
  const pauseRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return
    
    if (isPaused) {
      // Resume recording
      mediaRecorderRef.current.resume()
      setIsPaused(false)
      timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000)
      toast({ title: "Recording resumed" })
    } else {
      // Pause recording
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      if (timerRef.current) clearInterval(timerRef.current)
      toast({ title: "Recording paused" })
    }
  }
  
  // Stop recording
  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return
    
    mediaRecorderRef.current.stop()
    setIsRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
    toast({ title: "Recording completed" })
  }
  
  // Convert webm to mp3
  const convertToMp3 = async (webmBlob: Blob): Promise<Blob> => {
    if (!ffmpegRef.current) {
      throw new Error("FFmpeg is not loaded")
    }
    
    try {
      // Convert the Blob to ArrayBuffer and then to Uint8Array
      const arrayBuffer = await webmBlob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      // Write the file to FFmpeg's virtual file system
      await ffmpegRef.current.writeFile("input.webm", uint8Array)
      
      // Run FFmpeg command to convert webm to mp3
      await ffmpegRef.current.exec(["-i", "input.webm", "output.mp3"])
      
      // Read the result file
      const data = await ffmpegRef.current.readFile("output.mp3")
      
      // Create a Blob from the result
      let uint8ArrayData: Uint8Array;
      
      // Handle different return types - might be direct Uint8Array or an object with data property
      if (data instanceof Uint8Array) {
        uint8ArrayData = data;
      } else if (typeof data === 'object' && data.type === 'Uint8Array' && data.data instanceof Uint8Array) {
        uint8ArrayData = data.data;
      } else if (typeof data === 'object' && data.type === 'string' && typeof data.data === 'string') {
        // Convert string to Uint8Array
        const encoder = new TextEncoder();
        uint8ArrayData = encoder.encode(data.data);
      } else {
        // Fallback - attempt to convert to Uint8Array
        uint8ArrayData = new Uint8Array(data as any);
      }
      
      return new Blob([uint8ArrayData], { type: "audio/mpeg" })
    } catch (error) {
      console.error("Error converting to MP3:", error)
      throw new Error("Failed to convert audio to MP3 format")
    }
  }
  
  // Simulate download progress
  const simulateDownloadProgress = (setDProgress: React.Dispatch<React.SetStateAction<number>>) => {
    setDProgress(0);
    
    // Use a non-linear progress simulation to feel more realistic
    let progress = 0;
    const totalSteps = 20; // Number of progress updates
    let step = 0;
    
    const interval = setInterval(() => {
      step++;
      
      // Calculate progress with easing - slower at start and end, faster in middle
      if (step <= totalSteps / 3) {
        // Slow start - linear
        progress = (step / (totalSteps / 3)) * 30; // First third goes to 30%
      } else if (step <= 2 * (totalSteps / 3)) {
        // Fast middle - accelerated
        const midStep = step - (totalSteps / 3);
        progress = 30 + (midStep / (totalSteps / 3)) * 50; // Middle third goes from 30% to 80%
      } else {
        // Slow end - decelerated
        const endStep = step - 2 * (totalSteps / 3);
        progress = 80 + (endStep / (totalSteps / 3)) * 20; // Last third goes from 80% to 100%
      }
      
      setDProgress(Math.min(Math.round(progress), 99)); // Cap at 99% until complete
      
      if (step >= totalSteps) {
        clearInterval(interval);
        
        // Give a slight delay before showing 100% to make it feel more natural
        setTimeout(() => {
          setDProgress(100);
        }, 200);
      }
    }, 100); // Update every 100ms for a total of ~2 seconds
    
    return interval;
  };
  
  // Helper method for iOS to create a playable and saveable data URL
  const saveAsBase64ForIOS = () => {
    if (!audioBlob) return;
    
    // Create a temporary storage for the blob data
    const reader = new FileReader();
    
    // Simulate download progress
    simulateDownloadProgress(setDownloadProgress);
    
    reader.onload = () => {
      try {
        setTimeout(() => {
          setDownloadProgress(0);
          setIsDownloading(false);
        }, 300);
        
        // Create or get the preview container
        let previewContainer = document.getElementById('recording-preview-container');
        if (!previewContainer) {
          previewContainer = document.createElement('div');
          previewContainer.id = 'recording-preview-container';
          previewContainer.className = 'mt-6 p-4 border rounded-lg bg-gray-50';
          document.querySelector('.space-y-6')?.appendChild(previewContainer);
        }
        
        // Clear previous content
        previewContainer.innerHTML = '';
        
        // Create header and instructions
        previewContainer.innerHTML = `
          <h3 class="font-medium text-gray-900 mb-2">Recording Preview</h3>
          <p class="text-sm text-gray-500 mb-3">Listen to your recording and save it:</p>
        `;
        
        // Create an audio element for playback
        const audioElement = document.createElement('audio');
        audioElement.controls = true;
        audioElement.src = reader.result as string;
        audioElement.style.width = "100%";
        audioElement.className = "mt-2";
        previewContainer.appendChild(audioElement);
        
        // Add a line break
        previewContainer.appendChild(document.createElement('br'));
        
        // Create download link with data URI
        const downloadLink = document.createElement('a');
        downloadLink.href = reader.result as string;
        downloadLink.download = `${meetingName}.webm`;
        downloadLink.className = "mt-3 inline-block px-4 py-2 bg-primary text-white rounded-md text-sm font-medium";
        downloadLink.innerText = "Save Recording (Tap and Hold)";
        previewContainer.appendChild(downloadLink);
        
        // Add iOS-specific instructions
        const iosInstructions = document.createElement('p');
        iosInstructions.className = 'text-xs text-gray-500 mt-2';
        iosInstructions.innerHTML = 'On iOS: Tap and hold on the audio player or button above, then select "Download" or "Save to Files"';
        previewContainer.appendChild(iosInstructions);
        
        // Update UI state and show toast
        toast({ 
          title: "Recording ready", 
          description: "Tap and hold on the audio player or button to save" 
        });
        setDownloadClicked(true);
      } catch (error) {
        console.error("Error creating preview:", error);
        setDownloadProgress(0);
        setIsDownloading(false);
        toast({ 
          title: "Preview error", 
          description: "Unable to create recording preview", 
          variant: "destructive" 
        });
      }
    };
    
    reader.onerror = () => {
      console.error("FileReader error:", reader.error);
      setDownloadProgress(0);
      setIsDownloading(false);
      toast({ 
        title: "Processing failed", 
        description: "Unable to process recording", 
        variant: "destructive" 
      });
    };
    
    // Read the audio blob as data URL
    reader.readAsDataURL(audioBlob);
  };
  
  // Download or share recording
  const downloadRecording = async () => {
    if (!audioBlob) return;
    
    try {
      setIsDownloading(true);
      
      // Check if iOS
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                         (/WebKit/.test(navigator.userAgent) || /AppleWebKit/.test(navigator.userAgent));
      
      if (isIOSDevice) {
        console.log("iOS device detected, using data URL method");
        saveAsBase64ForIOS();
      } else {
        console.log("Using standard download method");
        // Standard download method for non-iOS devices
        const url = window.URL.createObjectURL(audioBlob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `${meetingName}.webm`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Show toast after successful download
        toast({ 
          title: "Download started", 
          description: `Your recording has been downloaded as ${meetingName}.webm` 
        });
        
        setDownloadClicked(true);
        setIsDownloading(false);
      }
    } catch (error) {
      console.error("Download error:", error);
      toast({ 
        title: "Download failed", 
        description: "An error occurred during download", 
        variant: "destructive" 
      });
      setIsDownloading(false);
    }
  };
  
  // Send email with transcription
  const sendSummaryEmail = async () => {
    if (!audioBlob || !user?.email) return
    
    setIsSending(true)
    
    try {
      // Check if FFmpeg is loaded, if not, try to load it
      if (!ffmpegRef.current || !toBlobURLRef.current) {
        toast({ 
          title: "Loading audio converter", 
          description: "Please wait while we prepare for conversion..." 
        })
        
        try {
          // Dynamically import FFmpeg modules
          const { FFmpeg } = await import('@ffmpeg/ffmpeg')
          const { toBlobURL } = await import('@ffmpeg/util')
          
          // Create FFmpeg instance
          const ffmpegInstance = new FFmpeg()
          ffmpegRef.current = ffmpegInstance
          toBlobURLRef.current = toBlobURL
          
          // Load FFmpeg core files
          const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd"
          await ffmpegInstance.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
          })
          
          setFfmpegLoaded(true)
        } catch (error) {
          console.error("Failed to load FFmpeg:", error)
          throw new Error("Could not load audio converter. Please try again later.")
        }
      }
      
      // Convert audio to MP3
      toast({ 
        title: "Converting audio", 
        description: "Converting your recording to MP3 format for transcription..." 
      })
      
      const mp3Blob = await convertToMp3(audioBlob)
      
      toast({ 
        title: "Conversion complete", 
        description: "Your audio has been converted to MP3 format" 
      })
      
      // Create form data for API request
      const formData = new FormData()
      formData.append("audio", mp3Blob, "audio.mp3")
      formData.append("meetingName", meetingName)
      formData.append("email", user.email)
      
      // Send to API
      toast({ 
        title: "Processing", 
        description: "Sending your recording for transcription and summarization..." 
      })
      
      const response = await fetch("/api/transcribe", { 
        method: "POST", 
        body: formData 
      })
      
      if (response.ok) {
        toast({ 
          title: "Success!", 
          description: "Summary sent to your email" 
        })
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to process recording")
      }
    } catch (error) {
      console.error("Email processing error:", error)
      toast({ 
        title: "Processing failed", 
        description: String(error), 
        variant: "destructive" 
      })
    } finally {
      setIsSending(false)
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Meeting name input */}
      <div>
        <label htmlFor="meeting-name" className="block text-sm font-medium text-gray-700 mb-1">
          Meeting Name
        </label>
        <Input
          id="meeting-name"
          placeholder="Enter meeting name"
          value={meetingName}
          onChange={(e) => setMeetingName(e.target.value)}
          disabled={isRecording || recordingComplete}
          className="w-full"
        />
      </div>
  
      {/* Recording progress UI */}
      {isRecording && (
        <div className="bg-gray-50 p-4 rounded-lg border">
          <div className="text-center mb-2">
            <div className="text-3xl font-mono font-bold text-black">
              {formatTime(recordingTime)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {isPaused ? "Recording paused" : "Recording in progress..."}
            </div>
          </div>
  
          {!isPaused && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Audio Level</span>
                <span>{Math.round(audioLevel)}%</span>
              </div>
              <Progress value={audioLevel} className="h-2" />
            </div>
          )}
        </div>
      )}
  
      {/* Recording controls */}
      <div className="flex flex-col gap-4">
        {/* Start recording button */}
        {!isRecording && !recordingComplete && (
          <Button onClick={startRecording} size="lg" className="gap-2">
            <Mic className="h-5 w-5" />
            Start Recording
          </Button>
        )}
  
        {/* Recording controls */}
        {isRecording && (
          <div className="flex gap-4">
            <Button onClick={pauseRecording} variant="outline" size="lg" className="gap-2 flex-1">
              {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              {isPaused ? "Resume" : "Pause"}
            </Button>
            <Button onClick={stopRecording} variant="destructive" size="lg" className="gap-2 flex-1">
              <MicOff className="h-5 w-5" />
              Stop Recording
            </Button>
          </div>
        )}
  
        {/* Post-recording controls */}
        {recordingComplete && (
          <div className="space-y-4">
            {/* Download recording button */}
            <Button 
              onClick={downloadRecording} 
              size="lg" 
              className="gap-2 w-full"
              disabled={isDownloading || isSending}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {downloadProgress > 0 ? `Processing (${downloadProgress}%)` : "Processing..."}
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  Save Recording
                </>
              )}
            </Button>

            {/* Progress bar for download/processing */}
            {isDownloading && downloadProgress > 0 && (
              <div className="w-full mt-2">
                <Progress value={downloadProgress} className="h-2" />
              </div>
            )}

            {/* Container for recording preview (populated by JavaScript) */}
            <div id="recording-preview-container"></div>

            {/* Send email button */}
            <Button
              onClick={sendSummaryEmail}
              variant={downloadClicked ? "default" : "outline"}
              size="lg"
              className="gap-2 w-full"
              disabled={isSending || !downloadClicked || isDownloading}
            >
              {isSending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Send summary to email
                </>
              )}
            </Button>

            {/* Instruction message */}
            {!downloadClicked && (
              <p className="text-sm text-muted-foreground text-center">
                Please save your recording first
              </p>
            )}
          </div>
        )}
      </div>
  
      {/* User info footer */}
      {user && (
        <CardFooter className="border-t bg-gray-50 text-sm text-muted-foreground px-6 py-4 -mx-6 mt-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
              <span className="text-white text-xs">✓</span>
            </div>
            Signed in as: {user.email}
          </div>
        </CardFooter>
      )}
    </div>
  )
}