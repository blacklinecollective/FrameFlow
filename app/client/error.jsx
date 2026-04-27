"use client";
import { useEffect } from "react";

export default function ClientPortalError({ error, reset }) {
  useEffect(() => {
    console.error("[portal] Error boundary caught:", error);
  }, [error]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#faf9f7",
      padding: 24,
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <p style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>
          Something went wrong
        </p>
        <p style={{ fontSize: 13, color: "#888", marginBottom: 24, lineHeight: 1.6 }}>
          We had trouble loading this gallery. Please try refreshing the page.
        </p>
        <button
          onClick={reset}
          style={{
            padding: "11px 24px",
            background: "#1a1a1a",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
