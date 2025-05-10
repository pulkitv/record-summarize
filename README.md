# record-summarize
This project records a meeting, transcribes it, and then summarizes it 


# 🎙️ Record Summarize

A full-stack Next.js application that allows users to:
- Record audio directly in the browser
- Transcribe the audio using OpenAI Whisper
- Summarize the content using GPT-4o
- Email the summary and transcription to the logged-in user

## 🚀 Features

- ✨ Clean UI for recording meetings
- 🧠 Automatic transcription with OpenAI Whisper
- 📝 Smart meeting summaries using GPT-4o
- 📧 Summary and transcript emailed to your Google account
- 🔒 Authenticated via Google (NextAuth)

## 🛠️ Tech Stack

- **Next.js 14**
- **NextAuth.js** (Google OAuth)
- **OpenAI Whisper API** (audio transcription)
- **GPT-4o** via AI SDK (`ai` package)
- **Nodemailer** for email delivery
- **Tailwind CSS** + **Radix UI**

## 📦 Installation

```bash
git clone https://github.com/pulkitv/record-summarize.git
cd record-summarize
npm install

