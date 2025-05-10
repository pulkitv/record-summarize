import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";

import { RecordingForm } from "@/components/recording-form";

export default async function RecordPage() {
  const session: { user: { name: string; email: string } } | null = await getServerSession(authConfig);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="container max-w-3xl py-10">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="border-b">
          <CardTitle className="text-2xl">Record Meeting</CardTitle>
          <CardDescription>
            Record your meeting, then get a transcription and summary via email
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <RecordingForm user={session.user} />
        </CardContent>
      </Card>
    </div>
  );
}
