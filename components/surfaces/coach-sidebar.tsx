"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Goal = {
  id: string;
  title: string;
  status: string;
  progress?: number;
  completion?: number;
  completedTasks?: number;
  totalTasks?: number;
};

type SwotChange = {
  title: string;
  status: string;
  reason: string;
};

type FollowUp = {
  id: string;
  question: string;
  status: string;
};

type CoachSidebarProps = {
  goals: Goal[];
  streak: { current: number; longest: number } | null;
  recentSwotChanges: SwotChange[];
  followUps: FollowUp[];
  onAddGoal: (title: string) => void;
};

export function CoachSidebar({
  goals,
  streak,
  recentSwotChanges,
  followUps,
  onAddGoal,
}: CoachSidebarProps) {
  const [goalDraft, setGoalDraft] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const activeGoals = goals.filter((g) => g.status === "ACTIVE");

  return (
    <motion.aside
      className="coach-sidebar"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Streak Counter */}
      {streak && streak.current > 0 && (
        <div className="sidebar-section streak-section">
          <div className="streak-counter">
            <motion.span
              className="streak-flame"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              🔥
            </motion.span>
            <span className="streak-number">{streak.current}</span>
            <span className="streak-label">day streak</span>
          </div>
          {streak.current >= streak.longest && streak.current > 1 && (
            <span className="streak-best">🏆 Personal best!</span>
          )}
        </div>
      )}

      {/* Active Goals */}
      <div className="sidebar-section">
        <h3 className="section-title">
          <span>🎯</span> Goals
          <button
            className="collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? "▸" : "▾"}
          </button>
        </h3>
        {!collapsed && (
          <>
            {activeGoals.length === 0 && (
              <p className="empty-text">No active goals yet.</p>
            )}
            {activeGoals.map((goal) => {
              const progress = goal.completion ?? goal.progress ?? 0;
              return (
                <div key={goal.id} className="goal-item">
                  <span className="goal-title">{goal.title}</span>
                  <div className="progress-bar-wrap">
                    <motion.div
                      className="progress-bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  <span className="progress-text">
                    {(progress * 100).toFixed(0)}%
                    {goal.totalTasks
                      ? ` · ${goal.completedTasks}/${goal.totalTasks} tasks`
                      : ""}
                  </span>
                </div>
              );
            })}
            <form
              className="add-goal-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (goalDraft.trim()) {
                  onAddGoal(goalDraft.trim());
                  setGoalDraft("");
                }
              }}
            >
              <Input
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                placeholder="Add a goal..."
                className="sidebar-input"
              />
              <Button type="submit" className="sidebar-btn">
                +
              </Button>
            </form>
          </>
        )}
      </div>

      {/* Recent SWOT Changes */}
      {recentSwotChanges.length > 0 && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <span>📊</span> Recent SWOT Changes
          </h3>
          {recentSwotChanges.slice(0, 3).map((change, i) => (
            <div key={i} className="swot-change">
              <span className={`change-status change-status--${change.status.toLowerCase()}`}>
                {change.status}
              </span>
              <span className="change-title">{change.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Pending Follow-ups */}
      {followUps.length > 0 && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <span>💬</span> Follow-ups
          </h3>
          {followUps.slice(0, 3).map((fu) => (
            <div key={fu.id} className="followup-item">
              <span className="followup-question">{fu.question}</span>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .coach-sidebar {
          display: flex;
          flex-direction: column;
          gap: 2px;
          height: fit-content;
        }
        .sidebar-section {
          padding: 16px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(16px);
          margin-bottom: 8px;
        }
        .streak-section {
          text-align: center;
          background: linear-gradient(
            135deg,
            rgba(251, 146, 60, 0.1),
            rgba(239, 68, 68, 0.08)
          );
          border-color: rgba(251, 146, 60, 0.2);
        }
        .streak-counter {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .streak-flame {
          font-size: 24px;
        }
        .streak-number {
          font-size: 28px;
          font-weight: 800;
          background: linear-gradient(135deg, #fb923c, #ef4444);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .streak-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          font-weight: 500;
        }
        .streak-best {
          display: block;
          font-size: 11px;
          color: #fbbf24;
          margin-top: 4px;
          font-weight: 600;
        }
        .section-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .collapse-btn {
          margin-left: auto;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.3);
          cursor: pointer;
          font-size: 12px;
        }
        .empty-text {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.35);
        }
        .goal-item {
          margin-bottom: 10px;
        }
        .goal-title {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
          display: block;
          margin-bottom: 4px;
        }
        .progress-bar-wrap {
          height: 4px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          border-radius: 2px;
          background: linear-gradient(90deg, #6ee7b7, #3b82f6);
        }
        .progress-text {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          margin-top: 2px;
          display: block;
        }
        .add-goal-form {
          display: flex;
          gap: 6px;
          margin-top: 8px;
        }
        .sidebar-input {
          flex: 1;
          font-size: 12px;
          background: rgba(255, 255, 255, 0.06) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
          color: white !important;
        }
        .sidebar-btn {
          padding: 4px 12px;
          font-size: 16px;
          min-width: unset;
        }
        .swot-change {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
          font-size: 12px;
        }
        .change-status {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .change-status--created {
          background: rgba(110, 231, 183, 0.15);
          color: #6ee7b7;
        }
        .change-status--updated {
          background: rgba(96, 165, 250, 0.15);
          color: #60a5fa;
        }
        .change-status--stale {
          background: rgba(251, 191, 36, 0.15);
          color: #fbbf24;
        }
        .change-status--unchanged {
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.4);
        }
        .change-title {
          color: rgba(255, 255, 255, 0.7);
        }
        .followup-item {
          margin-bottom: 6px;
        }
        .followup-question {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.55);
          font-style: italic;
          display: block;
          padding-left: 8px;
          border-left: 2px solid rgba(96, 165, 250, 0.3);
        }
      `}</style>
    </motion.aside>
  );
}
