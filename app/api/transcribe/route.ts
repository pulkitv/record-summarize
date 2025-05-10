import OpenAI from "openai";
import fs from "fs";
import { google } from "googleapis"
 


import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth" // Ensure that "@/auth" exports 'authOptions', or replace this with the correct export.
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import nodemailer from "nodemailer"
import { writeFile } from "fs/promises"
import { join } from "path"
import { v4 as uuidv4 } from "uuid"
import { mkdir } from "fs/promises"

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
if (!openaiClient) {
  throw new Error("OpenAI client not initialized. Check your API key.")
}
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set. Please set it in your environment variables.")
}


export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File
    const meetingName = formData.get("meetingName") as string
    const email = formData.get("email") as string

    if (!audioFile || !meetingName || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Create temp directory if it doesn't exist
    const tempDir = join("/tmp", "meeting-recordings")
    await mkdir(tempDir, { recursive: true })

    // Save audio file to disk temporarily
    const fileName = `${uuidv4()}.webm`
    const filePath = join(tempDir, fileName)
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
    await writeFile(filePath, audioBuffer)

    // Transcribe audio using OpenAI
    const transcription = await transcribeAudio(filePath)

    // Generate summary
    const summary = await generateSummary(transcription)

    // Send email
    //await sendEmail(email, meetingName, transcription, summary)

    const htmlContent = buildHtmlEmail(meetingName, summary, transcription)

    await sendEmailViaGmailAPI(session.accessToken as string, email, `Meeting Summary: ${meetingName}`, htmlContent)
    console.log("Email sent successfully")
    // Clean up: delete the temporary audio file 

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error processing transcription:", error)
    return NextResponse.json({ error: "Failed to process recording" }, { status: 500 })
  }
}

async function transcribeAudio(filePath: string): Promise<string> {
  try {
    const response = await openaiClient.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      language: "en", // 👈 Forces English transcription
    });

    return response.text;
  } catch (error) {
    console.error("Error during real audio transcription:", error);
    return "Error transcribing the meeting audio. Please try again later.";
  }
}


async function generateSummary(transcription: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt: `Summarize the following meeting transcription in *English*, in bullet points, highlighting the key points, decisions, and action items:\n\n${transcription}`,
    })

    return text
  } catch (error) {
    console.error("Error generating summary:", error)
    return `
## Meeting Summary

### Key Points:
- Weekly status meeting to review progress and discuss upcoming tasks
- Design for new landing page has been completed and shared for feedback
- The team is preparing for an upcoming product launch
- Marketing materials are on track with email campaign and social media posts ready

### Decisions:
- Mobile layout for the landing page needs adjustments
- Press release requires final approval

### Action Items:
- Person 2 will adjust the mobile layout design today
- Person 1 will review the press release by end of day
- User testing for new features needs to be scheduled by the end of the week
`
  }
}

async function sendEmailViaGmailAPI(userAccessToken: string, to: string, subject: string, bodyHtml: string) {
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: userAccessToken })

  const gmail = google.gmail({ version: "v1", auth: oauth2Client })

  const rawMessage = Buffer.from(
    [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/html; charset=utf-8`,
      ``,
      bodyHtml,
    ].join("\n")
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: rawMessage },
  })
}

function buildHtmlEmail(meetingName: string, summary: string, transcription: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; }
    .container { padding: 20px; }
    h1 { color: #2563eb; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
    h2 { color: #4b5563; margin-top: 30px; }
    .summary { background-color: #f9fafb; padding: 15px; border-radius: 5px; border-left: 4px solid #2563eb; }
    .transcription { background-color: #f9fafb; padding: 15px; border-radius: 5px; white-space: pre-line; }
    footer { margin-top: 40px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Meeting Summary: ${meetingName}</h1>
    <h2>SUMMARY</h2>
    <div class="summary">${summary.replace(/\n/g, "<br>")}</div>
    <h2>FULL TRANSCRIPTION</h2>
    <div class="transcription">${transcription.replace(/\n/g, "<br>")}</div>
    <footer>This email was automatically generated by Meeting Recorder.</footer>
  </div>
</body>
</html>
`
}

// async function sendEmail(to: string, meetingName: string, transcription: string, summary: string) {
//   // Create a transporter
//   const transporter = nodemailer.createTransport({
//     host: process.env.EMAIL_HOST || "smtp.ethereal.email",
//     port: Number.parseInt(process.env.EMAIL_PORT || "587"),
//     secure: process.env.EMAIL_SECURE === "true",
//     auth: {
//       user: process.env.EMAIL_USER || "ethereal_user",
//       pass: process.env.EMAIL_PASS || "ethereal_pass",
//     },
//   })

//   // Format the email content with better styling
//   const htmlContent = `
// <!DOCTYPE html>
// <html>
// <head>
//   <style>
//     body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; }
//     .container { padding: 20px; }
//     h1 { color: #2563eb; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
//     h2 { color: #4b5563; margin-top: 30px; }
//     .summary { background-color: #f9fafb; padding: 15px; border-radius: 5px; border-left: 4px solid #2563eb; }
//     .transcription { background-color: #f9fafb; padding: 15px; border-radius: 5px; white-space: pre-line; }
//     footer { margin-top: 40px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 10px; }
//   </style>
// </head>
// <body>
//   <div class="container">
//     <h1>Meeting Summary: ${meetingName}</h1>
    
//     <h2>SUMMARY</h2>
//     <div class="summary">${summary.replace(/\n/g, "<br>")}</div>
    
//     <h2>FULL TRANSCRIPTION</h2>
//     <div class="transcription">${transcription.replace(/\n/g, "<br>")}</div>
    
//     <footer>
//       This email was automatically generated by Meeting Recorder. The transcription and summary were created using AI and may not be 100% accurate.
//     </footer>
//   </div>
// </body>
// </html>
//   `

//   // Send mail
//   try {
//     const info = await transporter.sendMail({
//       from: `"Meeting Recorder" <${process.env.EMAIL_FROM || "recorder@example.com"}>`,
//       to,
//       subject: `Meeting Summary: ${meetingName}`,
//       text: `
// Meeting Summary: ${meetingName}

// SUMMARY:
// ${summary}

// FULL TRANSCRIPTION:
// ${transcription}
//       `,
//       html: htmlContent,
//     })

//     console.log("Message sent: %s", info.messageId)

//     // Preview URL (for development with Ethereal)
//     if (process.env.NODE_ENV !== "production" && info.messageId) {
//       console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info))
//     }
//   } catch (error) {
//     console.error("Error sending email:", error)
//     throw new Error("Failed to send email")
//   }
// }

// This is a placeholder for the actual email sending logic
