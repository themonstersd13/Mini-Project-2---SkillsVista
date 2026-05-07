"use client";

import { formatDistanceToNow } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Flame,
  Trophy,
  Target,
  BarChart3,
  MessageSquare,
  FolderClock,
  BrainCircuit,
  Send,
  Loader2,
  Plus,
} from "lucide-react";
import { AppNav } from "@/components/shared/app-nav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { MoodSparkline } from "@/components/ui/mood-sparkline";
import { SwotToastContainer, type SwotToast } from "@/components/ui/swot-toast";
import { apiFetch } from "@/lib/client";

type Message = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
  moodScore?: number | null;
};

type SessionInfo = {
  id: string;
  startedAt: string;
  lastMessageAt: string;
  summary: string | null;
  messageCount: number;
};

type GoalData = {
  id: string;
  title: string;
  status: string;
  progress: number;
  completion?: number;
  completedTasks?: number;
  totalTasks?: number;
};

type FollowUpData = {
  id: string;
  question: string;
  context: string | null;
  status: string;
  createdAt: string;
};

type StreakData = {
  current: number;
  longest: number;
  lastActive: string;
};

type ChatGetResponse = {
  messages: Message[];
  sessionId: string;
  sessionHistory: SessionInfo[];
  followUps: FollowUpData[];
  proactiveHints: string[];
  streak: StreakData | null;
};

type GoalsResponse = {
  goals: GoalData[];
};

type SseEventPayload = {
  text?: string;
  error?: string;
  message?: Message;
  updates?: Array<{ title: string; status: string; reason: string }>;
};

