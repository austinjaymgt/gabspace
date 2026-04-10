import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const steps = [
  { id: "client", label: "Add your first client", table: "clients", page: "clients" },
  { id: "project", label: "Create a project", table: "projects", page: "projects" },
  { id: "expense", label: "Log an expense", table: "expenses", page: "expenses" },
  { id: "invoice", label: "Create an invoice", table: "invoices", page: "invoices" },
  { id: "user_settings", label: "Update Business Information", table: "user_settings", page: "settings" },
];

export default function OnboardingModal({ userId, onComplete, onSkip, onNavigate }) {
  const [completed, setCompleted] = useState([]);
  const [checking, setChecking] = useState(true);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    async function checkExisting() {
      // Check if user already completed or skipped onboarding
      const { data: settings } = await supabase
        .from("user_settings")
        .select("onboarding_completed")
        .eq("user_id", userId)
        .maybeSingle();

      if (settings?.onboarding_completed) {
        onComplete();
        return;
      }

      const results = await Promise.all(
        steps.map(async (step) => {
          const { count } = await supabase
            .from(step.table)
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);
          return count > 0 ? step.id : null;
        })
      );
      setCompleted(results.filter(Boolean));
      setChecking(false);
    }
    checkExisting();
  }, [userId]);

  const toggleStep = (id) => {
    setCompleted((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleStepClick = (step) => {
    const done = completed.includes(step.id);
    if (done) {
      toggleStep(step.id);
    } else {
      onNavigate(step.page);
      setMinimized(true);
    }
  };

  const allDone = steps.every((s) => completed.includes(s.id));

  const markCompleted = async () => {
    await supabase
      .from("user_settings")
      .update({ onboarding_completed: true })
      .eq("user_id", userId);
  };

  const handleFinish = async () => {
    await markCompleted();
    onComplete();
  };

  const handleSkip = async () => {
    await markCompleted();
    onSkip();
  };

  const completedCount = steps.filter((s) => completed.includes(s.id)).length;

  // Minimized pill
  if (minimized) {
    return (
      <div
        onClick={() => setMinimized(false)}
        style={{
          position: "fixed", bottom: "24px", right: "24px",
          background: "#1D9E75", color: "white",
          borderRadius: "999px", padding: "12px 20px",
          display: "flex", alignItems: "center", gap: "10px",
          cursor: "pointer", zIndex: 1000,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          fontSize: "14px", fontWeight: "500",
        }}
      >
        <div style={{
          width: "28px", height: "28px", borderRadius: "50%",
          background: "rgba(255,255,255,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "12px", fontWeight: "600",
        }}>
          {completedCount}/{steps.length}
        </div>
        Getting started
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 9l4-4 4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    );
  }

  // Full modal
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000
    }}>
      <div style={{
        background: "white", borderRadius: "12px",
        padding: "32px", width: "420px", maxWidth: "90vw"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: "4px" }}>Welcome to Gabspace</h2>
            <p style={{ color: "#666", margin: 0 }}>
              Complete these steps to get your workspace set up.
            </p>
          </div>
          <button
            onClick={() => setMinimized(true)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#999", fontSize: "20px", lineHeight: 1,
              padding: "0 0 0 12px", marginTop: "-2px"
            }}
          >
            ×
          </button>
        </div>

        <div style={{ margin: "24px 0" }}>
          {checking ? (
            <p style={{ color: "#999", textAlign: "center" }}>Checking your progress...</p>
          ) : (
            steps.map((step) => {
              const done = completed.includes(step.id);
              return (
                <div
                  key={step.id}
                  onClick={() => handleStepClick(step)}
                  style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "12px", borderRadius: "8px", marginBottom: "8px",
                    cursor: "pointer", background: done ? "#f0faf5" : "#f9f9f9",
                    border: `1px solid ${done ? "#a3d9b8" : "#e5e5e5"}`
                  }}
                >
                  <div style={{
                    width: "20px", height: "20px", borderRadius: "50%",
                    border: `2px solid ${done ? "#1D9E75" : "#ccc"}`,
                    background: done ? "#1D9E75" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0
                  }}>
                    {done && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span style={{
                    fontSize: "15px", flex: 1,
                    textDecoration: done ? "line-through" : "none",
                    color: done ? "#888" : "#222"
                  }}>
                    {step.label}
                  </span>
                  {!done && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M5 3l4 4-4 4" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              );
            })
          )}
        </div>

        <button
          onClick={handleFinish}
          disabled={!allDone}
          style={{
            width: "100%", padding: "12px",
            background: allDone ? "#1D9E75" : "#ccc",
            color: "white", border: "none",
            borderRadius: "8px", fontSize: "15px",
            cursor: allDone ? "pointer" : "not-allowed"
          }}
        >
          Get started
        </button>

        <p
          onClick={handleSkip}
          style={{
            textAlign: "center", marginTop: "16px", marginBottom: 0,
            fontSize: "13px", color: "#999",
            cursor: "pointer", textDecoration: "underline"
          }}
        >
          Skip for now
        </p>
      </div>
    </div>
  );
}