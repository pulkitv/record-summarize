"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mic, MicOff, Pause, Play, Save, Send, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Progress } from "@/components/ui/progress"
import { CardFooter } from "./ui/card"

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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }

      // Clean up audio context and stream
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }

      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const setupAudioAnalyser = (stream: MediaStream) => {
    audioStreamRef.current = stream

    // Create audio context and analyser
    const audioContext = new AudioContext()
    audioContextRef.current = audioContext

    const analyser = audioContext.createAnalyser()
    analyserRef.current = analyser
    analyser.fftSize = 256

    const source = audioContext.createMediaStreamSource(stream)
    source.connect(analyser)

    // Set up audio level monitoring
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const checkAudioLevel = () => {
      if (analyserRef.current && isRecording && !isPaused) {
        analyserRef.current.getByteFrequencyData(dataArray)

        // Calculate average level
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const average = sum / bufferLength
        const level = Math.min(100, Math.max(0, average * 2)) // Scale to 0-100

        setAudioLevel(level)
        requestAnimationFrame(checkAudioLevel)
      }
    }

    checkAudioLevel()
  }

  const startRecording = async () => {
    if (!meetingName.trim()) {
      toast({
        title: "Meeting name required",
        description: "Please enter a name for your meeting",
        variant: "destructive",
      })
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      // Set up audio analyser for visualizing audio levels
      setupAudioAnalyser(stream)

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        setAudioBlob(audioBlob)
        setRecordingComplete(true)

        // Stop all tracks on the stream
        stream.getTracks().forEach((track) => track.stop())

        // Reset audio level
        setAudioLevel(0)
      }

      mediaRecorder.start(1000)
      setIsRecording(true)
      setIsPaused(false)
      setRecordingComplete(false)
      setDownloadClicked(false)

      // Start timer
      setRecordingTime(0)
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)

      toast({
        title: "Recording started",
        description: "Your meeting is now being recorded",
      })
    } catch (error) {
      console.error("Error accessing microphone:", error)
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to record meetings",
        variant: "destructive",
      })
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume()
        setIsPaused(false)

        // Resume timer
        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1)
        }, 1000)

        toast({
          title: "Recording resumed",
          description: "Your meeting recording has been resumed",
        })
      } else {
        mediaRecorderRef.current.pause()
        setIsPaused(true)

        // Pause timer
        if (timerRef.current) {
          clearInterval(timerRef.current)
        }

        toast({
          title: "Recording paused",
          description: "Your meeting recording has been paused",
        })
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }

      toast({
        title: "Recording completed",
        description: "Your meeting recording has been completed",
      })
    }
  }

  const downloadRecording = () => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${meetingName.replace(/\s+/g, "_")}.webm`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setDownloadClicked(true)

      toast({
        title: "Download started",
        description: "Your recording is being downloaded",
      })
    }
  }

  const sendSummaryEmail = async () => {
    if (!audioBlob || !user?.email) return

    setIsProcessing(true)

    const formData = new FormData()
    formData.append("audio", audioBlob)
    formData.append("meetingName", meetingName)
    formData.append("email", user.email)

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        toast({
          title: "Success!",
          description: "Your meeting summary will be sent to your email shortly",
        })
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to process recording")
      }
    } catch (error) {
      console.error("Error processing recording:", error)
      toast({
        title: "Processing failed",
        description:
          typeof error === "object" && error !== null && "message" in error
            ? String(error.message)
            : "There was an error processing your recording",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

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
            <div className="text-3xl font-mono font-bold">{formatTime(recordingTime)}</div>
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
            <Button onClick={downloadRecording} size="lg" className="gap-2 w-full">
              <Save className="h-5 w-5" />
              Download Recording
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
