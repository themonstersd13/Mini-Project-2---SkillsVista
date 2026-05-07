"use client";

import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type SessionTabProps = {
  sessions: Array<{
    id: string;
    startedAt: string;
    lastMessageAt: string;
    summary: string | null;
    messageCount: number;
  }>;
  currentSessionId: string;
  onSelectSession: (sessionId: string) => void;
};

export function SessionTabs({
  sessions,
  currentSessionId,
  onSelectSession,
}: SessionTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (sessions.length <= 1) {
    return null;
  }

  return (
    <div className="session-tabs">
      <p className="session-label">Past sessions</p>
      <div className="session-list">
        {sessions.map((session) => {
          const isCurrent = session.id === currentSessionId;
          const isExpanded = expandedId === session.id;

          return (
            <div key={session.id}>
              <button
                className={`session-tab ${isCurrent ? "session-tab--current" : ""}`}
                onClick={() => {
                  if (isCurrent) return;
                  setExpandedId(isExpanded ? null : session.id);
                  onSelectSession(session.id);
                }}
                disabled={isCurrent}
              >
                <span className="session-date">
                  {formatDistanceToNow(new Date(session.startedAt), {
                    addSuffix: true,
                  })}
                </span>
                <span className="session-count">
                  {session.messageCount} msgs
                </span>
                {isCurrent && (
                  <span className="session-badge">current</span>
                )}
              </button>
              <AnimatePresence>
                {isExpanded && session.summary && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="session-summary"
                  >
                    <p>{session.summary}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      <style jsx>{`
        .session-tabs {
          margin-bottom: 12px;
        }
        .session-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(255, 255, 255, 0.4);
          margin-bottom: 6px;
          font-weight: 600;
        }
        .session-list {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .session-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 6px 10px;
          border: none;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          font-size: 12px;
          text-align: left;
          transition: background 0.2s;
        }
        .session-tab:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
        }
        .session-tab--current {
          background: rgba(110, 231, 183, 0.1);
          color: #6ee7b7;
          cursor: default;
        }
        .session-date {
          flex: 1;
        }
        .session-count {
          opacity: 0.5;
          font-size: 11px;
        }
        .session-badge {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(110, 231, 183, 0.2);
          color: #6ee7b7;
          font-weight: 700;
        }
        .session-summary {
          padding: 6px 10px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
