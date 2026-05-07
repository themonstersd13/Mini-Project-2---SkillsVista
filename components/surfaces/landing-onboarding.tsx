"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client";

type UserResponse = {
  user: {
    id: string;
    email: string;
    displayName: string;
    onboardingComplete: boolean;
  } | null;
};

const onboardingQuestions = [
  {
    id: "academicBackground",
    prompt: "Tell me about your current academic background.",
    placeholder: "Example: 2nd year Computer Engineering student focusing on web development",
    kind: "text",
  },
  {
    id: "goalsSummary",
    prompt: "What are your top goals for the next 6 months?",
    placeholder: "Example: secure an internship, improve DSA, ship 2 strong projects",
    kind: "text",
  },
  {
    id: "interests",
    prompt: "Which areas do you enjoy learning the most? (comma separated)",
    placeholder: "AI, backend systems, design, leadership",
    kind: "list",
  },
  {
    id: "habits",
    prompt: "Which daily or weekly habits are strongest right now? (comma separated)",
    placeholder: "morning planning, evening revision, weekly mock interviews",
    kind: "list",
  },
  {
    id: "challenges",
    prompt: "What currently blocks your growth? (comma separated)",
    placeholder: "procrastination, time planning, context switching",
    kind: "list",
  },
] as const;

function parseListInput(value: string) {
  return value
    .split(/[,;\n]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function LandingOnboardingSurface() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [step, setStep] = useState(0);
  const [stepInput, setStepInput] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function boot() {
      try {
        const me = await apiFetch<UserResponse>("/api/auth/me");
        if (!active || !me.user) {
          return;
        }

        if (me.user.onboardingComplete) {
          router.replace("/dashboard");
          return;
        }

        setProfileReady(true);
      } catch {
        // No session yet.
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    boot();
    return () => {
      active = false;
    };
  }, [router]);

  const currentQuestion = onboardingQuestions[step];

  const canMoveNext = useMemo(() => stepInput.trim().length > 2, [stepInput]);

  async function submitAuth(event: React.FormEvent) {
    event.preventDefault();
    setAuthError(null);

    try {
      if (mode === "register") {
        await apiFetch("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            displayName,
          }),
        });
      } else {
        await apiFetch("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
          }),
        });
      }

      setProfileReady(true);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed");
    }
  }

  function captureStep() {
    if (!currentQuestion) {
      return;
    }

    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: stepInput.trim() }));
    setStepInput("");
    setStep((current) => current + 1);
  }

  async function submitOnboarding() {
    const merged = {
      ...answers,
      [currentQuestion.id]: stepInput.trim(),
    };

    try {
      setOnboardingError(null);
      await apiFetch("/api/onboarding/complete", {
        method: "POST",
        body: JSON.stringify({
          academicBackground: merged.academicBackground,
          goalsSummary: merged.goalsSummary,
          interests: parseListInput(merged.interests ?? ""),
          habits: parseListInput(merged.habits ?? ""),
          challenges: parseListInput(merged.challenges ?? ""),
        }),
      });
      router.replace("/dashboard");
    } catch (error) {
      setOnboardingError(error instanceof Error ? error.message : "Onboarding failed");
    }
  }

  if (loading) {
    return <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-4">Loading...</main>;
  }

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-12 md:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(252,191,73,0.16),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(0,133,119,0.18),transparent_35%)]" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="grid gap-6 md:grid-cols-[1.05fr_1fr]"
      >
        <Card className="p-7 md:p-10">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.17em] text-[var(--brand)]">SkillVista Protocol</p>
          <h1 className="text-4xl font-extrabold tracking-tight text-[var(--text)]">SWOT Coach</h1>
          <p className="mt-4 max-w-lg text-base text-black/70">
            Your student growth OS: conversational onboarding, live SWOT intelligence, explainable updates, and weekly momentum coaching.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-black/75">
            <div>1. Conversational reflection instead of static forms</div>
            <div>2. Evidence-first SWOT with confidence and history</div>
            <div>3. Pattern-aware coach that avoids mood overreaction</div>
          </div>
        </Card>

        {!profileReady ? (
          <Card className="p-7 md:p-8">
            <div className="mb-5 flex gap-2 rounded-xl bg-black/5 p-1">
              <button className={`flex-1 rounded-lg py-2 text-sm ${mode === "register" ? "bg-white font-semibold" : "text-black/65"}`} onClick={() => setMode("register")}>Register</button>
              <button className={`flex-1 rounded-lg py-2 text-sm ${mode === "login" ? "bg-white font-semibold" : "text-black/65"}`} onClick={() => setMode("login")}>Login</button>
            </div>
            <form onSubmit={submitAuth} className="space-y-3">
              {mode === "register" ? <Input placeholder="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /> : null}
              <Input placeholder="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <Input placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              {authError ? <p className="text-sm text-red-600">{authError}</p> : null}
              <Button className="w-full" type="submit">{mode === "register" ? "Create Account" : "Continue"}</Button>
            </form>
          </Card>
        ) : (
          <Card className="p-7 md:p-8">
            <p className="mb-2 text-sm font-medium text-black/60">Conversational onboarding ({Math.min(step + 1, onboardingQuestions.length)}/{onboardingQuestions.length})</p>
            {currentQuestion ? (
              <>
                <p className="mb-3 text-lg font-semibold">Coach: {currentQuestion.prompt}</p>
                {currentQuestion.kind === "text" ? (
                  <Textarea
                    value={stepInput}
                    placeholder={currentQuestion.placeholder}
                    onChange={(event) => setStepInput(event.target.value)}
                  />
                ) : (
                  <Input
                    value={stepInput}
                    placeholder={currentQuestion.placeholder}
                    onChange={(event) => setStepInput(event.target.value)}
                  />
                )}
                {onboardingError ? <p className="mt-2 text-sm text-red-600">{onboardingError}</p> : null}
                <div className="mt-4 flex justify-end gap-2">
                  {step < onboardingQuestions.length - 1 ? (
                    <Button onClick={captureStep} disabled={!canMoveNext}>Next</Button>
                  ) : (
                    <Button onClick={submitOnboarding} disabled={!canMoveNext}>Complete Setup</Button>
                  )}
                </div>
              </>
            ) : null}
          </Card>
        )}
      </motion.div>
    </main>
  );
}
