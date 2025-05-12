"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mic, MicOff, Pause, Play, Save, Send, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Progress } from "@/components/ui/progress"
import { CardFooter } from "./ui/card"
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

// Initialize ffmpeg outside component to avoid recreating it
const ffmpeg = new FFmpeg();

interface User {
  email: string;
}

export function RecordingForm({ user }: { user: User }) {
  const { toast } = useToast()
  const [meetingName, setMeetingName] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingComplete, setRecordingComplete] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [downloadClicked, setDownloadClicked] = useState(false)
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)

  // Load FFmpeg on mount
  useEffect(() => {
    const loadFFmpeg = async () => {
      try {
        // Load the FFmpeg wasm binary
        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
        });
        setFfmpegLoaded(true);
      } catch (error) {
        console.error("Error loading FFmpeg:", error);
        toast({ 
          title: "Error loading media converter", 
          description: "Could not load the audio converter. MP3 conversion might not work.", 
          variant: "destructive" 
        });
      }
    };
    
    loadFFmpeg();
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (audioContextRef.current) audioContextRef.current.close()
      if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach((track) => track.stop())
    }
  }, [toast])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

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

  const startRecording = async () => {
    if (!meetingName.trim()) {
      toast({ title: "Meeting name required", description: "Please enter a name for your meeting", variant: "destructive" })
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      setupAudioAnalyser(stream)
      mediaRecorder.ondataavailable = (event) => audioChunksRef.current.push(event.data)
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        setAudioBlob(audioBlob)
        setRecordingComplete(true)
        stream.getTracks().forEach((track) => track.stop())
        setAudioLevel(0)
      }
      mediaRecorder.start(1000)
      setIsRecording(true)
      setIsPaused(false)
      setRecordingComplete(false)
      setDownloadClicked(false)
      setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000)
      toast({ title: "Recording started", description: "Your meeting is now being recorded" })
    } catch (error) {
      console.error("Error accessing microphone:", error)
      toast({ title: "Microphone access denied", description: "Please allow microphone access", variant: "destructive" })
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume()
        setIsPaused(false)
        timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000)
        toast({ title: "Recording resumed" })
      } else {
        mediaRecorderRef.current.pause()
        setIsPaused(true)
        if (timerRef.current) clearInterval(timerRef.current)
        toast({ title: "Recording paused" })
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) clearInterval(timerRef.current)
      toast({ title: "Recording completed" })
    }
  }

  const convertToMp3 = async (webmBlob: Blob): Promise<Blob> => {
    try {
      // Convert the Blob to ArrayBuffer and then to Uint8Array
      const arrayBuffer = await webmBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Write the file to FFmpeg's virtual file system
      await ffmpeg.writeFile("input.webm", uint8Array);
      
      // Run the FFmpeg command to convert webm to mp3
      await ffmpeg.exec(["-i", "input.webm", "output.mp3"]);
      
      // Read the result
      const data = await ffmpeg.readFile("output.mp3");
      
      // Create a Blob from the result
      return new Blob([data], { type: "audio/mpeg" });
    } catch (error) {
      console.error("Error converting to MP3:", error);
      throw new Error("Failed to convert audio format");
    }
  }

  const downloadRecording = async () => {
    if (!audioBlob) return;

    try {
      let blobToDownload = audioBlob;
      let fileExtension = "webm";
      
      // If FFmpeg is loaded, convert to MP3 first
      if (ffmpegLoaded) {
        try {
          setIsProcessing(true);
          toast({ title: "Converting audio", description: "Please wait while we convert your recording to MP3 format..." });
          blobToDownload = await convertToMp3(audioBlob);
          fileExtension = "mp3";
          toast({ title: "Conversion complete", description: "Your audio has been converted to MP3 format" });
        } catch (error) {
          console.error("Error converting to MP3:", error);
          toast({ 
            title: "Conversion failed", 
            description: "Could not convert to MP3. Downloading in original format.", 
            variant: "destructive" 
          });
        } finally {
          setIsProcessing(false);
        }
      }
      
      // Create download link
      const url = URL.createObjectURL(blobToDownload);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `${meetingName}.${fileExtension}`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setDownloadClicked(true);
      toast({ title: "Download started", description: `Your recording has been downloaded as ${meetingName}.${fileExtension}` });
    } catch (error) {
      console.error("Download error:", error);
      toast({ title: "Download failed", description: "An error occurred during download", variant: "destructive" });
    }
  };

  const sendSummaryEmail = async () => {
    if (!audioBlob || !user?.email) return;
    setIsProcessing(true);
    
    try {
      let mp3Blob: Blob;
      
      // Convert to MP3 if needed
      if (ffmpegLoaded) {
        try {
          mp3Blob = await convertToMp3(audioBlob);
          toast({ title: "Conversion complete", description: "Your audio has been converted to MP3 format" });
        } catch (error) {
          console.error("Error converting to MP3:", error);
          toast({ 
            title: "Conversion failed", 
            description: "Could not convert to MP3. Using original format.", 
            variant: "destructive" 
          });
          mp3Blob = audioBlob;
        }
      } else {
        mp3Blob = audioBlob;
      }
      
      const formData = new FormData();
      formData.append("audio", mp3Blob, "audio.mp3");
      formData.append("meetingName", meetingName);
      formData.append("email", user.email);
      
      const response = await fetch("/api/transcribe", { 
        method: "POST", 
        body: formData 
      });
      
      if (response.ok) {
        toast({ title: "Success!", description: "Summary sent to your email" });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process");
      }
    } catch (error) {
      toast({ 
        title: "Processing failed", 
        description: String(error), 
        variant: "destructive" 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
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

      {isRecording && (
        <div className="bg-gray-50 p-4 rounded-lg border">
          <div className="text-center mb-2">
          <div className="text-3xl font-mono font-bold text-black">{formatTime(recordingTime)}</div>
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

      <div className="flex flex-col gap-4">
        {!isRecording && !recordingComplete && (
          <Button onClick={startRecording} size="lg" className="gap-2">
            <Mic className="h-5 w-5" />
            Start Recording
          </Button>
        )}

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

        {recordingComplete && (
          <div className="space-y-4">
            <Button 
              onClick={downloadRecording} 
              size="lg" 
              className="gap-2 w-full"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  Download Recording
                </>
              )}
            </Button>

            <Button
              onClick={sendSummaryEmail}
              variant={downloadClicked ? "default" : "outline"}
              size="lg"
              className="gap-2 w-full"
              disabled={isProcessing || !downloadClicked}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Send summary on email
                </>
              )}
            </Button>

            {!downloadClicked && (
              <p className="text-sm text-muted-foreground text-center">Please download your recording first</p>
            )}
          </div>
        )}
      </div>

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