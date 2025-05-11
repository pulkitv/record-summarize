import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mic, Clock, Send, Download, Calendar, Plus } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

// Mock data for demonstration
interface Recording {
  id: string;
  name: string;
  date: Date;
  duration: string;
  transcribed: boolean;
}

const MOCK_RECORDINGS: Recording[] = [
  // {
  //   id: "rec_1",
  //   name: "Weekly Team Standup",
  //   date: new Date(Date.now() - 1000 * 60 * 60 * 2),
  //   duration: "15:23",
  //   transcribed: true,
  // },
  // {
  //   id: "rec_2",
  //   name: "Product Planning",
  //   date: new Date(Date.now() - 1000 * 60 * 60 * 24),
  //   duration: "45:12",
  //   transcribed: true,
  // },
  // {
  //   id: "rec_3",
  //   name: "Client Meeting - ABC Corp",
  //   date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
  //   duration: "32:40",
  //   transcribed: false,
  // },
];

export default async function DashboardPage() {
  const session = await getServerSession(authConfig);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="container py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Manage your recordings and transcriptions</p>
        </div>
        <Button asChild>
          <Link href="/record" className="gap-2">
            <Plus className="h-4 w-4" />
            New Recording
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="recordings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recordings" className="gap-2">
            <Mic className="h-4 w-4" />
            Recordings
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-2">
            <Calendar className="h-4 w-4" />
            Upcoming
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recordings" className="space-y-4">
          {MOCK_RECORDINGS.length === 0 ? (
            <Card>
              <CardContent className="py-10">
                <div className="flex flex-col items-center justify-center text-center space-y-3">
                  <div className="bg-primary/10 p-3 rounded-full">
                    <Mic className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">No recordings yet</h3>
                  <p className="text-muted-foreground max-w-sm">
                    You haven't recorded any meetings yet. Start recording to see them here.
                  </p>
                  <Button asChild>
                    <Link href="/record">Start Recording</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {MOCK_RECORDINGS.map((recording) => (
                <Card key={recording.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="truncate">{recording.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(recording.date, { addSuffix: true })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">Duration: {recording.duration}</div>
                    <div className="text-sm mt-1">
                      Status:{" "}
                      {recording.transcribed ? (
                        <span className="text-green-600 font-medium">Transcribed</span>
                      ) : (
                        <span className="text-amber-600 font-medium">Not transcribed</span>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex gap-2 border-t bg-muted/50 p-2">
                    <Button size="sm" variant="ghost" className="w-full gap-1">
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                    {!recording.transcribed && (
                      <Button size="sm" variant="ghost" className="w-full gap-1">
                        <Send className="h-4 w-4" />
                        Transcribe
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upcoming">
          <Card>
            <CardContent className="py-10">
              <div className="flex flex-col items-center justify-center text-center space-y-3">
                <div className="bg-primary/10 p-3 rounded-full">
                  <Calendar className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">No upcoming meetings</h3>
                <p className="text-muted-foreground max-w-sm">
                  Connect your calendar to see upcoming meetings that you can record.
                </p>
                <Button variant="outline">Connect Calendar</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