export function ChatSurface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionInfo[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpData[]>([]);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [moodHistory, setMoodHistory] = useState<number[]>([]);
  const [recentSwotChanges, setRecentSwotChanges] = useState<
    Array<{ title: string; status: string; reason: string }>
  >([]);
  const [swotToasts, setSwotToasts] = useState<SwotToast[]>([]);
  const [draft, setDraft] = useState("");
  const [goalDraft, setGoalDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);
  const [pastMessages, setPastMessages] = useState<Message[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function loadData() {
    setError(null);
    try {
      const [chatData, goalData] = await Promise.all([
        apiFetch<ChatGetResponse>("/api/chat"),
        apiFetch<GoalsResponse>("/api/goals"),
      ]);
      setMessages(chatData.messages);
      setSessionId(chatData.sessionId);
      setSessionHistory(chatData.sessionHistory);
      setFollowUps(chatData.followUps);
      setStreak(chatData.streak);
      setGoals(goalData.goals);

      const moods = chatData.messages
        .filter((m) => m.role === "USER" && m.moodScore != null)
        .map((m) => m.moodScore as number)
        .slice(-5);
      setMoodHistory(moods);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load coach",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      await loadData();
    })();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function viewPastSession(sid: string) {
    if (sid === sessionId) {
      setViewingSessionId(null);
      setPastMessages([]);
      return;
    }
    try {
      const data = await apiFetch<{ messages: Message[] }>(
        `/api/sessions?sessionId=${sid}`,
      );
      setPastMessages(data.messages);
      setViewingSessionId(sid);
    } catch {
      // ignore
    }
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim() || sending) return;

    setViewingSessionId(null);
    setPastMessages([]);

    const userText = draft.trim();
    const userMessage: Message = {
      id: `optimistic-user-${Date.now()}`,
      role: "USER",
      content: userText,
      createdAt: new Date().toISOString(),
    };

    const assistantMessageId = `streaming-assistant-${Date.now()}`;
    const assistantPlaceholder: Message = {
      id: assistantMessageId,
      role: "ASSISTANT",
      content: "",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setDraft("");
    setSending(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ message: userText }),
      });

      if (!response.ok || !response.body) {
        throw new Error("SSE stream unavailable");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const applyToken = (text: string) => {
        setMessages((prev) =>
          prev.map((entry) =>
            entry.id === assistantMessageId
              ? { ...entry, content: entry.content + text }
              : entry,
          ),
        );
      };

      const finalize = (data: SseEventPayload) => {
        if (data.message) {
          setMessages((prev) =>
            prev.map((entry) =>
              entry.id === assistantMessageId ? data.message! : entry,
            ),
          );
        }
        if (data.updates) {
          setRecentSwotChanges(data.updates);
          // Show toast notifications for meaningful SWOT changes
          const meaningfulUpdates = data.updates.filter(
            (u) => u.status !== "UNCHANGED",
          );
          if (meaningfulUpdates.length > 0) {
            setSwotToasts((prev) => [
              ...prev,
              ...meaningfulUpdates.map((u, i) => ({
                id: `toast-${Date.now()}-${i}`,
                title: u.title,
                status: u.status,
                reason: u.reason,
              })),
            ]);
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const lines = frame.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));
          const eventName = eventLine?.replace("event:", "").trim();
          const dataRaw = dataLine?.replace("data:", "").trim() ?? "{}";

          let data: SseEventPayload = {};
          try {
            data = JSON.parse(dataRaw) as SseEventPayload;
          } catch {
            data = {};
          }

          if (eventName === "token" && data.text) applyToken(data.text);
          if (eventName === "done") finalize(data);
          if (eventName === "error")
            throw new Error(data.error ?? "Streaming failed");
        }
      }
    } catch (sendError) {
      try {
        const fallback = await apiFetch<{ message: Message }>("/api/chat", {
          method: "POST",
          body: JSON.stringify({ message: userText }),
        });
        setMessages((prev) =>
          prev.map((entry) =>
            entry.id === assistantMessageId ? fallback.message : entry,
          ),
        );
      } catch {
        setError(
          sendError instanceof Error
            ? sendError.message
            : "Failed to send message",
        );
      }
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!goalDraft.trim()) return;
    try {
      await apiFetch("/api/goals", {
        method: "POST",
        body: JSON.stringify({ title: goalDraft.trim() }),
      });
      setGoalDraft("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create goal");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.closest("form");
      if (form) form.requestSubmit();
    }
  }

  const activeGoals = goals.filter((g) => g.status === "ACTIVE");
  const displayMessages = viewingSessionId ? pastMessages : messages;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <AppNav />
      <main className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-6 md:grid-cols-[280px_1fr] md:px-8">
        {/* ── Sidebar ── */}
        <div className="space-y-4">
          {/* Streak */}
          {streak && streak.current > 0 && (
            <Card className="p-5 text-center">
              <motion.div
                className="mb-1 flex justify-center"
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Flame size={28} className="text-orange-500" />
              </motion.div>
              <p className="text-2xl font-extrabold text-[var(--text)]">
                {streak.current}{" "}
                <span className="text-base font-medium text-black/50">
                  day streak
                </span>
              </p>
              {streak.current >= streak.longest && streak.current > 1 && (
                <p className="mt-1 flex items-center justify-center gap-1 text-xs font-semibold text-amber-600">
                  <Trophy size={12} /> Personal best!
                </p>
              )}
            </Card>
          )}

          {/* Goals */}
          <Card className="p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-black/50">
              <Target size={14} /> Active Goals
            </h2>
            <div className="mt-3 space-y-3">
              {activeGoals.map((goal) => {
                const progress = goal.completion ?? goal.progress ?? 0;
                return (
                  <div key={goal.id}>
                    <p className="text-sm font-medium text-[var(--text)]">
                      {goal.title}
                    </p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/8">
                      <motion.div
                        className="h-full rounded-full bg-[var(--brand)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress * 100}%` }}
                        transition={{ duration: 0.8 }}
                      />
                    </div>
                    <p className="mt-0.5 text-[11px] text-black/45">
                      {(progress * 100).toFixed(0)}%
                      {goal.totalTasks
                        ? ` · ${goal.completedTasks}/${goal.totalTasks} tasks`
                        : ""}
                    </p>
                  </div>
                );
              })}
              {activeGoals.length === 0 && (
                <p className="text-xs text-black/45">No active goals yet.</p>
              )}
            </div>
            <form onSubmit={handleAddGoal} className="mt-4 flex gap-2">
              <Input
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                placeholder="Add a goal..."
                className="flex-1 text-xs"
              />
              <button
                type="submit"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand)] text-white transition hover:bg-[var(--brand-strong)]"
              >
                <Plus size={16} />
              </button>
            </form>
          </Card>

          {/* Recent SWOT Changes */}
          {recentSwotChanges.length > 0 && (
            <Card className="p-5">
              <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-black/50">
                <BarChart3 size={14} /> Your Profile Changed
              </h2>
              <p className="mt-1 text-[11px] text-black/35">
                These updates were discovered from this conversation
              </p>
              <div className="mt-3 space-y-2">
                {recentSwotChanges
                  .filter((c) => c.status !== "UNCHANGED")
                  .slice(0, 5)
                  .map((c, i) => {
                    const isNew = c.status === "CREATED";
                    const label = isNew ? "New insight" : c.status === "STALE" ? "Needs review" : "Reinforced";
                    const dotColor = isNew ? "bg-emerald-500" : c.status === "STALE" ? "bg-amber-500" : "bg-blue-500";
                    return (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${dotColor}`} />
                        <div>
                          <span className="font-medium text-black/70">{c.title}</span>
                          <span className="ml-1.5 text-black/40">— {label}</span>
                          {c.reason && <p className="mt-0.5 text-[11px] text-black/35">{c.reason}</p>}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Card>
          )}

          {/* Follow-ups */}
          {followUps.length > 0 && (
            <Card className="p-5">
              <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-black/50">
                <MessageSquare size={14} /> Pending Follow-ups
              </h2>
              <div className="mt-3 space-y-2">
                {followUps.slice(0, 3).map((f) => (
                  <p
                    key={f.id}
                    className="border-l-2 border-[var(--brand)] pl-2 text-xs italic text-black/55"
                  >
                    {f.question}
                  </p>
                ))}
              </div>
            </Card>
          )}

          {/* Past Sessions */}
          {sessionHistory.length > 1 && (
            <Card className="p-5">
              <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-black/50">
                <FolderClock size={14} /> Past Sessions
              </h2>
              <div className="mt-3 space-y-1">
                {sessionHistory.map((s) => {
                  const isCurrent = s.id === sessionId;
                  const isViewing = s.id === viewingSessionId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => viewPastSession(s.id)}
                      disabled={isCurrent}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition ${
                        isCurrent
                          ? "bg-[var(--brand)]/10 font-semibold text-[var(--brand)] cursor-default"
                          : isViewing
                            ? "bg-black/8 text-[var(--text)]"
                            : "text-black/60 hover:bg-black/5"
                      }`}
                    >
                      <span>
                        {formatDistanceToNow(new Date(s.startedAt), {
                          addSuffix: true,
                        })}
                      </span>
                      <span className="text-black/35">
                        {s.messageCount} msgs
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* ── Chat Main ── */}
        <Card className="flex min-h-[75vh] flex-col overflow-hidden p-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/8 px-5 py-3">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-[var(--text)]">
                Chat Coach
              </h1>
              <Badge>
                {viewingSessionId ? "Viewing past session" : "Context-aware"}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              {moodHistory.length >= 2 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-black/40">Mood</span>
                  <MoodSparkline values={moodHistory} />
                </div>
              )}
              {streak && streak.current > 0 && (
                <span className="flex items-center gap-1 text-sm font-semibold text-amber-600">
                  <Flame size={14} /> {streak.current}d
                </span>
              )}
            </div>
          </div>

          {/* Past session banner */}
          {viewingSessionId && (
            <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-5 py-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <FolderClock size={13} /> Viewing a past session (read-only)
              </p>
              <button
                onClick={() => {
                  setViewingSessionId(null);
                  setPastMessages([]);
                }}
                className="text-xs font-semibold text-amber-700 hover:underline"
              >
                ← Back to current
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {loading && (
              <div className="flex flex-col items-center gap-3 py-16">
                <TypingIndicator />
                <p className="text-sm text-black/40">
                  Loading your conversation...
                </p>
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            {!loading && displayMessages.length === 0 && !viewingSessionId && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand)]/10">
                  <BrainCircuit size={32} className="text-[var(--brand)]" />
                </div>
                <p className="text-lg font-semibold text-[var(--text)]">
                  Welcome to your growth session
                </p>
                <p className="mt-2 max-w-md text-sm text-black/50">
                  Share your daily progress, blockers, and wins. Your coach
                  remembers everything across sessions and connects daily effort
                  to long-term growth.
                </p>
              </div>
            )}

            {displayMessages.map((msg, idx) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.015, 0.25) }}
                className={`flex gap-3 ${msg.role === "USER" ? "flex-row-reverse" : ""}`}
              >
                {msg.role === "ASSISTANT" && (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/10">
                    <BrainCircuit size={16} className="text-[var(--brand)]" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "USER"
                      ? "rounded-br-md bg-[var(--brand)] text-white"
                      : "rounded-bl-md border border-black/8 bg-white text-[var(--text)] shadow-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={`mt-1.5 text-[10px] ${
                      msg.role === "USER" ? "text-white/60" : "text-black/35"
                    }`}
                  >
                    {formatDistanceToNow(new Date(msg.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </motion.div>
            ))}

            {sending && messages[messages.length - 1]?.content === "" && (
              <div className="ml-11">
                <TypingIndicator />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {!viewingSessionId && (
            <form
              onSubmit={sendMessage}
              className="border-t border-black/8 px-4 py-3"
            >
              <div className="flex items-end gap-3 rounded-xl border border-black/10 bg-white px-3 py-2 transition focus-within:border-[var(--brand)]/40 focus-within:ring-2 focus-within:ring-[var(--brand)]/10">
                <textarea
                  ref={textareaRef}
                  placeholder="Share today's progress, blockers, and wins..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 resize-none border-none bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-black/30"
                  rows={2}
                  style={{ maxHeight: 120 }}
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--brand)] text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </div>
            </form>
          )}
        </Card>
      </main>
      <SwotToastContainer
        toasts={swotToasts}
        onDismiss={(id) => setSwotToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}
