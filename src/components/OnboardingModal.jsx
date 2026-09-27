import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { theme as t } from "../theme";
import { getModules } from "../utils/businessModules";
import { useIsMobile } from "../hooks/useMediaQuery";

// Each step is ticked only by real data in the active business — never by
// hand — so the checklist can't drift from what's actually been done.
const ALL_STEPS = [
  { id: "logo", label: "Add your logo", page: "settings" },
  { id: "client", label: "Add your first client", table: "clients", page: "allclients", module: "clientManagement" },
  { id: "project", label: "Create a project", table: "projects", page: "projects", module: "clientManagement" },
  { id: "expense", label: "Log an expense", table: "expenses", page: "expenses", module: "money" },
  { id: "invoice", label: "Create an invoice", table: "invoices", page: "income", module: "money" },
];

async function isStepDone(step, businessSpaceId) {
  if (step.id === "logo") {
    const { data } = await supabase
      .from("business_spaces")
      .select("logo_url")
      .eq("id", businessSpaceId)
      .maybeSingle();
    return !!data?.logo_url;
  }
  const { count } = await supabase
    .from(step.table)
    .select("id", { count: "exact", head: true })
    .eq("business_space_id", businessSpaceId);
  return count > 0;
}

export default function OnboardingModal({ userId, businessSpaceId, startMinimized, refreshKey, onComplete, onSkip, onNavigate }) {
  const [completed, setCompleted] = useState([]);
  const [checking, setChecking] = useState(true);
  const [minimized, setMinimized] = useState(startMinimized);
  const isMobile = useIsMobile();

  const modules = getModules(businessSpaceId);
  const steps = ALL_STEPS.filter((s) => !s.module || modules[s.module]);

  // The full checklist is shown once; from then on it opens as the pill.
  useEffect(() => {
    if (startMinimized) return;
    supabase.from("user_settings").update({ onboarding_intro_seen: true }).eq("user_id", userId);
  }, [userId, startMinimized]);

  // Re-checked on navigation and business-identity changes (e.g. a logo
  // upload in Settings), so returning from a step shows it ticked.
  useEffect(() => {
    let cancelled = false;
    Promise.all(ALL_STEPS.map(async (step) => ((await isStepDone(step, businessSpaceId)) ? step.id : null)))
      .then((results) => {
        if (cancelled) return;
        setCompleted(results.filter(Boolean));
        setChecking(false);
      });
    return () => { cancelled = true; };
  }, [businessSpaceId, refreshKey]);

  const allDone = !checking && steps.every((s) => completed.includes(s.id));

  const handleStepClick = (step) => {
    if (completed.includes(step.id)) return;
    setMinimized(true);
    onNavigate(step.page);
  };

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

  // Minimized pill — finishing the last step opens the "you're set" view on its own.
  if (minimized && !allDone) {
    return (
      <div
        onClick={() => setMinimized(false)}
        style={{
          position: "fixed", right: isMobile ? "16px" : "24px",
          // Clear the mobile tab bar (60px + safe area).
          bottom: isMobile ? "calc(76px + env(safe-area-inset-bottom))" : "24px",
          background: t.colors.primary, color: "#fff",
          borderRadius: t.radius.full, padding: "12px 20px",
          display: "flex", alignItems: "center", gap: "10px",
          cursor: "pointer", zIndex: 1000,
          boxShadow: t.shadows.md,
          fontSize: t.fontSizes.md, fontWeight: "500",
          fontFamily: t.fonts.sans,
        }}
      >
        <div style={{
          width: "28px", height: "28px", borderRadius: "50%",
          background: "rgba(255,255,255,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: t.fontSizes.sm, fontWeight: "600",
          fontFamily: t.fonts.heading,
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
      zIndex: 1000,
      fontFamily: t.fonts.sans,
    }}>
      <div style={{
        background: t.colors.bgCard,
        borderRadius: t.radius.card,
        padding: "32px", width: "420px", maxWidth: "90vw",
        boxShadow: t.shadows.lg,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{
              marginTop: 0, marginBottom: "6px",
              fontSize: "22px", fontWeight: "800",
              color: t.colors.textPrimary,
              fontFamily: t.fonts.heading,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}>
              {allDone ? "You're all set" : "Welcome to gabspace"}
            </h2>
            <p style={{
              color: t.colors.textSecondary, margin: 0,
              fontSize: t.fontSizes.md,
              lineHeight: 1.5,
            }}>
              {allDone
                ? "Your space is set up. Time to get to work."
                : "Complete these steps to get your workspace set up."}
            </p>
          </div>
          <button
            onClick={() => setMinimized(true)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: t.colors.textTertiary, fontSize: "20px", lineHeight: 1,
              padding: "0 0 0 12px", marginTop: "-2px",
              fontFamily: t.fonts.sans,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ margin: "24px 0" }}>
          {checking ? (
            <p style={{
              color: t.colors.textTertiary, textAlign: "center",
              fontSize: t.fontSizes.base,
            }}>
              Checking your progress...
            </p>
          ) : (
            steps.map((step) => {
              const done = completed.includes(step.id);
              return (
                <div
                  key={step.id}
                  onClick={() => handleStepClick(step)}
                  style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "12px",
                    borderRadius: t.radius.full,
                    marginBottom: "8px",
                    cursor: done ? "default" : "pointer",
                    background: done ? t.colors.successLight : t.colors.bg,
                    border: `1px solid ${done ? t.colors.success : t.colors.border}`,
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{
                    width: "20px", height: "20px", borderRadius: "50%",
                    border: `2px solid ${done ? t.colors.success : t.colors.border}`,
                    background: done ? t.colors.success : "transparent",
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
                    fontSize: t.fontSizes.md, flex: 1,
                    textDecoration: done ? "line-through" : "none",
                    color: done ? t.colors.textTertiary : t.colors.textPrimary,
                    fontFamily: t.fonts.sans,
                  }}>
                    {step.label}
                  </span>
                  {!done && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M5 3l4 4-4 4" stroke={t.colors.textTertiary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
            background: allDone ? t.colors.primary : t.colors.border,
            color: "#fff", border: "none",
            borderRadius: t.radius.full,
            fontSize: t.fontSizes.md,
            fontWeight: "600",
            cursor: allDone ? "pointer" : "not-allowed",
            fontFamily: t.fonts.sans,
            transition: "background 0.2s",
          }}
        >
          Get started
        </button>

        {!allDone && <p
          onClick={handleSkip}
          style={{
            textAlign: "center", marginTop: "16px", marginBottom: 0,
            fontSize: t.fontSizes.base, color: t.colors.textTertiary,
            cursor: "pointer", textDecoration: "underline",
            fontFamily: t.fonts.sans,
          }}
        >
          Hide checklist
        </p>}
      </div>
    </div>
  );
}