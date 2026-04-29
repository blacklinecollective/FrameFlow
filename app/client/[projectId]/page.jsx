"use client";
import { useState, useEffect, useRef, useCallback } from "react";

const SUPABASE_URL  = "https://czmzxwtnzyguhbmivizq.supabase.co";
const SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bXp4d3RuenlndWhibWl2aXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODMwNTksImV4cCI6MjA5MjQ1OTA1OX0.8BFEhkHdCx0PgZ8SuySMlWk68AtMtcvT3sSsxj88wJo";

const C = {
  ink: "#1a1a1a", muted: "#888", border: "#e8e4df",
  warm: "#f5f2ee", cream: "#faf9f7", green: "#4a7a57", accent: "#c4974a",
};

const fmt = s => `${Math.floor((s||0)/60)}:${String(Math.floor((s||0)%60)).padStart(2,"0")}`;

// ── Identity helpers (shared portal chat) ────────────────────────────────────
const slugify = (s) => (s || "").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const initials = (s) => (s || "").split(/\s+/).filter(Boolean).map(w => w[0]).slice(0,2).join("").toUpperCase() || "?";
const _hash = (s) => { let h = 0; for (let i = 0; i < (s||"").length; i++) h = ((h*31) + s.charCodeAt(i)) | 0; return Math.abs(h); };
const SENDER_PALETTE = ["#007AFF","#34C759","#AF52DE","#FF9500","#FF2D55","#5AC8FA","#FF3B30","#5856D6","#30D158"];
const colorForName = (s) => SENDER_PALETTE[_hash(s||"") % SENDER_PALETTE.length];

// ── Demo-mode payment helpers ────────────────────────────────────────────────
// We never persist or transmit a full card number — the form takes the digits
// only to compute `brand` + `last4` for display. Real payment processing
// belongs in Stripe/etc., not in app_state.
const cardBrand = (num) => {
  const n = (num || "").toString().replace(/\D/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^(5[1-5]|2(?:22[1-9]|2[3-9]\d|[3-6]\d{2}|7[01]\d|720))/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^(6011|65|64[4-9])/.test(n)) return "Discover";
  return "Card";
};
const last4 = (s) => (s || "").toString().replace(/\D/g, "").slice(-4);
const formatCardNumber = (s) => (s || "").toString().replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();

// ── Video download — direct navigation to Supabase ?download= URL ────────────
// When the server returns Content-Disposition: attachment the browser saves the
// file and does NOT navigate away from the current page. No popup needed.
function downloadVideo(url, filename) {
  if (!url) return;
  const name = filename || url.split("/").pop().split("?")[0] || "video.mp4";
  const base = url.split("?")[0];
  // Navigate to the attachment URL — Content-Disposition: attachment keeps the
  // current page intact and triggers a file save in all major browsers.
  window.location.href = `${base}?download=${encodeURIComponent(name)}`;
}

// ── Photo download — blob-fetch for cross-origin Supabase Storage URLs ────────
async function downloadBlob(url, filename) {
  const name = filename || url.split("/").pop().split("?")[0] || "download";
  try {
    // Fetch as blob so the anchor download attribute is honoured (same-origin blob:// URL)
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(blobUrl); }, 2000);
  } catch {
    // Fallback: navigate to Supabase ?download= URL (Content-Disposition: attachment
    // tells the browser to save without navigating away — no popup needed)
    const base = url.split("?")[0];
    window.location.href = `${base}?download=${encodeURIComponent(name)}`;
  }
}

// ── PIN Gate ─────────────────────────────────────────────────────────────────
function PinGate({ pin, onUnlock }) {
  const [input, setInput] = useState("");
  const [shake, setShake] = useState(false);
  const attempt = () => {
    if (input === String(pin)) { onUnlock(); return; }
    setShake(true); setInput("");
    setTimeout(() => setShake(false), 600);
  };
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.cream, padding:24 }}>
      <div style={{ background:"#fff", borderRadius:20, padding:"40px 36px", maxWidth:360, width:"100%", boxShadow:"0 8px 40px rgba(0,0,0,.08)", textAlign:"center" }}>
        <div style={{ width:56, height:56, borderRadius:16, background:C.warm, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.ink, margin:"0 0 8px" }}>Private Gallery</h2>
        <p style={{ fontSize:13, color:C.muted, margin:"0 0 28px", lineHeight:1.5 }}>Enter your PIN to access this gallery.</p>
        <input type="password" inputMode="numeric" maxLength={6} value={input}
          onChange={e => setInput(e.target.value.replace(/\D/g,""))}
          onKeyDown={e => e.key==="Enter" && attempt()}
          placeholder="Enter PIN"
          style={{ width:"100%", padding:"14px 16px", border:`2px solid ${shake?"#e05a5a":C.border}`, borderRadius:12, fontSize:22, letterSpacing:8, fontWeight:700, textAlign:"center", color:C.ink, background:C.cream, outline:"none", boxSizing:"border-box", animation:shake?"shake .4s ease":"none" }}/>
        {shake && <p style={{ fontSize:12, color:"#e05a5a", margin:"8px 0 0" }}>Incorrect PIN — try again</p>}
        <button onClick={attempt} style={{ marginTop:16, width:"100%", padding:"13px 0", background:C.ink, color:"#fff", border:"none", borderRadius:12, fontSize:14, fontWeight:700, cursor:"pointer" }}>
          Unlock Gallery
        </button>
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}`}</style>
      </div>
    </div>
  );
}

// ── Photo tile ────────────────────────────────────────────────────────────────
function PhotoTile({ photo, onClick, isFav, onFav, onDownload }) {
  const src = typeof photo === "string" ? photo : photo?.url;
  const isVid = photo?.type === "video" || /\.(mp4|mov|webm)(\?|$)/i.test(src||"");
  return (
    <div style={{ breakInside:"avoid", marginBottom:6, position:"relative", cursor:"pointer", borderRadius:8, overflow:"hidden" }} onClick={onClick}>
      {isVid
        ? <video src={src} muted playsInline preload="metadata" style={{ width:"100%", height:"auto", display:"block" }}/>
        : <img src={src} alt="" style={{ width:"100%", height:"auto", display:"block" }} loading="lazy"/>}
      {/* Action buttons */}
      <div style={{ position:"absolute", top:7, right:7, display:"flex", flexDirection:"column", gap:5 }}>
        <button onClick={e => { e.stopPropagation(); onFav(); }}
          style={{ width:28, height:28, borderRadius:"50%", background:isFav?"#e87d7d":"rgba(255,255,255,.85)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill={isFav?"#fff":"none"} stroke={isFav?"#fff":"#888"} strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
        <button onClick={e => { e.stopPropagation(); onDownload && onDownload(); }}
          style={{ width:28, height:28, borderRadius:"50%", background:"rgba(255,255,255,.85)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}
          title="Download">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Video Review Tab ──────────────────────────────────────────────────────────
function VideoReviewTab({ projectId, ownerUserId, project, videoDeliverables, videoComments: initComments, brandColor, dark, fg, sub, brd, bg, studioName }) {
  const [supabase,    setSupabase]    = useState(null);
  const [comments,    setComments]    = useState(initComments || {});
  const [selDelId,    setSelDelId]    = useState(null);
  const [selVerId,    setSelVerId]    = useState(null);
  const [playhead,    setPlayhead]    = useState(0);
  const [playing,     setPlaying]     = useState(false);
  const [noteText,    setNoteText]    = useState("");
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [clientName,  setClientName]  = useState(project?.client || "Client");
  const videoRef = useRef(null);

  // Init Supabase once
  useEffect(() => {
    import("@supabase/supabase-js").then(({ createClient }) => {
      setSupabase(createClient(SUPABASE_URL, SUPABASE_KEY));
    });
  }, []);

  const deliverables = Array.isArray(videoDeliverables) ? videoDeliverables : [];
  const selDel  = deliverables.find(d => d.id === selDelId);
  const selVer  = selDel?.versions?.find(v => v.id === selVerId);
  const verCmts = selVerId ? (comments[selVerId] || []) : [];
  const dur     = selVer?.duration || 1;

  const openDel = (del) => {
    const latest = del.versions[del.versions.length - 1];
    setSelDelId(del.id);
    setSelVerId(latest.id);
    setPlayhead(0);
    setPlaying(false);
  };

  const addNote = async () => {
    if (!noteText.trim() || !selVerId || !supabase) return;
    const ts = videoRef.current ? Math.floor(videoRef.current.currentTime) : playhead;
    const comment = {
      id: Date.now(),
      ts,
      author: clientName,
      avatar: (clientName[0] || "C").toUpperCase(),
      role: "client",
      text: noteText.trim(),
      resolved: false,
      replies: [],
      time: new Date().toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" }),
    };
    // Optimistic update
    setComments(prev => ({ ...prev, [selVerId]: [...(prev[selVerId]||[]), comment] }));
    setNoteText("");
    setSaving(true);
    try {
      await supabase.rpc("add_client_video_comment", {
        p_project_id:    Number(projectId),
        p_version_id:    selVerId,
        p_comment:       comment,
        p_owner_user_id: ownerUserId || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch(e) {
      console.error("Failed to save comment", e);
    }
    setSaving(false);
  };

  const jumpTo = (ts) => {
    setPlayhead(ts);
    if (videoRef.current) videoRef.current.currentTime = ts;
  };

  // ── List view ──────────────────────────────────────────────────────────────
  if (!selDelId || !selDel) {
    return (
      <div style={{ maxWidth:800, margin:"0 auto", padding:"32px 24px" }}>
        <div style={{ marginBottom:28 }}>
          <h2 style={{ fontSize:24, fontWeight:700, color:fg, margin:"0 0 6px" }}>Video Review</h2>
          <p style={{ fontSize:13, color:sub, margin:0 }}>Watch your videos and leave timestamped notes for {studioName}</p>
        </div>
        {deliverables.length === 0 ? (
          <div style={{ textAlign:"center", padding:"56px 0", background:dark?"rgba(255,255,255,.04)":"#fff", borderRadius:16, border:`1px solid ${brd}` }}>
            <div style={{ fontSize:40, marginBottom:14 }}>🎬</div>
            <p style={{ fontSize:15, fontWeight:600, color:fg, marginBottom:6 }}>No videos yet</p>
            <p style={{ fontSize:13, color:sub }}>Your studio will upload your video here once it's ready for review.</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {deliverables.map(del => {
              const latest = del.versions[del.versions.length - 1];
              const allCmts = del.versions.flatMap(v => comments[v.id] || []);
              const openCmts = allCmts.filter(c => !c.resolved).length;
              return (
                <div key={del.id} onClick={() => openDel(del)}
                  style={{ background:dark?"rgba(255,255,255,.06)":"#fff", border:`1px solid ${brd}`, borderRadius:16, overflow:"hidden", cursor:"pointer", display:"flex", transition:"box-shadow .15s" }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,.08)"}
                  onMouseLeave={e => e.currentTarget.style.boxShadow="none"}>
                  {/* Thumbnail */}
                  <div style={{ width:160, flexShrink:0, position:"relative", background:"#0a0a0a", minHeight:110, overflow:"hidden" }}>
                    {latest.url && (
                      <video src={latest.url} preload="metadata" muted playsInline
                        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }}/>
                    )}
                    <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,.35)" }}>
                      <div style={{ width:44, height:44, borderRadius:"50%", background:"rgba(0,0,0,.55)", border:"2px solid rgba(255,255,255,.5)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      </div>
                    </div>
                    {latest.duration && (
                      <div style={{ position:"absolute", bottom:6, right:8, background:"rgba(0,0,0,.7)", color:"#fff", fontSize:10, fontFamily:"monospace", padding:"2px 6px", borderRadius:4 }}>
                        {fmt(latest.duration)}
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div style={{ padding:18, flex:1 }}>
                    <p style={{ fontSize:15, fontWeight:700, color:fg, margin:"0 0 4px" }}>{del.title}</p>
                    <p style={{ fontSize:12, color:sub, margin:"0 0 10px" }}>
                      {del.versions.length} version{del.versions.length!==1?"s":""} · Latest: {latest.label} · {latest.uploadedAt}
                    </p>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      {openCmts > 0
                        ? <span style={{ fontSize:11, background:"#fff8ec", color:"#9e7850", border:"1px solid #f4d98a", borderRadius:99, padding:"3px 10px" }}>💬 {openCmts} open note{openCmts!==1?"s":""}</span>
                        : <span style={{ fontSize:11, background:"#edf5ef", color:"#2a5a3a", border:"1px solid #b6e3cc", borderRadius:99, padding:"3px 10px" }}>✓ All notes resolved</span>
                      }
                      {del.versions.length > 1 && (
                        <span style={{ fontSize:11, background:dark?"rgba(255,255,255,.08)":C.warm, color:sub, border:`1px solid ${brd}`, borderRadius:99, padding:"3px 10px" }}>
                          {del.versions.length} revisions
                        </span>
                      )}
                    </div>
                    {latest.notes && (
                      <p style={{ fontSize:12, color:sub, margin:"10px 0 0", lineHeight:1.5 }}>📝 {latest.notes}</p>
                    )}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, paddingRight:12 }}>
                    <button
                      onClick={e => { e.stopPropagation(); if (latest.url) downloadVideo(latest.url, `${del.title || "video"}.mp4`); }}
                      title={latest.url ? "Download video" : "Video not yet available for download"}
                      disabled={!latest.url}
                      style={{ width:34, height:34, borderRadius:8, background:dark?"rgba(255,255,255,.1)":C.warm, border:`1px solid ${brd}`, cursor:latest.url?"pointer":"not-allowed", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, opacity:latest.url?1:0.35 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </button>
                    <span style={{ color:sub, fontSize:18 }}>›</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Player view ────────────────────────────────────────────────────────────
  const sorted = [...verCmts].sort((a, b) => a.ts - b.ts);

  return (
    <div style={{ maxWidth:1100, margin:"0 auto", padding:"24px 24px" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        <button onClick={() => setSelDelId(null)}
          style={{ background:"none", border:`1px solid ${brd}`, borderRadius:8, padding:"6px 12px", fontSize:12, color:sub, cursor:"pointer" }}>
          ← All Videos
        </button>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:15, fontWeight:700, color:fg, margin:0 }}>{selDel.title}</p>
          <p style={{ fontSize:11, color:sub, margin:0 }}>{selVer?.label} · {selVer?.uploadedAt}</p>
        </div>
        {/* Version switcher */}
        <div style={{ display:"flex", gap:5 }}>
          {selDel.versions.map((v, vi) => (
            <button key={v.id} onClick={() => { setSelVerId(v.id); setPlayhead(0); setPlaying(false); }}
              style={{ padding:"5px 12px", borderRadius:8, border:`1px solid ${selVerId===v.id?fg:brd}`, background:selVerId===v.id?fg:dark?"rgba(255,255,255,.06)":"#fff", color:selVerId===v.id?"#fff":sub, fontSize:11, fontWeight:600, cursor:"pointer" }}>
              {v.label}{vi===selDel.versions.length-1?" ✦":""}
            </button>
          ))}
        </div>
        {/* Download current version */}
        <button
          onClick={() => { if (selVer?.url) downloadVideo(selVer.url, `${selDel.title || "video"} - ${selVer.label || "video"}.mp4`); }}
          title={selVer?.url ? "Download this version" : "Video not yet available for download"}
          disabled={!selVer?.url}
          style={{ padding:"5px 12px", borderRadius:8, border:`1px solid ${brd}`, background:dark?"rgba(255,255,255,.06)":"#fff", color:sub, fontSize:11, fontWeight:600, cursor:selVer?.url?"pointer":"not-allowed", display:"flex", alignItems:"center", gap:5, opacity:selVer?.url?1:0.4 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download
        </button>
      </div>

      {/* Version notes banner */}
      {selVer?.notes && (
        <div style={{ background:dark?"rgba(60,80,180,.2)":"#f0f4ff", border:"1px solid #c7d7f0", borderRadius:10, padding:"10px 16px", marginBottom:14, display:"flex", gap:8 }}>
          <span style={{ fontSize:11, fontWeight:700, color:"#3b5bdb", flexShrink:0 }}>{selVer.label}</span>
          <p style={{ fontSize:12, color:"#3b5bdb", margin:0, lineHeight:1.5 }}>{selVer.notes}</p>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:16, alignItems:"start" }}>

        {/* ── Video player ── */}
        <div style={{ background:"#0a0a0a", borderRadius:14, overflow:"hidden" }}>
          <div style={{ position:"relative", minHeight:300, display:"flex", alignItems:"center", justifyContent:"center", background:"#000" }}>
            {selVer?.url ? (
              <video key={selVer.url} ref={videoRef} src={selVer.url} preload="auto" playsInline
                style={{ width:"100%", maxHeight:420, objectFit:"contain", display:"block", cursor:"pointer" }}
                onTimeUpdate={e => setPlayhead(Math.floor(e.target.currentTime))}
                onEnded={() => setPlaying(false)}
                onClick={() => {
                  if (playing) { videoRef.current?.pause(); } else { videoRef.current?.play().catch(()=>{}); }
                  setPlaying(p => !p);
                }}
              />
            ) : (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:60 }}>
                <div style={{ fontSize:36, marginBottom:12 }}>🎬</div>
                <p style={{ color:"rgba(255,255,255,.4)", fontSize:13 }}>Video not yet available</p>
              </div>
            )}
            {/* Play overlay */}
            {selVer?.url && !playing && (
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
                <div style={{ width:60, height:60, borderRadius:"50%", background:"rgba(0,0,0,.5)", border:"2px solid rgba(255,255,255,.45)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </div>
              </div>
            )}
            {/* Comment dots on video */}
            {selVer?.url && sorted.map(c => (
              <div key={c.id} onClick={e => { e.stopPropagation(); jumpTo(c.ts); }}
                title={`${fmt(c.ts)} — ${c.author}: ${c.text}`}
                style={{ position:"absolute", bottom:14, left:`${Math.min(95,(c.ts/dur)*100)}%`, width:10, height:10, borderRadius:"50%", background:c.role==="client"?C.accent:"#8fa3b5", border:"2px solid rgba(255,255,255,.7)", transform:"translateX(-50%)", cursor:"pointer", zIndex:5 }}/>
            ))}
            {/* Timecode */}
            <div style={{ position:"absolute", top:10, left:12, background:"rgba(0,0,0,.65)", color:"#fff", fontSize:10, fontFamily:"monospace", padding:"2px 8px", borderRadius:5 }}>
              {fmt(playhead)} / {fmt(dur)}
            </div>
          </div>

          {/* Controls */}
          {selVer?.url && (
            <div style={{ background:"#111", padding:"10px 14px" }}>
              {/* Scrub bar */}
              <div style={{ position:"relative", height:28, display:"flex", alignItems:"center", cursor:"pointer", marginBottom:4 }}
                onClick={e => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const t = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left)/r.width)) * dur);
                  setPlayhead(t);
                  if (videoRef.current) videoRef.current.currentTime = t;
                }}>
                <div style={{ position:"absolute", left:0, right:0, height:3, background:"rgba(255,255,255,.15)", borderRadius:99 }}>
                  <div style={{ height:"100%", width:`${(playhead/dur)*100}%`, background:brandColor, borderRadius:99 }}/>
                </div>
                {/* Comment markers on scrub bar */}
                {sorted.map(c => (
                  <div key={c.id}
                    style={{ position:"absolute", left:`${Math.min(99,(c.ts/dur)*100)}%`, width:8, height:8, borderRadius:"50%", background:c.role==="client"?C.accent:"#8fa3b5", transform:"translateX(-50%)", zIndex:4, opacity:c.resolved?.4:1 }}/>
                ))}
                <div style={{ position:"absolute", left:`${(playhead/dur)*100}%`, width:13, height:13, borderRadius:"50%", background:"#fff", transform:"translateX(-50%)", boxShadow:"0 1px 5px rgba(0,0,0,.5)", zIndex:5 }}/>
              </div>
              {/* Buttons */}
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <button onClick={() => { const t = Math.max(0,playhead-10); setPlayhead(t); if(videoRef.current) videoRef.current.currentTime=t; }}
                  style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,.5)", fontSize:18, lineHeight:1, padding:"2px 4px" }}>⏪</button>
                <button onClick={() => { if(playing){videoRef.current?.pause();}else{videoRef.current?.play().catch(()=>{});}setPlaying(p=>!p); }}
                  style={{ width:32, height:32, borderRadius:8, background:"rgba(255,255,255,.12)", border:"1px solid rgba(255,255,255,.2)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {playing
                    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    : <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
                </button>
                <button onClick={() => { const t = Math.min(dur,playhead+10); setPlayhead(t); if(videoRef.current) videoRef.current.currentTime=t; }}
                  style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,.5)", fontSize:18, lineHeight:1, padding:"2px 4px" }}>⏩</button>
                <span style={{ fontSize:10, fontFamily:"monospace", color:"rgba(255,255,255,.4)", marginLeft:4 }}>{fmt(playhead)} / {fmt(dur)}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Notes panel ── */}
        <div>
          {/* Add note */}
          <div style={{ background:dark?"rgba(255,255,255,.06)":"#fff", border:`1px solid ${brd}`, borderRadius:14, padding:16, marginBottom:12 }}>
            <p style={{ fontSize:11, fontWeight:700, color:sub, textTransform:"uppercase", letterSpacing:.5, margin:"0 0 10px" }}>
              Leave a note at {fmt(playhead)}
            </p>
            {/* Client name */}
            <input value={clientName} onChange={e => setClientName(e.target.value)}
              placeholder="Your name"
              style={{ width:"100%", padding:"8px 10px", border:`1px solid ${brd}`, borderRadius:8, fontSize:12, color:fg, background:dark?"rgba(255,255,255,.06)":C.cream, outline:"none", fontFamily:"inherit", boxSizing:"border-box", marginBottom:8 }}/>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => { if(e.key==="Enter" && e.metaKey) addNote(); }}
              placeholder="Pause the video at any moment and type your note here…"
              style={{ width:"100%", height:80, padding:"8px 10px", border:`1px solid ${brd}`, borderRadius:8, fontSize:12, color:fg, background:dark?"rgba(255,255,255,.06)":C.cream, resize:"none", outline:"none", boxSizing:"border-box", fontFamily:"inherit", lineHeight:1.5 }}/>
            <button onClick={addNote} disabled={!noteText.trim() || saving}
              style={{ marginTop:8, width:"100%", padding:"9px 0", background:noteText.trim()?brandColor:"#ccc", color:"#fff", border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:noteText.trim()?"pointer":"default", transition:"background .15s" }}>
              {saving ? "Saving…" : `Add Note at ${fmt(playhead)}`}
            </button>
            {saved && <p style={{ fontSize:11, color:C.green, textAlign:"center", marginTop:6 }}>✓ Note saved — your photographer will see this</p>}
            <p style={{ fontSize:10, color:sub, textAlign:"center", marginTop:6 }}>Tip: pause the video at a specific moment, then type your note</p>
          </div>

          {/* Notes list */}
          <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:460, overflowY:"auto" }}>
            {sorted.length === 0 ? (
              <div style={{ textAlign:"center", padding:"24px 0", color:sub }}>
                <p style={{ fontSize:12 }}>No notes yet for this version.</p>
                <p style={{ fontSize:11 }}>Pause the video and add your first note above.</p>
              </div>
            ) : sorted.map(c => (
              <div key={c.id}
                onClick={() => jumpTo(c.ts)}
                style={{ background:c.resolved?(dark?"rgba(255,255,255,.03)":"#f9faf8"):(dark?"rgba(255,255,255,.06)":C.cream), border:`1.5px solid ${c.resolved?"#c3d9c3":brd}`, borderRadius:10, padding:12, cursor:"pointer", opacity:c.resolved?.7:1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <div style={{ display:"flex", gap:7, alignItems:"center" }}>
                    <div style={{ width:24, height:24, borderRadius:"50%", background:c.role==="client"?C.accent:"#7a8c9e", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, flexShrink:0 }}>{c.avatar}</div>
                    <span style={{ fontSize:11, fontWeight:600, color:fg }}>{c.author}</span>
                    <span style={{ fontFamily:"monospace", fontSize:10, fontWeight:700, color:"#fff", background:c.role==="client"?C.accent:"#7a8c9e", padding:"1px 6px", borderRadius:4 }}>{fmt(c.ts)}</span>
                  </div>
                  {c.resolved
                    ? <span style={{ fontSize:10, color:C.green, fontWeight:600 }}>✓ Resolved</span>
                    : <span style={{ fontSize:10, color:sub }}>Jump →</span>}
                </div>
                <p style={{ fontSize:12, color:fg, margin:0, lineHeight:1.5, textDecoration:c.resolved?"line-through":"none" }}>{c.text}</p>
                {c.replies?.length > 0 && (
                  <div style={{ borderLeft:`2px solid ${brd}`, marginLeft:8, paddingLeft:10, marginTop:8 }}>
                    {c.replies.map((r, i) => (
                      <div key={i} style={{ fontSize:11, color:fg, marginBottom:3 }}><strong>{r.author}:</strong> {r.text}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Client Portal Page ────────────────────────────────────────────────────
export default function ClientPortalPage({ params }) {
  const projectId = params?.projectId ? Number(params.projectId) : null;

  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [expired,  setExpired]  = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [fetchErr, setFetchErr] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [data,     setData]     = useState(null);
  const [tab,      setTab]      = useState("gallery");
  const [favs,     setFavs]     = useState([]);
  const [lightbox, setLightbox] = useState(null);
  // Currently-selected folder on the gallery tab. null = folder grid view
  // (when folders exist) OR flat-gallery view (when none exist).
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [msgDraft,  setMsgDraft]  = useState("");
  const [msgs,      setMsgs]      = useState([]);
  const [msgSent,   setMsgSent]   = useState(false);
  const [msgSending,setMsgSending]= useState(false);
  const [threads,    setThreads]    = useState({}); // { threadId: { id, contactName, messages } }
  const [selThreadId,setSelThreadId]= useState(null);
  const [dlProgress, setDlProgress] = useState(null); // null | { done: n, total: n }
  const [payModal,  setPayModal]  = useState(null);  // invoice being paid
  const [payDone,   setPayDone]   = useState({});    // { [invoiceId]: true }
  const [paying,    setPaying]    = useState(false);
  const [selectedPmId, setSelectedPmId] = useState(null); // chosen payment method id
  // ── Messages tab sub-tabs ────────────────────────────────────────────
  // Two parallel chats: per-project (everyone in the project shares it)
  // and per-client (private 1:1 with the photographer). The general chat
  // lives in the photographer's app_state.extras.clientChats[<slug>] and
  // is keyed by the visitor's identity slug.
  const [messagesSubTab, setMessagesSubTab] = useState("project"); // "project" | "general"
  const [generalMsgs,    setGeneralMsgs]    = useState([]);
  const [generalDraft,   setGeneralDraft]   = useState("");
  const [generalSending, setGeneralSending] = useState(false);
  // ── Shared chat identity ──────────────────────────────────────────────
  // The portal supports multiple participants in one project chat (e.g.
  // Mike + Kelly + the photographer). Each visitor identifies themselves
  // via ?as=<slug> (auto-matched to contacts) or via an in-app picker.
  // The chosen identity is remembered in localStorage per-project.
  const [identity,           setIdentity]           = useState(null);   // { name, slug, contactId? } | null
  const [identityResolved,   setIdentityResolved]   = useState(false);
  const [identityPickerOpen, setIdentityPickerOpen] = useState(false);
  const [pickerNameDraft,    setPickerNameDraft]    = useState("");
  // Profile editor + saved-payment-methods state (lifted so it survives tab switches)
  const [profileForm,    setProfileForm]    = useState(null); // { name, email, phone, address: { line1, city, state, zip } }
  const [profileSaving,  setProfileSaving]  = useState(false);
  const [profileSaved,   setProfileSaved]   = useState(false);
  const [showAddCard,    setShowAddCard]    = useState(false);
  const [showAddBank,    setShowAddBank]    = useState(false);
  const [cardDraft,      setCardDraft]      = useState({ cardholder:"", number:"", expiryMonth:"", expiryYear:"", cvc:"" });
  const [bankDraft,      setBankDraft]      = useState({ accountHolder:"", routing:"", account:"", accountType:"checking" });
  const [pmError,        setPmError]        = useState(null);
  const sbRef = useRef(null);
  const msgEndRef = useRef(null);
  // Photographer's user_id from the link's ?owner= param. Passed to every
  // public-portal RPC as p_owner_user_id so the right account is targeted
  // even if two users happen to share a project ID. Falls back to the
  // server's heuristic when missing (older links keep working).
  const ownerUserIdRef = useRef(null);
  // Optional ?general=<slug> override — when present, the General chat
  // uses this as its thread key instead of the visitor's identity slug.
  // Lets the photographer add a third party to a CRM client's general
  // chat by sharing them a per-contact link with both ?as= and ?general=.
  const generalKeyRef = useRef(null);
  if (typeof window !== "undefined" && ownerUserIdRef.current === null) {
    try {
      const p = new URLSearchParams(window.location.search || "");
      ownerUserIdRef.current = p.get("owner") || undefined;
      generalKeyRef.current  = p.get("general") || null;
    } catch(_) { ownerUserIdRef.current = undefined; generalKeyRef.current = null; }
  }

  useEffect(() => {
    if (!projectId || isNaN(projectId)) { setNotFound(true); setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
        sbRef.current = sb;
        const { data: result, error } = await sb.rpc("get_client_portal_data", { p_project_id: projectId, p_owner_user_id: ownerUserIdRef.current || null });
        if (cancelled) return;
        if (error) { setFetchErr(error.message || "Failed to load."); setLoading(false); return; }
        if (!result) { setNotFound(true); setLoading(false); return; }
        const delivery = result.delivery || {};
        if (!delivery.published) { setNotReady(true); setLoading(false); return; }
        if (delivery.expiryEnabled && delivery.expiryDate && new Date(delivery.expiryDate) < new Date()) { setExpired(true); setLoading(false); return; }
        if (!delivery.pinEnabled) setUnlocked(true);
        if (result.threads && typeof result.threads === "object" && Object.keys(result.threads).length > 0) {
          setThreads(result.threads);
          // Auto-select thread matching project.client or first thread
          const clientName = result.project?.client || "";
          const matchId = Object.values(result.threads).find(t => t.contactName?.toLowerCase() === clientName.toLowerCase())?.id;
          setSelThreadId(matchId || Object.keys(result.threads)[0] || null);
        } else if (Array.isArray(result.messages) && result.messages.length > 0) {
          // Legacy: wrap in single thread
          const fallbackId = "default";
          setThreads({ [fallbackId]: { id: fallbackId, contactName: result.project?.client || "Client", messages: result.messages } });
          setSelThreadId(fallbackId);
        }
        setData(result);
        setLoading(false);
        // ── Resolve who the visitor is for the shared chat ────────────────
        try {
          const contacts = (result.project?.contacts || []).filter(c => c && c.name);
          // Always include the project's primary client as a fallback contact
          if (result.project?.client && !contacts.find(c => slugify(c.name) === slugify(result.project.client))) {
            contacts.unshift({ id:"primary", name: result.project.client, role:"Client" });
          }
          const params = new URLSearchParams(window.location.search || "");
          const asParam = params.get("as");
          const stored = (() => {
            try { return JSON.parse(localStorage.getItem("portal_identity_" + projectId) || "null"); }
            catch { return null; }
          })();
          let resolved = null;
          if (asParam) {
            const sParam = slugify(asParam);
            const match = contacts.find(c => slugify(c.name) === sParam);
            resolved = match
              ? { name: match.name, slug: slugify(match.name), contactId: match.id, role: match.role }
              : { name: asParam, slug: sParam }; // free-form fallback
          } else if (stored && stored.name) {
            resolved = stored;
          }
          if (resolved) {
            setIdentity(resolved);
            try { localStorage.setItem("portal_identity_" + projectId, JSON.stringify(resolved)); } catch(_) {}
          }
        } catch(_) {}
        setIdentityResolved(true);
      } catch(err) {
        if (cancelled) return;
        setFetchErr(err?.message || "Something went wrong.");
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [projectId]);

  // ── Poll for new studio messages every 6 seconds when messages tab is open ──
  useEffect(() => {
    if (!data || tab !== "messages") return;
    const poll = async () => {
      try {
        const sb = sbRef.current;
        if (!sb) return;
        const { data: result } = await sb.rpc("get_client_portal_data", { p_project_id: Number(projectId), p_owner_user_id: ownerUserIdRef.current || null });
        if (result?.threads && typeof result.threads === "object") {
          setThreads(result.threads);
        } else if (result && Array.isArray(result.messages)) {
          setMsgs(result.messages);
        }
      } catch (_) {}
    };
    const iv = setInterval(poll, 6000);
    return () => clearInterval(iv);
  }, [data, tab, projectId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (msgEndRef.current) {
      msgEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [msgs, threads, selThreadId]);

  // ── Prompt for identity when the visitor first opens the Messages tab ─
  useEffect(() => {
    if (tab === "messages" && identityResolved && !identity && !identityPickerOpen) {
      setIdentityPickerOpen(true);
    }
  }, [tab, identity, identityResolved, identityPickerOpen]);

  // ── Fetch + poll general-chat messages when the visitor has an identity
  // and the Messages > General sub-tab is open. Lives above early returns
  // (Rules of Hooks).
  useEffect(() => {
    if (tab !== "messages" || messagesSubTab !== "general") return;
    if (!identity?.name || !projectId) return;
    // Chat key: ?general=<slug> from the URL takes precedence (lets a third
    // party join an existing client's general chat). Otherwise the visitor's
    // own identity name is the key.
    const chatKey = generalKeyRef.current || identity.name;
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const sb = sbRef.current;
        if (!sb) return;
        const { data: arr } = await sb.rpc("get_general_messages", {
          p_project_id:    Number(projectId),
          p_contact_name:  chatKey,
          p_owner_user_id: ownerUserIdRef.current || null,
        });
        if (cancelled) return;
        if (Array.isArray(arr)) setGeneralMsgs(arr);
      } catch (_) {}
    };
    fetchOnce();
    const iv = setInterval(fetchOnce, 6000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [tab, messagesSubTab, identity?.name, projectId]);

  // ── Initialize the profile form when identity + data resolve ─────────
  // IMPORTANT: this hook must live above the early-return blocks below,
  // because React requires hooks to be called in the same order on every
  // render. Putting it after a conditional return crashes the component.
  useEffect(() => {
    const list = data?.project?.contacts || [];
    if (!identity || list.length === 0) { setProfileForm(null); return; }
    let mc = null;
    if (identity.contactId) mc = list.find(c => c.id === identity.contactId);
    if (!mc) mc = list.find(c => slugify(c.name) === identity.slug) || null;
    if (!mc) { setProfileForm(null); return; }
    setProfileForm({
      name:    mc.name  || "",
      email:   mc.email || "",
      phone:   mc.phone || "",
      address: mc.address || { line1:"", city:"", state:"", zip:"" },
    });
  }, [data, identity]);

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.cream }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:40, height:40, border:`3px solid ${C.border}`, borderTopColor:C.ink, borderRadius:"50%", animation:"spin 1s linear infinite", margin:"0 auto 16px" }}/>
        <p style={{ fontSize:13, color:C.muted }}>Loading your gallery…</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.cream, padding:24, fontFamily:"Inter, system-ui, sans-serif" }}>
      <div style={{ textAlign:"center" }}><div style={{ fontSize:40, marginBottom:16 }}>🔍</div>
        <p style={{ fontSize:20, fontWeight:700, color:C.ink, marginBottom:8 }}>Gallery Not Found</p>
        <p style={{ fontSize:13, color:C.muted }}>This link may be invalid or the gallery has been removed.</p>
      </div>
    </div>
  );

  if (notReady) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.cream, padding:24, fontFamily:"Inter, system-ui, sans-serif" }}>
      <div style={{ textAlign:"center" }}><div style={{ fontSize:40, marginBottom:16 }}>📷</div>
        <p style={{ fontSize:20, fontWeight:700, color:C.ink, marginBottom:8 }}>Gallery Coming Soon</p>
        <p style={{ fontSize:13, color:C.muted }}>Your photographer is still preparing your gallery. Check back soon!</p>
      </div>
    </div>
  );

  if (fetchErr) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.cream, padding:24, fontFamily:"Inter, system-ui, sans-serif" }}>
      <div style={{ textAlign:"center" }}><div style={{ fontSize:40, marginBottom:16 }}>⚠️</div>
        <p style={{ fontSize:20, fontWeight:700, color:C.ink, marginBottom:8 }}>Unable to Load Gallery</p>
        <p style={{ fontSize:13, color:C.muted, maxWidth:320 }}>{fetchErr}</p>
        <button onClick={() => window.location.reload()} style={{ marginTop:20, padding:"10px 22px", background:C.ink, color:"#fff", border:"none", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer" }}>Try Again</button>
      </div>
    </div>
  );

  if (expired) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.cream, padding:24, fontFamily:"Inter, system-ui, sans-serif" }}>
      <div style={{ textAlign:"center" }}><div style={{ fontSize:40, marginBottom:16 }}>⏰</div>
        <p style={{ fontSize:20, fontWeight:700, color:C.ink, marginBottom:8 }}>Gallery Expired</p>
        <p style={{ fontSize:13, color:C.muted }}>This gallery link has expired. Please contact your photographer for a new link.</p>
      </div>
    </div>
  );

  const { delivery = {}, project = {}, photos: rawPhotos, galleryFolders: rawFolders, brandKit = {}, invoices = [], videoDeliverables: rawVids, videoComments: rawCmts } = data || {};
  const galleryFolders = Array.isArray(rawFolders) ? rawFolders : [];
  const photos = Array.isArray(rawPhotos) ? rawPhotos : [];
  const videoDeliverables = Array.isArray(rawVids) ? rawVids : [];
  const videoComments = rawCmts && typeof rawCmts === "object" ? rawCmts : {};

  if (!unlocked && delivery.pinEnabled) return <PinGate pin={delivery.pin} onUnlock={() => setUnlocked(true)}/>;

  const brandColor = brandKit.primaryColor || C.ink;
  const studioName = brandKit.studioName || "Your Photographer";
  const dark = delivery.darkMode;
  const bg   = dark ? "#111" : "#fff";
  const fg   = dark ? "#fff" : C.ink;
  const sub  = dark ? "rgba(255,255,255,.55)" : C.muted;
  const brd  = dark ? "rgba(255,255,255,.12)" : C.border;

  const hasVideos = videoDeliverables.length > 0;

  const TABS = [
    { id:"gallery",  label:"Gallery",  show: true },
    { id:"video",    label:"Video Review", show: hasVideos },
    { id:"progress", label:"Progress", show: true },
    { id:"invoice",  label:"Invoice",  show: true },
    { id:"messages", label:"Messages", show: true },
    { id:"profile",  label:"Profile",  show: true },
  ].filter(t => t.show);

  const checklist = project.checklist || [];
  const done = checklist.filter(c => c.checked).length;
  const openInvoices = invoices.filter(i => i.status !== "Paid");
  const totalDue = openInvoices.reduce((s, i) => s + (Number(i.total)||0), 0);

  // ── Download all photos sequentially with progress ──────────────────────────
  const downloadAllPhotos = async () => {
    if (!photos.length || dlProgress) return;
    setDlProgress({ done: 0, total: photos.length });
    for (let i = 0; i < photos.length; i++) {
      const ph = photos[i];
      const url = typeof ph === "string" ? ph : ph?.url;
      const ext = (url || "").split("?")[0].split(".").pop() || "jpg";
      const filename = ph?.name || `photo-${i + 1}.${ext}`;
      await downloadBlob(url, filename);
      setDlProgress({ done: i + 1, total: photos.length });
      // small gap between downloads so browser doesn't throttle
      if (i < photos.length - 1) await new Promise(r => setTimeout(r, 300));
    }
    setTimeout(() => setDlProgress(null), 2500);
  };

  // ── Send message to the shared project chat ─────────────────────────────────
  // All participants (photographer, contacts, walk-ins) post into a single
  // thread keyed "default" — the senderName is taken from the resolved
  // identity. This collapses the old multi-thread model into one shared chat.
  const sendMsg = async () => {
    const text = msgDraft.trim();
    if (!text || msgSending) return;
    if (!identity) { setIdentityPickerOpen(true); return; } // require identity
    setMsgSending(true);
    const tid = "default"; // always the shared thread
    const msg = {
      id:         "msg_" + Date.now(),
      from:       "client",
      senderName: identity.name,
      senderSlug: identity.slug,
      text,
      ts:         new Date().toISOString(),
    };
    setThreads(prev => {
      const prevThread = prev[tid] || { id: tid, contactName: "Project Chat", messages: [] };
      return { ...prev, [tid]: { ...prevThread, messages: [...prevThread.messages, msg] } };
    });
    setMsgDraft("");
    try {
      const sb = sbRef.current;
      if (sb) {
        await sb.rpc("send_client_message", {
          p_project_id:    Number(projectId),
          p_message:       msg,
          p_thread_id:     tid,
          p_contact_name:  "Project Chat",
          p_owner_user_id: ownerUserIdRef.current || null,
        });
        setMsgSent(true);
        setTimeout(() => setMsgSent(false), 3000);
      }
    } catch (_) {}
    setMsgSending(false);
  };

  // ── Resolve which contact card the visitor maps to ─────────────────────────
  // Used by the Profile tab + Pay Now to find the right contact in the
  // photographer's project.contacts array. Matches first by contactId
  // (set when the URL had ?as=<slug> matching a real contact), then by
  // slugified name (free-form names that happen to match), so re-opening
  // the portal as the same client lands on the same profile.
  const myContact = (() => {
    const list = (project?.contacts || []);
    if (!identity) return null;
    if (identity.contactId) {
      const m = list.find(c => c.id === identity.contactId);
      if (m) return m;
    }
    return list.find(c => slugify(c.name) === identity.slug) || null;
  })();

  // Persist a patch onto the matched contact via update_client_profile RPC.
  // Optimistically updates local data so the UI reflects immediately.
  const saveContactPatch = async (patch) => {
    if (!myContact?.id) return false;
    setProfileSaving(true);
    try {
      const sb = sbRef.current;
      if (!sb) throw new Error("no supabase client");
      const { error } = await sb.rpc("update_client_profile", {
        p_project_id:    Number(projectId),
        p_contact_id:    myContact.id,
        p_profile_data:  patch,
        p_owner_user_id: ownerUserIdRef.current || null,
      });
      if (error) throw error;
      setData(prev => {
        if (!prev) return prev;
        const updatedContacts = (prev.project?.contacts || []).map(c =>
          c.id === myContact.id ? { ...c, ...patch } : c
        );
        return { ...prev, project: { ...prev.project, contacts: updatedContacts } };
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 1800);
      return true;
    } catch (e) {
      console.error("[portal] saveContactPatch failed:", e);
      return false;
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Demo-mode payment method handlers ──────────────────────────────────────
  // Both forms collect the full number/account client-side, but we ONLY persist
  // brand + last 4 digits to the photographer's app_state. Real PCI-compliant
  // card storage requires a payment processor like Stripe.
  const submitCard = async () => {
    setPmError(null);
    const num = cardDraft.number.replace(/\D/g, "");
    if (num.length < 12) { setPmError("That card number doesn't look right"); return; }
    if (!cardDraft.cardholder.trim()) { setPmError("Please add the cardholder name"); return; }
    if (!cardDraft.expiryMonth || !cardDraft.expiryYear) { setPmError("Please add an expiry date"); return; }
    const newMethod = {
      id: "pm_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6),
      type: "card",
      brand: cardBrand(num),
      last4: last4(num),
      expiryMonth: cardDraft.expiryMonth,
      expiryYear:  cardDraft.expiryYear,
      cardholder:  cardDraft.cardholder.trim(),
      addedAt: new Date().toISOString(),
    };
    const existing = myContact?.paymentMethods || [];
    if (existing.length === 0) newMethod.default = true;
    const ok = await saveContactPatch({ paymentMethods: [...existing, newMethod] });
    if (ok) {
      setShowAddCard(false);
      setCardDraft({ cardholder:"", number:"", expiryMonth:"", expiryYear:"", cvc:"" });
    } else {
      setPmError("Couldn't save — please try again.");
    }
  };
  const submitBank = async () => {
    setPmError(null);
    const acct = bankDraft.account.replace(/\D/g, "");
    const rt   = bankDraft.routing.replace(/\D/g, "");
    if (acct.length < 4) { setPmError("Account number looks too short"); return; }
    if (rt.length !== 9)  { setPmError("Routing numbers in the US are 9 digits"); return; }
    if (!bankDraft.accountHolder.trim()) { setPmError("Please add the account holder name"); return; }
    const newMethod = {
      id: "pm_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6),
      type: "bank",
      bankName: "Bank ••" + rt.slice(-4),
      last4: last4(acct),
      accountType: bankDraft.accountType,
      accountHolder: bankDraft.accountHolder.trim(),
      addedAt: new Date().toISOString(),
    };
    const existing = myContact?.paymentMethods || [];
    if (existing.length === 0) newMethod.default = true;
    const ok = await saveContactPatch({ paymentMethods: [...existing, newMethod] });
    if (ok) {
      setShowAddBank(false);
      setBankDraft({ accountHolder:"", routing:"", account:"", accountType:"checking" });
    } else {
      setPmError("Couldn't save — please try again.");
    }
  };
  const removePaymentMethod = async (pmId) => {
    if (!myContact) return;
    const next = (myContact.paymentMethods || []).filter(m => m.id !== pmId);
    // If we removed the default and others remain, mark first as default
    if (next.length > 0 && !next.some(m => m.default)) next[0] = { ...next[0], default: true };
    await saveContactPatch({ paymentMethods: next });
  };
  const setDefaultMethod = async (pmId) => {
    if (!myContact) return;
    const next = (myContact.paymentMethods || []).map(m => ({ ...m, default: m.id === pmId }));
    await saveContactPatch({ paymentMethods: next });
  };

  const saveProfileForm = async () => {
    if (!profileForm) return;
    await saveContactPatch({
      name:  profileForm.name,
      email: profileForm.email,
      phone: profileForm.phone,
      address: profileForm.address,
    });
  };

  // Send a message into the general (1:1 with photographer) chat thread.
  const sendGeneralMsg = async () => {
    const text = generalDraft.trim();
    if (!text || generalSending) return;
    if (!identity) { setIdentityPickerOpen(true); return; }
    setGeneralSending(true);
    const msg = {
      id:         "gm_" + Date.now(),
      from:       "client",
      senderName: identity.name,
      senderSlug: identity.slug,
      text,
      ts:         new Date().toISOString(),
    };
    setGeneralMsgs(prev => [...(prev || []), msg]);
    setGeneralDraft("");
    try {
      const sb = sbRef.current;
      if (sb) {
        await sb.rpc("send_general_message", {
          p_project_id:    Number(projectId),
          p_message:       msg,
          // Use the URL's chat key when present so third-party participants
          // post into the right CRM client's thread, not their own.
          p_contact_name:  generalKeyRef.current || identity.name,
          p_owner_user_id: ownerUserIdRef.current || null,
        });
      }
    } catch (_) {}
    setGeneralSending(false);
  };

  // Confirm an identity picker selection.
  const confirmIdentity = (val) => {
    if (!val) return;
    const contacts = (project?.contacts || []);
    const sVal = slugify(val);
    const match = contacts.find(c => slugify(c.name) === sVal);
    const next = match
      ? { name: match.name, slug: slugify(match.name), contactId: match.id, role: match.role }
      : { name: val, slug: sVal };
    setIdentity(next);
    setIdentityPickerOpen(false);
    setPickerNameDraft("");
    try { localStorage.setItem("portal_identity_" + projectId, JSON.stringify(next)); } catch(_) {}
  };

  return (
    <div style={{ minHeight:"100vh", background:bg, color:fg, fontFamily:"Inter, system-ui, sans-serif" }}>

      {/* ── Nav ── */}
      <div style={{ background:bg, borderBottom:`1px solid ${brd}`, padding:"0 24px", display:"flex", alignItems:"center", gap:16, position:"sticky", top:0, zIndex:100 }}>
        {brandKit.logoUrl
          ? <img src={brandKit.logoUrl} alt={studioName} style={{ height:32, objectFit:"contain" }}/>
          : <span style={{ fontSize:15, fontWeight:700, color:fg, padding:"16px 0" }}>{studioName}</span>
        }
        <div style={{ flex:1 }}/>
        <div style={{ display:"flex", gap:2, overflowX:"auto" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding:"16px 14px", fontSize:12, fontWeight:tab===t.id?700:400, color:tab===t.id?fg:sub, background:"none", border:"none", borderBottom:`2px solid ${tab===t.id?brandColor:"transparent"}`, cursor:"pointer", whiteSpace:"nowrap", transition:"all .15s" }}>
              {t.label}
              {t.id==="video" && videoDeliverables.length > 0 && (
                <span style={{ marginLeft:5, background:brandColor, color:"#fff", borderRadius:99, fontSize:9, fontWeight:700, padding:"1px 5px" }}>{videoDeliverables.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Gallery tab ── */}
      {tab === "gallery" && (() => {
        // Decide what to show:
        // - No folders configured → classic flat gallery (all photos).
        // - Folders configured + nothing selected → folder grid (cards).
        // - Folders configured + a folder selected → photos in that folder.
        // - "_ungrouped" pseudo-folder for any photos without a folderId.
        const hasFolders     = galleryFolders.length > 0;
        const ungroupedPhotos = photos.filter(p => !p?.folderId);
        const showGrid       = hasFolders && selectedFolderId === null;
        const photosInFolder = (folderId) => folderId === "_ungrouped"
          ? photos.filter(p => !p?.folderId)
          : photos.filter(p => p?.folderId === folderId);
        const selectedFolder = galleryFolders.find(f => f.id === selectedFolderId);
        const visiblePhotos  = !hasFolders ? photos
          : selectedFolderId === null ? []
          : photosInFolder(selectedFolderId);

        // Download-all helper that respects the current view (folder vs all).
        const downloadVisible = async () => {
          if (!visiblePhotos.length || dlProgress) return;
          setDlProgress({ done: 0, total: visiblePhotos.length });
          for (let i = 0; i < visiblePhotos.length; i++) {
            const ph = visiblePhotos[i];
            const url = typeof ph === "string" ? ph : ph?.url;
            const ext = (url || "").split("?")[0].split(".").pop() || "jpg";
            const filename = ph?.name || `photo-${i + 1}.${ext}`;
            await downloadBlob(url, filename);
            setDlProgress({ done: i + 1, total: visiblePhotos.length });
            if (i < visiblePhotos.length - 1) await new Promise(r => setTimeout(r, 300));
          }
          setTimeout(() => setDlProgress(null), 2500);
        };

        return (
          <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>
            {/* Breadcrumb back to folder grid */}
            {hasFolders && selectedFolderId !== null && (
              <button onClick={() => setSelectedFolderId(null)}
                style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"7px 14px", background:dark?"rgba(255,255,255,.06)":"#fff", border:`1px solid ${brd}`, borderRadius:9, fontSize:12, fontWeight:600, color:fg, cursor:"pointer", marginBottom:18, fontFamily:"inherit" }}>
                ← All folders
              </button>
            )}

            <div style={{ textAlign:"center", marginBottom:36 }}>
              <p style={{ fontSize:12, color:sub, textTransform:"uppercase", letterSpacing:3, margin:"0 0 10px" }}>{project.type} · {new Date().toLocaleDateString("en-US",{year:"numeric",month:"long"})}</p>
              <h1 style={{ fontFamily:"'Cormorant Garamond', Georgia, serif", fontSize:36, fontWeight:500, color:fg, margin:"0 0 12px", letterSpacing:-.5 }}>
                {showGrid
                  ? (delivery.galleryTitle || (project.name ? `${project.name} — Your Galleries` : "Your Galleries"))
                  : (selectedFolder?.name || delivery.galleryTitle || (project.name ? `${project.name} — Your Gallery` : "Your Gallery"))}
              </h1>
              {showGrid
                ? <p style={{ fontSize:14, color:sub, maxWidth:540, margin:"0 auto 24px", lineHeight:1.7 }}>Pick a folder to view its photos.</p>
                : (delivery.message && <p style={{ fontSize:14, color:sub, maxWidth:540, margin:"0 auto 24px", lineHeight:1.7 }}>{delivery.message}</p>)}
              {!showGrid && visiblePhotos.length > 0 && (
                <button onClick={downloadVisible} disabled={!!dlProgress}
                  style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"11px 24px", background:dlProgress?"#a0a0a0":brandColor, color:"#fff", borderRadius:12, fontSize:13, fontWeight:600, cursor:dlProgress?"not-allowed":"pointer", border:"none", transition:"background .15s" }}>
                  {dlProgress
                    ? (dlProgress.done === dlProgress.total
                        ? `✓ Downloaded all ${dlProgress.total} ${dlProgress.total===1?"photo":"photos"}`
                        : `↓ Downloading ${dlProgress.done} / ${dlProgress.total}…`)
                    : `↓ Download ${selectedFolder ? `"${selectedFolder.name}"` : "All"} (${visiblePhotos.length} ${visiblePhotos.length===1?"photo":"photos"})`}
                </button>
              )}
              {!showGrid && favs.length > 0 && <p style={{ fontSize:12, color:sub, marginTop:10 }}>{favs.length} photo{favs.length!==1?"s":""} hearted</p>}
            </div>

            {/* Folder grid view */}
            {showGrid && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:14 }}>
                {galleryFolders.map(f => {
                  const fp     = photosInFolder(f.id);
                  const cover  = fp.find(p => p?.url) || null;
                  const coverUrl = cover ? (typeof cover === "string" ? cover : cover.url) : null;
                  return (
                    <button key={f.id} onClick={() => setSelectedFolderId(f.id)}
                      style={{ display:"flex", flexDirection:"column", alignItems:"stretch", padding:0, background:dark?"rgba(255,255,255,.04)":"#fff", border:`1px solid ${brd}`, borderRadius:14, overflow:"hidden", cursor:"pointer", transition:"transform .15s, box-shadow .15s", textAlign:"left", fontFamily:"inherit" }}
                      onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 6px 16px rgba(0,0,0,.08)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; }}>
                      <div style={{ aspectRatio:"4/3", background: coverUrl ? `url(${coverUrl}) center/cover` : (dark?"rgba(255,255,255,.08)":"#f4efe8"), position:"relative" }}>
                        {!coverUrl && (
                          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                          </div>
                        )}
                        <span style={{ position:"absolute", top:8, right:8, padding:"3px 9px", borderRadius:99, background:"rgba(0,0,0,.55)", color:"#fff", fontSize:11, fontWeight:700 }}>{fp.length}</span>
                      </div>
                      <div style={{ padding:"12px 14px" }}>
                        <p style={{ fontSize:14, fontWeight:700, color:fg, margin:0 }}>{f.name}</p>
                        <p style={{ fontSize:11, color:sub, margin:"2px 0 0" }}>{fp.length} {fp.length===1?"photo":"photos"}</p>
                      </div>
                    </button>
                  );
                })}
                {/* Ungrouped pseudo-folder, only if any */}
                {ungroupedPhotos.length > 0 && (() => {
                  const cover = ungroupedPhotos.find(p => p?.url) || null;
                  const coverUrl = cover ? (typeof cover === "string" ? cover : cover.url) : null;
                  return (
                    <button onClick={() => setSelectedFolderId("_ungrouped")}
                      style={{ display:"flex", flexDirection:"column", padding:0, background:dark?"rgba(255,255,255,.04)":"#fff", border:`1px dashed ${brd}`, borderRadius:14, overflow:"hidden", cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
                      <div style={{ aspectRatio:"4/3", background: coverUrl ? `url(${coverUrl}) center/cover` : (dark?"rgba(255,255,255,.06)":"#f4efe8"), position:"relative" }}>
                        <span style={{ position:"absolute", top:8, right:8, padding:"3px 9px", borderRadius:99, background:"rgba(0,0,0,.55)", color:"#fff", fontSize:11, fontWeight:700 }}>{ungroupedPhotos.length}</span>
                      </div>
                      <div style={{ padding:"12px 14px" }}>
                        <p style={{ fontSize:14, fontWeight:700, color:fg, margin:0 }}>Other photos</p>
                        <p style={{ fontSize:11, color:sub, margin:"2px 0 0" }}>{ungroupedPhotos.length} not in any folder</p>
                      </div>
                    </button>
                  );
                })()}
              </div>
            )}

            {/* Folder detail (or flat gallery if no folders) */}
            {!showGrid && (
              visiblePhotos.length === 0 ? (
                <div style={{ textAlign:"center", padding:"60px 0", color:sub }}><p style={{ fontSize:16 }}>{hasFolders ? "This folder is empty." : "Your photos will appear here once ready."}</p></div>
              ) : (
                <div style={{ columns:3, columnGap:6 }}>
                  {visiblePhotos.map((photo, vIdx) => {
                    // Translate the visible index to the original photos index so favs/lightbox stay consistent.
                    const idx = photos.indexOf(photo);
                    return (
                      <PhotoTile key={idx} photo={photo} isFav={favs.includes(idx)}
                        onFav={() => setFavs(prev => prev.includes(idx)?prev.filter(x=>x!==idx):[...prev,idx])}
                        onClick={() => setLightbox(idx)}
                        onDownload={() => {
                          const url = typeof photo === "string" ? photo : photo?.url;
                          const ext = (url||"").split("?")[0].split(".").pop() || "jpg";
                          const name = photo?.name || `photo-${vIdx+1}.${ext}`;
                          const isVid = photo?.type === "video" || /\.(mp4|mov|webm)(\?|$)/i.test(url||"");
                          if (isVid) { downloadVideo(url, name); } else { downloadBlob(url, name); }
                        }}/>
                    );
                  })}
                </div>
              )
            )}
          </div>
        );
      })()}

      {/* ── Video Review tab ── */}
      {tab === "video" && (
        <VideoReviewTab
          projectId={projectId}
          ownerUserId={ownerUserIdRef.current}
          project={project}
          videoDeliverables={videoDeliverables}
          videoComments={videoComments}
          brandColor={brandColor}
          dark={dark} fg={fg} sub={sub} brd={brd} bg={bg}
          studioName={studioName}
        />
      )}

      {/* ── Progress tab ── */}
      {tab === "progress" && (
        <div style={{ maxWidth:600, margin:"0 auto", padding:"40px 24px" }}>
          <h2 style={{ fontSize:22, fontWeight:700, color:fg, margin:"0 0 6px" }}>Project Progress</h2>
          <p style={{ fontSize:13, color:sub, margin:"0 0 28px" }}>Here's where things stand with your {project.type || "project"}</p>
          {checklist.length === 0 ? (
            <div style={{ textAlign:"center", padding:"48px 0", color:sub }}><p style={{ fontSize:15 }}>Your photographer will update progress here.</p></div>
          ) : (
            <>
              <div style={{ background:dark?"rgba(255,255,255,.1)":C.border, borderRadius:99, height:6, marginBottom:24, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.round((done/checklist.length)*100)}%`, background:brandColor, borderRadius:99, transition:"width .4s" }}/>
              </div>
              <p style={{ fontSize:13, color:sub, margin:"0 0 20px" }}>{done} of {checklist.length} steps complete</p>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {checklist.map((item, idx) => {
                  // ── Format the deadline + decide its color/severity ──────
                  const fmtDue = (iso) => {
                    if (!iso) return "";
                    const d = new Date(iso + "T00:00:00");
                    if (isNaN(d.getTime())) return iso;
                    const sameYear = d.getFullYear() === new Date().getFullYear();
                    return d.toLocaleDateString("en-US", sameYear
                      ? { month:"short", day:"numeric" }
                      : { month:"short", day:"numeric", year:"numeric" });
                  };
                  let dueLabel = null, dueColor = sub;
                  if (item.due) {
                    const d = new Date(item.due + "T00:00:00");
                    if (!isNaN(d.getTime())) {
                      const today = new Date(); today.setHours(0,0,0,0);
                      const days = Math.round((d - today) / 86400000);
                      if (item.checked)        { dueLabel = `Due ${fmtDue(item.due)}`; dueColor = sub; }
                      else if (days < 0)        { dueLabel = `${-days} day${-days===1?"":"s"} overdue`; dueColor = "#c25450"; }
                      else if (days === 0)      { dueLabel = `Due today`;             dueColor = "#c25450"; }
                      else if (days <= 3)       { dueLabel = `Due in ${days} day${days===1?"":"s"}`; dueColor = "#b07a30"; }
                      else                      { dueLabel = `Due ${fmtDue(item.due)}`; dueColor = sub; }
                    }
                  }
                  return (
                    <div key={idx} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px",
                      background:item.checked?(dark?"rgba(74,122,87,.15)":"#edf3ef"):(dark?"rgba(255,255,255,.04)":"#fff"),
                      border:`1px solid ${item.checked?(dark?"rgba(74,122,87,.3)":C.green):brd}`, borderRadius:12 }}>
                      <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${item.checked?C.green:brd}`, background:item.checked?C.green:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        {item.checked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <div style={{ flex:1 }}>
                        <p style={{ fontSize:13, fontWeight:600, color:item.checked?C.green:fg, margin:0 }}>{item.text}</p>
                        {dueLabel && (
                          <p style={{ fontSize:11, color:dueColor, fontWeight:600, margin:"2px 0 0", display:"flex", alignItems:"center", gap:5 }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={dueColor} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            {dueLabel}
                          </p>
                        )}
                        {item.note && item.note.trim() && (
                          <div style={{ marginTop:8, padding:"8px 11px", background:dark?"rgba(255,255,255,.05)":"#f7f5f1", border:`1px solid ${brd}`, borderLeft:`3px solid ${brandColor}`, borderRadius:6, display:"flex", alignItems:"flex-start", gap:7 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop:2, flexShrink:0 }}>
                              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                            </svg>
                            <div style={{ flex:1, minWidth:0 }}>
                              <p style={{ fontSize:10, color:sub, fontWeight:600, textTransform:"uppercase", letterSpacing:.6, margin:"0 0 3px" }}>Note from {studioName}</p>
                              <p style={{ fontSize:12, color:fg, margin:0, lineHeight:1.5, whiteSpace:"pre-wrap" }}>{item.note}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      {item.checked && <span style={{ fontSize:11, color:C.green, fontWeight:600 }}>✓ Done</span>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Invoice tab ── */}
      {tab === "invoice" && (
        <div style={{ maxWidth:680, margin:"0 auto", padding:"40px 24px" }}>
          <h2 style={{ fontSize:22, fontWeight:700, color:fg, margin:"0 0 6px" }}>Invoices</h2>
          <p style={{ fontSize:13, color:sub, margin:"0 0 28px" }}>Your billing summary from {studioName}</p>
          {invoices.length === 0 ? (
            <div style={{ textAlign:"center", padding:"48px 0", color:sub }}><p style={{ fontSize:15 }}>No invoices yet.</p></div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {invoices.map((inv, idx) => {
                const isPaid = inv.status === "Paid" || payDone[inv.id];
                return (
                  <div key={idx} style={{ background:dark?"rgba(255,255,255,.06)":"#fff", border:`1px solid ${isPaid?"#b6e3cc":brd}`, borderRadius:14, padding:"18px 20px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                      <div style={{ flex:1 }}>
                        <p style={{ fontSize:14, fontWeight:600, color:fg, margin:"0 0 3px" }}>{inv.title||inv.description||`Invoice #${inv.id||idx+1}`}</p>
                        <p style={{ fontSize:12, color:sub, margin:0 }}>Due {inv.dueDate||"—"}</p>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <p style={{ fontSize:18, fontWeight:700, color:fg, margin:"0 0 4px" }}>${Number(inv.total||0).toLocaleString()}</p>
                        <span style={{ fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:99, background:isPaid?"#edf3ef":"#fdf4e7", color:isPaid?C.green:"#8a6a2a" }}>
                          {isPaid ? "✓ Paid" : (inv.status||"Pending")}
                        </span>
                      </div>
                    </div>
                    {!isPaid && (
                      <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${brd}` }}>
                        <button onClick={() => setPayModal(inv)}
                          style={{ width:"100%", padding:"12px 0", background:brandColor, color:"#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:700, cursor:"pointer" }}>
                          Pay Now — ${Number(inv.total||0).toLocaleString()}
                        </button>
                      </div>
                    )}
                    {isPaid && payDone[inv.id] && (
                      <div style={{ marginTop:10, fontSize:12, color:C.green, textAlign:"center" }}>✓ Payment confirmed. Thank you!</div>
                    )}
                  </div>
                );
              })}
              {totalDue > 0 && (
                <div style={{ background:dark?"rgba(255,255,255,.04)":C.warm, border:`1px solid ${brd}`, borderRadius:14, padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <p style={{ fontSize:14, fontWeight:600, color:fg, margin:0 }}>Total Due</p>
                  <p style={{ fontSize:20, fontWeight:700, color:fg, margin:0 }}>${totalDue.toLocaleString()}</p>
                </div>
              )}
              <div style={{ background:dark?"rgba(255,255,255,.06)":C.cream, border:`1px dashed ${brd}`, borderRadius:14, padding:"14px 20px", textAlign:"center" }}>
                <p style={{ fontSize:12, color:sub, margin:0 }}>Questions about your invoice? <button onClick={() => setTab("messages")} style={{ background:"none", border:"none", color:brandColor, fontWeight:600, cursor:"pointer", fontSize:12, padding:0 }}>Send a Message</button></p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Pay Now modal (uses saved payment methods from Profile) ── */}
      {payModal && (() => {
        const methods = (myContact?.paymentMethods || []);
        const defaultPm = methods.find(m => m.default) || methods[0] || null;
        const chosenId = selectedPmId || defaultPm?.id || null;
        const chosen   = methods.find(m => m.id === chosenId) || null;
        const needsMethod = !chosen;
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:900, padding:24 }}
            onClick={e => { if(e.target===e.currentTarget && !paying) setPayModal(null); }}>
            <div style={{ background:dark?"#1a1a1a":"#fff", borderRadius:20, padding:"30px 28px", maxWidth:440, width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,.25)", maxHeight:"90vh", overflowY:"auto" }}>
              <h3 style={{ fontSize:20, fontWeight:700, color:fg, margin:"0 0 6px" }}>Pay invoice</h3>
              <p style={{ fontSize:13, color:sub, margin:"0 0 18px" }}>{payModal.title || payModal.description || "Invoice"}</p>
              <div style={{ background:dark?"rgba(255,255,255,.06)":C.warm, borderRadius:12, padding:"14px 18px", marginBottom:18, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:14, color:sub }}>Amount due</span>
                <span style={{ fontSize:24, fontWeight:800, color:fg }}>${Number(payModal.total || 0).toLocaleString()}</span>
              </div>

              {/* Demo banner */}
              <div style={{ display:"flex", gap:8, padding:"9px 12px", background:dark?"rgba(255,193,7,.1)":"#fff8e1", border:`1px solid ${dark?"rgba(255,193,7,.3)":"#ffe082"}`, borderRadius:9, marginBottom:18 }}>
                <span style={{ fontSize:11, color:"#8a5a1a", lineHeight:1.5 }}>
                  <strong>Demo mode</strong> — confirming this won't move real money. Real payments require connecting Stripe.
                </span>
              </div>

              {/* Payment-method picker */}
              <p style={{ fontSize:11, color:sub, fontWeight:600, textTransform:"uppercase", letterSpacing:.6, margin:"0 0 8px" }}>Pay with</p>
              {methods.length === 0 ? (
                <div style={{ padding:"14px 16px", border:`1px dashed ${brd}`, borderRadius:10, marginBottom:14, textAlign:"center" }}>
                  <p style={{ fontSize:12, color:sub, margin:"0 0 8px" }}>No saved payment methods yet.</p>
                  <button onClick={() => { setPayModal(null); setTab("profile"); setShowAddCard(true); }}
                    style={{ padding:"8px 14px", background:brandColor, color:"#fff", border:"none", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                    Add a card on Profile →
                  </button>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
                  {methods.map(m => {
                    const sel = chosenId === m.id;
                    return (
                      <button key={m.id} onClick={() => setSelectedPmId(m.id)}
                        style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 13px", border:`2px solid ${sel ? brandColor : brd}`, borderRadius:11, background: sel ? (dark?"rgba(196,151,74,.1)":"#fdf8f0") : (dark?"rgba(255,255,255,.04)":"#fff"), cursor:"pointer", textAlign:"left", fontFamily:"inherit", color:fg }}>
                        <div style={{ width:36, height:26, borderRadius:5, background:m.type==="card"?"#0a0a0a":"#2d5a45", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:700, flexShrink:0 }}>
                          {m.type === "card" ? (m.brand || "CARD").toUpperCase().slice(0,5) : "BANK"}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:13, fontWeight:600, margin:0, color:fg }}>
                            {m.type === "card" ? `${m.brand || "Card"} ····${m.last4}` : `${m.bankName || "Bank"} ····${m.last4}`}
                          </p>
                          <p style={{ fontSize:11, color:sub, margin:"2px 0 0" }}>
                            {m.type === "card" ? `Expires ${m.expiryMonth}/${(m.expiryYear||"").toString().slice(-2)}` : (m.accountType || "account")}
                            {m.default ? " · default" : ""}
                          </p>
                        </div>
                        <div style={{ width:18, height:18, borderRadius:"50%", border:`2px solid ${sel ? brandColor : brd}`, background:sel ? brandColor : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          {sel && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                      </button>
                    );
                  })}
                  <button onClick={() => { setPayModal(null); setTab("profile"); setShowAddCard(true); }}
                    style={{ padding:"9px 0", background:"transparent", border:`1px dashed ${brd}`, borderRadius:9, fontSize:12, color:sub, cursor:"pointer", fontFamily:"inherit" }}>
                    + Add a different payment method
                  </button>
                </div>
              )}

              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => !paying && setPayModal(null)}
                  style={{ flex:1, padding:"12px 0", background:"none", border:`1px solid ${brd}`, borderRadius:11, fontSize:13, fontWeight:600, color:fg, cursor:"pointer" }}>
                  Cancel
                </button>
                <button disabled={paying || needsMethod} onClick={async () => {
                    setPaying(true);
                    try {
                      const sb = sbRef.current;
                      if (sb) {
                        const paidAt = new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
                        await sb.rpc("pay_client_invoice", {
                          p_project_id:    Number(projectId),
                          p_invoice_id:    payModal.id,
                          p_paid_at:       paidAt,
                          p_owner_user_id: ownerUserIdRef.current || null,
                        });
                      }
                      setPayDone(prev => ({ ...prev, [payModal.id]: true }));
                      setPayModal(null);
                    } catch(err) {
                      // optimistic local update on RPC failure (demo mode tolerates this)
                      setPayDone(prev => ({...prev,[payModal.id]:true}));
                      setPayModal(null);
                    } finally { setPaying(false); }
                  }}
                  style={{ flex:2, padding:"12px 0", background:(paying||needsMethod)?"#ccc":brandColor, color:"#fff", border:"none", borderRadius:11, fontSize:13, fontWeight:700, cursor:(paying||needsMethod)?"not-allowed":"pointer", transition:"background .2s" }}>
                  {paying ? "Processing…" : needsMethod ? "Add a payment method first" : `Pay $${Number(payModal.total || 0).toLocaleString()}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Messages tab ── */}
      {tab === "messages" && (() => {
        // ── Shared chat: merge messages from ALL legacy threads in time order ──
        // The photographer + every project contact post into a single conversation.
        // Older deployments stored separate threads per contact; we read all of them
        // here and sort by timestamp so nothing is lost. New sends always go to
        // thread "default".
        const collectedMsgs = [];
        for (const t of Object.values(threads || {})) {
          if (Array.isArray(t?.messages)) collectedMsgs.push(...t.messages);
        }
        if (collectedMsgs.length === 0 && Array.isArray(msgs)) collectedMsgs.push(...msgs);
        // Stable sort by ts (fall back to insertion order for missing ts).
        collectedMsgs.sort((a, b) => {
          const ta = a?.ts ? new Date(a.ts).getTime() : 0;
          const tb = b?.ts ? new Date(b.ts).getTime() : 0;
          return ta - tb;
        });
        const allMsgs = collectedMsgs;

        const meSlug = identity?.slug || "";
        const isMine = (m) => m.from === "client" && slugify(m.senderName || "") === meSlug && meSlug !== "";

        const msgBg = dark ? "#1c1c1e" : "#fff";
        const bubbleMe    = "#007AFF";
        const bubbleThem  = dark ? "#3a3a3c" : "#E9E9EB";
        const textMe   = "#fff";
        const textThem = dark ? "#fff" : "#000";
        // Group consecutive messages from the same sender (using senderName + from
        // pair) so name/avatar only appear once per run.
        const senderKey = (m) => `${m?.from||""}|${slugify(m?.senderName||"")}`;
        const grouped = allMsgs.reduce((acc, m, i) => {
          const prev = allMsgs[i-1]; const next = allMsgs[i+1];
          return [...acc, { ...m, isFirst: !prev || senderKey(prev) !== senderKey(m), isLast: !next || senderKey(next) !== senderKey(m) }];
        }, []);
        // List of contacts as picker options.
        const pickerContacts = (() => {
          const list = (project?.contacts || []).filter(c => c && c.name);
          if (project?.client && !list.find(c => slugify(c.name) === slugify(project.client))) {
            list.unshift({ id:"primary", name: project.client, role:"Client" });
          }
          return list;
        })();
        return (
          <div style={{ maxWidth:600, margin:"0 auto", display:"flex", flexDirection:"column", height:"calc(100vh - 57px)" }}>
            {/* Sub-tab switcher: Project chat (everyone) vs General chat (1:1) */}
            <div style={{ display:"flex", gap:6, padding:"10px 16px 0", flexShrink:0 }}>
              {[["project","Project chat"],["general","General chat"]].map(([id, lbl]) => (
                <button key={id} onClick={() => setMessagesSubTab(id)}
                  style={{ flex:1, padding:"8px 0", background: messagesSubTab===id ? brandColor : (dark?"rgba(255,255,255,.06)":"#fff"), color: messagesSubTab===id ? "#fff" : fg, border:`1px solid ${messagesSubTab===id?brandColor:brd}`, borderRadius:10, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                  {lbl}
                </button>
              ))}
            </div>
          {messagesSubTab === "project" && (<>
            {/* Header */}
            <div style={{ padding:"14px 20px", borderBottom:`1px solid ${brd}`, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, background:bg, flexShrink:0 }}>
              <div>
                <p style={{ fontSize:14, fontWeight:600, color:fg, margin:0 }}>Project Chat</p>
                <p style={{ fontSize:11, color:sub, margin:"2px 0 0" }}>{studioName} · everyone in the project</p>
              </div>
              <button onClick={() => { setPickerNameDraft(identity?.name || ""); setIdentityPickerOpen(true); }}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 10px", border:`1px solid ${brd}`, borderRadius:10, background:dark?"rgba(255,255,255,.06)":"#fff", cursor:"pointer", fontFamily:"inherit" }}>
                {identity ? (
                  <>
                    <span style={{ width:22, height:22, borderRadius:"50%", background:colorForName(identity.name), color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700 }}>{initials(identity.name)}</span>
                    <span style={{ fontSize:12, color:fg, fontWeight:600 }}>You're {identity.name}</span>
                    <span style={{ fontSize:10, color:sub }}>change</span>
                  </>
                ) : (
                  <span style={{ fontSize:12, color:fg, fontWeight:600 }}>Who are you?</span>
                )}
              </button>
            </div>
            {/* Messages */}
            <div style={{ flex:1, overflowY:"auto", padding:"12px 16px", background:msgBg, display:"flex", flexDirection:"column", gap:1 }}>
              {allMsgs.length === 0 && (
                <div style={{ textAlign:"center", padding:"60px 0", color:sub }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>💬</div>
                  <p style={{ fontSize:14, fontWeight:600, color:fg, margin:"0 0 6px" }}>No messages yet</p>
                  <p style={{ fontSize:13, color:sub, margin:0 }}>Be the first to say hello.</p>
                </div>
              )}
              {grouped.map((m, i) => {
                const fromPhotographer = m.from !== "client";
                const mine = isMine(m);
                const senderDisplay = fromPhotographer ? (m.senderName || studioName) : (m.senderName || "Guest");
                const senderColor = fromPhotographer ? "#636366" : colorForName(senderDisplay);
                const showAvatar = !mine && m.isLast;
                const showName   = !mine && m.isFirst;
                const timeStr = m.ts ? new Date(m.ts).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : (m.time||"");
                const br = { tl:18, tr:18, bl:18, br:18 };
                if (mine) br.br = m.isLast ? 4 : 18;
                else      br.bl = m.isLast ? 4 : 18;
                return (
                  <div key={m.id||i}>
                    {showName && (
                      <p style={{ fontSize:11, color:senderColor, fontWeight:700, margin:"10px 0 3px 46px" }}>
                        {senderDisplay}{fromPhotographer ? " · Photographer" : ""}
                      </p>
                    )}
                    <div style={{ display:"flex", alignItems:"flex-end", gap:6, justifyContent:mine?"flex-end":"flex-start", marginBottom:1 }}>
                      <div style={{ width:32, flexShrink:0, visibility:!mine?"visible":"hidden" }}>
                        {showAvatar && (
                          <div style={{ width:32, height:32, borderRadius:"50%", background:senderColor, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700 }}>
                            {initials(senderDisplay)}
                          </div>
                        )}
                      </div>
                      <div style={{ maxWidth:"72%", padding:"10px 14px", fontSize:14, lineHeight:1.5,
                        borderRadius:`${br.tl}px ${br.tr}px ${br.br}px ${br.bl}px`,
                        background: mine ? bubbleMe : bubbleThem,
                        color: mine ? textMe : textThem,
                      }}>
                        {m.text}
                      </div>
                      {mine && <div style={{ width:32, flexShrink:0 }}/>}
                    </div>
                    {m.isLast && (
                      <p style={{ fontSize:10, color:sub, margin:"2px 0 8px", textAlign:mine?"right":"left", paddingRight:mine?38:0, paddingLeft:mine?0:46 }}>
                        {senderDisplay}{mine ? " (you)" : ""} · {timeStr}
                      </p>
                    )}
                  </div>
                );
              })}
              <div ref={msgEndRef}/>
            </div>
            {/* Compose */}
            <div style={{ padding:"10px 16px 16px", borderTop:`1px solid ${brd}`, background:bg, flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ flex:1, display:"flex", alignItems:"center", background:dark?"#2c2c2e":"#fff", border:`1.5px solid ${dark?"#3a3a3c":"#c7c7cc"}`, borderRadius:22, padding:"9px 16px" }}>
                  <input value={msgDraft} onChange={e=>setMsgDraft(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMsg();}}}
                    disabled={msgSending}
                    placeholder="iMessage"
                    style={{ flex:1, background:"transparent", border:"none", fontSize:14, color:fg, outline:"none", fontFamily:"inherit" }}/>
                </div>
                <button onClick={sendMsg} disabled={!msgDraft.trim()||msgSending}
                  style={{ width:36, height:36, borderRadius:"50%", background:msgDraft.trim()&&!msgSending?"#007AFF":"#c7c7cc", border:"none", cursor:msgDraft.trim()&&!msgSending?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", transition:"background .15s", flexShrink:0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                </button>
              </div>
              {msgSent && <p style={{ fontSize:11, color:C.green, marginTop:6, textAlign:"center" }}>✓ Delivered</p>}
            </div>
          </>)}
          {messagesSubTab === "general" && (() => {
            // ── General (1:1) chat header + messages + compose ──
            const gMsgs = generalMsgs || [];
            const senderKey2 = (m) => `${m?.from||""}|${slugify(m?.senderName||"")}`;
            const groupedG = gMsgs.reduce((acc, m, i) => {
              const prev = gMsgs[i-1]; const next = gMsgs[i+1];
              return [...acc, { ...m, isFirst: !prev || senderKey2(prev) !== senderKey2(m), isLast: !next || senderKey2(next) !== senderKey2(m) }];
            }, []);
            return (
              <>
                <div style={{ padding:"14px 20px", borderBottom:`1px solid ${brd}`, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, background:bg, flexShrink:0 }}>
                  <div>
                    <p style={{ fontSize:14, fontWeight:600, color:fg, margin:0 }}>General Chat</p>
                    <p style={{ fontSize:11, color:sub, margin:"2px 0 0" }}>Private with {studioName} · not tied to any project</p>
                  </div>
                  {identity && (
                    <span style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 10px", border:`1px solid ${brd}`, borderRadius:10, background:dark?"rgba(255,255,255,.06)":"#fff" }}>
                      <span style={{ width:22, height:22, borderRadius:"50%", background:colorForName(identity.name), color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700 }}>{initials(identity.name)}</span>
                      <span style={{ fontSize:12, color:fg, fontWeight:600 }}>{identity.name}</span>
                    </span>
                  )}
                </div>
                <div style={{ flex:1, overflowY:"auto", padding:"12px 16px", background:msgBg, display:"flex", flexDirection:"column", gap:1 }}>
                  {!identity && (
                    <div style={{ textAlign:"center", padding:"60px 20px", color:sub }}>
                      <div style={{ fontSize:36, marginBottom:8 }}>👤</div>
                      <p style={{ fontSize:13, fontWeight:600, color:fg, margin:"0 0 6px" }}>Who are you?</p>
                      <p style={{ fontSize:12, color:sub, margin:"0 0 14px" }}>Pick your identity to start a private chat with {studioName}.</p>
                      <button onClick={() => setIdentityPickerOpen(true)} style={{ padding:"9px 18px", background:brandColor, color:"#fff", border:"none", borderRadius:10, fontSize:12, fontWeight:600, cursor:"pointer" }}>Pick your name</button>
                    </div>
                  )}
                  {identity && groupedG.length === 0 && (
                    <div style={{ textAlign:"center", padding:"60px 0", color:sub }}>
                      <div style={{ fontSize:40, marginBottom:12 }}>💬</div>
                      <p style={{ fontSize:14, fontWeight:600, color:fg, margin:"0 0 6px" }}>No messages yet</p>
                      <p style={{ fontSize:13, color:sub, margin:0 }}>Say something privately to {studioName}.</p>
                    </div>
                  )}
                  {groupedG.map((m, i) => {
                    const fromPhotographer = m.from !== "client";
                    const mine = !fromPhotographer && identity && slugify(m.senderName||"") === identity.slug;
                    const senderDisplay = fromPhotographer ? (m.senderName || studioName) : (m.senderName || identity?.name || "You");
                    const senderColor = fromPhotographer ? "#636366" : colorForName(senderDisplay);
                    const showName = !mine && m.isFirst;
                    const timeStr = m.ts ? new Date(m.ts).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : (m.time||"");
                    const br = { tl:18, tr:18, bl:18, br:18 };
                    if (mine) br.br = m.isLast ? 4 : 18; else br.bl = m.isLast ? 4 : 18;
                    return (
                      <div key={m.id||i}>
                        {showName && (
                          <p style={{ fontSize:11, color:senderColor, fontWeight:700, margin:"10px 0 3px 6px" }}>
                            {senderDisplay}{fromPhotographer ? " · Photographer" : ""}
                          </p>
                        )}
                        <div style={{ display:"flex", justifyContent:mine?"flex-end":"flex-start", marginBottom:1 }}>
                          <div style={{ maxWidth:"72%", padding:"10px 14px", fontSize:14, lineHeight:1.5,
                            borderRadius:`${br.tl}px ${br.tr}px ${br.br}px ${br.bl}px`,
                            background: mine ? bubbleMe : bubbleThem, color: mine ? textMe : textThem }}>
                            {m.text}
                          </div>
                        </div>
                        {m.isLast && (
                          <p style={{ fontSize:10, color:sub, margin:"2px 0 8px", textAlign:mine?"right":"left" }}>
                            {senderDisplay}{mine ? " (you)" : ""} · {timeStr}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding:"10px 16px 16px", borderTop:`1px solid ${brd}`, background:bg, flexShrink:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ flex:1, display:"flex", alignItems:"center", background:dark?"#2c2c2e":"#fff", border:`1.5px solid ${dark?"#3a3a3c":"#c7c7cc"}`, borderRadius:22, padding:"9px 16px" }}>
                      <input value={generalDraft} onChange={e=>setGeneralDraft(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendGeneralMsg();}}}
                        disabled={!identity || generalSending}
                        placeholder={identity ? `Message ${studioName} privately…` : "Pick your name to chat"}
                        style={{ flex:1, background:"transparent", border:"none", fontSize:14, color:fg, outline:"none", fontFamily:"inherit" }}/>
                    </div>
                    <button onClick={sendGeneralMsg} disabled={!generalDraft.trim() || generalSending || !identity}
                      style={{ width:36, height:36, borderRadius:"50%", background:(generalDraft.trim()&&!generalSending&&identity)?brandColor:"#c7c7cc", border:"none", cursor:(generalDraft.trim()&&!generalSending&&identity)?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
          </div>
        );
      })()}

      {/* ── Profile tab ────────────────────────────────────────────────── */}
      {tab === "profile" && (() => {
        // No identity yet → prompt them to identify themselves first.
        if (!identity || !myContact) {
          return (
            <div style={{ maxWidth:520, margin:"0 auto", padding:"60px 24px", textAlign:"center" }}>
              <div style={{ fontSize:40, marginBottom:14 }}>👤</div>
              <h2 style={{ fontSize:20, fontWeight:700, color:fg, margin:"0 0 6px" }}>Who are you?</h2>
              <p style={{ fontSize:13, color:sub, margin:"0 0 18px", lineHeight:1.55 }}>
                Tell us which contact you are so we can load (and save) your profile.
              </p>
              <button onClick={() => setIdentityPickerOpen(true)}
                style={{ padding:"11px 22px", background:brandColor, color:"#fff", border:"none", borderRadius:12, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                Pick your name
              </button>
            </div>
          );
        }
        const methods = (myContact.paymentMethods || []);
        const cards = methods.filter(m => m.type === "card");
        const banks = methods.filter(m => m.type === "bank");
        return (
          <div style={{ maxWidth:680, margin:"0 auto", padding:"32px 24px", display:"flex", flexDirection:"column", gap:24 }}>
            {/* Demo banner */}
            <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 14px", background:dark?"rgba(255,193,7,.1)":"#fff8e1", border:`1px solid ${dark?"rgba(255,193,7,.3)":"#ffe082"}`, borderRadius:10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b07a30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, marginTop:1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div>
                <p style={{ fontSize:12, fontWeight:700, color:"#8a5a1a", margin:"0 0 2px" }}>Demo mode — no real charges</p>
                <p style={{ fontSize:11, color:dark?"rgba(255,193,7,.85)":"#8a6a3a", margin:0, lineHeight:1.5 }}>
                  Cards and bank accounts saved here are for testing the experience only. Card numbers are never stored — we keep just the last 4 digits and brand for display.
                </p>
              </div>
            </div>

            {/* Personal info */}
            <section style={{ background:dark?"rgba(255,255,255,.04)":"#fff", border:`1px solid ${brd}`, borderRadius:14, padding:"20px 22px" }}>
              <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:14 }}>
                <h3 style={{ fontSize:15, fontWeight:700, color:fg, margin:0 }}>Your information</h3>
                {profileSaved && <span style={{ fontSize:11, color:C.green, fontWeight:600 }}>✓ Saved</span>}
              </div>
              {profileForm && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  {[
                    ["name","Name","text"],
                    ["email","Email","email"],
                    ["phone","Phone","tel"],
                  ].map(([k,label,type]) => (
                    <label key={k} style={{ display:"flex", flexDirection:"column", gap:4, gridColumn:k==="name"?"1 / -1":"auto" }}>
                      <span style={{ fontSize:11, color:sub, fontWeight:600, textTransform:"uppercase", letterSpacing:.6 }}>{label}</span>
                      <input type={type} value={profileForm[k] || ""} onChange={e => setProfileForm(f => ({...f, [k]: e.target.value}))}
                        onBlur={saveProfileForm}
                        style={{ padding:"10px 12px", border:`1px solid ${brd}`, borderRadius:9, background:dark?"rgba(255,255,255,.05)":"#fff", color:fg, fontSize:13, outline:"none", fontFamily:"inherit" }}/>
                    </label>
                  ))}
                  <label style={{ display:"flex", flexDirection:"column", gap:4, gridColumn:"1 / -1" }}>
                    <span style={{ fontSize:11, color:sub, fontWeight:600, textTransform:"uppercase", letterSpacing:.6 }}>Address line</span>
                    <input value={profileForm.address?.line1 || ""} onChange={e => setProfileForm(f => ({...f, address: {...f.address, line1: e.target.value}}))}
                      onBlur={saveProfileForm}
                      style={{ padding:"10px 12px", border:`1px solid ${brd}`, borderRadius:9, background:dark?"rgba(255,255,255,.05)":"#fff", color:fg, fontSize:13, outline:"none", fontFamily:"inherit" }}/>
                  </label>
                  <label style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    <span style={{ fontSize:11, color:sub, fontWeight:600, textTransform:"uppercase", letterSpacing:.6 }}>City</span>
                    <input value={profileForm.address?.city || ""} onChange={e => setProfileForm(f => ({...f, address: {...f.address, city: e.target.value}}))}
                      onBlur={saveProfileForm}
                      style={{ padding:"10px 12px", border:`1px solid ${brd}`, borderRadius:9, background:dark?"rgba(255,255,255,.05)":"#fff", color:fg, fontSize:13, outline:"none", fontFamily:"inherit" }}/>
                  </label>
                  <div style={{ display:"flex", gap:8 }}>
                    <label style={{ display:"flex", flexDirection:"column", gap:4, flex:1 }}>
                      <span style={{ fontSize:11, color:sub, fontWeight:600, textTransform:"uppercase", letterSpacing:.6 }}>State</span>
                      <input value={profileForm.address?.state || ""} onChange={e => setProfileForm(f => ({...f, address: {...f.address, state: e.target.value}}))}
                        onBlur={saveProfileForm}
                        style={{ padding:"10px 12px", border:`1px solid ${brd}`, borderRadius:9, background:dark?"rgba(255,255,255,.05)":"#fff", color:fg, fontSize:13, outline:"none", fontFamily:"inherit" }}/>
                    </label>
                    <label style={{ display:"flex", flexDirection:"column", gap:4, flex:1 }}>
                      <span style={{ fontSize:11, color:sub, fontWeight:600, textTransform:"uppercase", letterSpacing:.6 }}>Zip</span>
                      <input value={profileForm.address?.zip || ""} onChange={e => setProfileForm(f => ({...f, address: {...f.address, zip: e.target.value}}))}
                        onBlur={saveProfileForm}
                        style={{ padding:"10px 12px", border:`1px solid ${brd}`, borderRadius:9, background:dark?"rgba(255,255,255,.05)":"#fff", color:fg, fontSize:13, outline:"none", fontFamily:"inherit" }}/>
                    </label>
                  </div>
                </div>
              )}
              <p style={{ fontSize:11, color:sub, margin:"12px 0 0" }}>Changes save automatically when you click out of a field{profileSaving ? " · saving…" : ""}.</p>
            </section>

            {/* Saved payment methods */}
            <section style={{ background:dark?"rgba(255,255,255,.04)":"#fff", border:`1px solid ${brd}`, borderRadius:14, padding:"20px 22px" }}>
              <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:14 }}>
                <h3 style={{ fontSize:15, fontWeight:700, color:fg, margin:0 }}>Payment methods</h3>
                <span style={{ fontSize:11, color:sub }}>{methods.length} saved</span>
              </div>
              {methods.length === 0 ? (
                <div style={{ textAlign:"center", padding:"28px 0", border:`1px dashed ${brd}`, borderRadius:10, marginBottom:14 }}>
                  <p style={{ fontSize:13, color:sub, margin:0 }}>No saved methods yet — add one below to pay invoices faster.</p>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:14 }}>
                  {methods.map(m => (
                    <div key={m.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px", background:dark?"rgba(255,255,255,.06)":"#fafafa", border:`1px solid ${brd}`, borderRadius:11 }}>
                      <div style={{ width:42, height:30, borderRadius:6, background:m.type==="card"?"#0a0a0a":"#2d5a45", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, letterSpacing:.5, flexShrink:0 }}>
                        {m.type === "card" ? (m.brand || "CARD").toUpperCase().slice(0,5) : "BANK"}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:13, fontWeight:600, color:fg, margin:0 }}>
                          {m.type === "card"
                            ? `${m.brand || "Card"} ending in ${m.last4}`
                            : `${m.bankName || "Bank"} · ${m.accountType || "account"} ending in ${m.last4}`}
                          {m.default && <span style={{ marginLeft:8, fontSize:10, color:C.green, fontWeight:700, padding:"2px 7px", background:"rgba(74,122,87,.12)", borderRadius:99 }}>DEFAULT</span>}
                        </p>
                        <p style={{ fontSize:11, color:sub, margin:"2px 0 0" }}>
                          {m.type === "card"
                            ? `Expires ${m.expiryMonth}/${(m.expiryYear||"").toString().slice(-2)} · ${m.cardholder || ""}`
                            : `Held by ${m.accountHolder || ""}`}
                        </p>
                      </div>
                      <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                        {!m.default && (
                          <button onClick={() => setDefaultMethod(m.id)} disabled={profileSaving}
                            style={{ padding:"6px 10px", background:"transparent", border:`1px solid ${brd}`, borderRadius:8, fontSize:11, cursor:"pointer", color:fg, fontFamily:"inherit" }}>
                            Make default
                          </button>
                        )}
                        <button onClick={() => removePaymentMethod(m.id)} disabled={profileSaving}
                          style={{ padding:"6px 10px", background:"transparent", border:`1px solid ${brd}`, borderRadius:8, fontSize:11, cursor:"pointer", color:"#c25450", fontFamily:"inherit" }}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => { setShowAddCard(true); setPmError(null); }}
                  style={{ flex:1, padding:"11px 14px", background:brandColor, color:"#fff", border:"none", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                  + Add credit/debit card
                </button>
                <button onClick={() => { setShowAddBank(true); setPmError(null); }}
                  style={{ flex:1, padding:"11px 14px", background:dark?"rgba(255,255,255,.08)":"#fff", border:`1px solid ${brd}`, color:fg, borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                  + Add bank account
                </button>
              </div>
            </section>
          </div>
        );
      })()}

      {/* ── Add card modal ─────────────────────────────────────────────── */}
      {showAddCard && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1100, padding:24 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddCard(false); }}>
          <div style={{ background:"#fff", borderRadius:18, padding:"28px 26px", maxWidth:420, width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,.25)" }}>
            <h3 style={{ fontSize:18, fontWeight:700, color:C.ink, margin:"0 0 6px" }}>Add a card</h3>
            <p style={{ fontSize:12, color:C.muted, margin:"0 0 16px", lineHeight:1.5 }}>Demo mode — only the last 4 digits and brand are saved. Card numbers are never transmitted.</p>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <input placeholder="Cardholder name" value={cardDraft.cardholder}
                onChange={e => setCardDraft(d => ({...d, cardholder: e.target.value}))}
                style={{ padding:"11px 13px", border:`1px solid ${C.border}`, borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit" }}/>
              <div style={{ position:"relative" }}>
                <input placeholder="Card number" value={formatCardNumber(cardDraft.number)} inputMode="numeric"
                  onChange={e => setCardDraft(d => ({...d, number: e.target.value.replace(/\D/g,"")}))}
                  style={{ width:"100%", padding:"11px 13px", border:`1px solid ${C.border}`, borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box", letterSpacing:.5 }}/>
                {cardDraft.number.length >= 4 && (
                  <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", fontSize:10, fontWeight:700, color:C.muted, letterSpacing:.5 }}>{cardBrand(cardDraft.number).toUpperCase()}</span>
                )}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <input placeholder="MM" maxLength={2} inputMode="numeric" value={cardDraft.expiryMonth}
                  onChange={e => setCardDraft(d => ({...d, expiryMonth: e.target.value.replace(/\D/g,"").slice(0,2)}))}
                  style={{ flex:1, padding:"11px 13px", border:`1px solid ${C.border}`, borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit", textAlign:"center" }}/>
                <input placeholder="YYYY" maxLength={4} inputMode="numeric" value={cardDraft.expiryYear}
                  onChange={e => setCardDraft(d => ({...d, expiryYear: e.target.value.replace(/\D/g,"").slice(0,4)}))}
                  style={{ flex:1, padding:"11px 13px", border:`1px solid ${C.border}`, borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit", textAlign:"center" }}/>
                <input placeholder="CVC" maxLength={4} inputMode="numeric" value={cardDraft.cvc}
                  onChange={e => setCardDraft(d => ({...d, cvc: e.target.value.replace(/\D/g,"").slice(0,4)}))}
                  style={{ flex:1, padding:"11px 13px", border:`1px solid ${C.border}`, borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit", textAlign:"center" }}/>
              </div>
              {pmError && <p style={{ fontSize:12, color:"#c25450", margin:"4px 0 0" }}>{pmError}</p>}
              <div style={{ display:"flex", gap:8, marginTop:6 }}>
                <button onClick={() => setShowAddCard(false)}
                  style={{ flex:1, padding:"11px 0", background:"transparent", border:`1px solid ${C.border}`, borderRadius:10, fontSize:13, fontWeight:600, color:C.ink, cursor:"pointer" }}>Cancel</button>
                <button onClick={submitCard} disabled={profileSaving}
                  style={{ flex:2, padding:"11px 0", background:profileSaving?"#ccc":C.ink, color:"#fff", border:"none", borderRadius:10, fontSize:13, fontWeight:700, cursor:profileSaving?"default":"pointer" }}>
                  {profileSaving ? "Saving…" : "Save card"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add bank modal ─────────────────────────────────────────────── */}
      {showAddBank && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1100, padding:24 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddBank(false); }}>
          <div style={{ background:"#fff", borderRadius:18, padding:"28px 26px", maxWidth:420, width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,.25)" }}>
            <h3 style={{ fontSize:18, fontWeight:700, color:C.ink, margin:"0 0 6px" }}>Add a bank account</h3>
            <p style={{ fontSize:12, color:C.muted, margin:"0 0 16px", lineHeight:1.5 }}>Demo mode — only the last 4 digits of the account are saved.</p>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <input placeholder="Account holder name" value={bankDraft.accountHolder}
                onChange={e => setBankDraft(d => ({...d, accountHolder: e.target.value}))}
                style={{ padding:"11px 13px", border:`1px solid ${C.border}`, borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit" }}/>
              <input placeholder="Routing number (9 digits)" inputMode="numeric" value={bankDraft.routing}
                onChange={e => setBankDraft(d => ({...d, routing: e.target.value.replace(/\D/g,"").slice(0,9)}))}
                style={{ padding:"11px 13px", border:`1px solid ${C.border}`, borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit", letterSpacing:.5 }}/>
              <input placeholder="Account number" inputMode="numeric" value={bankDraft.account}
                onChange={e => setBankDraft(d => ({...d, account: e.target.value.replace(/\D/g,"").slice(0,17)}))}
                style={{ padding:"11px 13px", border:`1px solid ${C.border}`, borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit", letterSpacing:.5 }}/>
              <select value={bankDraft.accountType}
                onChange={e => setBankDraft(d => ({...d, accountType: e.target.value}))}
                style={{ padding:"11px 13px", border:`1px solid ${C.border}`, borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit", background:"#fff" }}>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
              {pmError && <p style={{ fontSize:12, color:"#c25450", margin:"4px 0 0" }}>{pmError}</p>}
              <div style={{ display:"flex", gap:8, marginTop:6 }}>
                <button onClick={() => setShowAddBank(false)}
                  style={{ flex:1, padding:"11px 0", background:"transparent", border:`1px solid ${C.border}`, borderRadius:10, fontSize:13, fontWeight:600, color:C.ink, cursor:"pointer" }}>Cancel</button>
                <button onClick={submitBank} disabled={profileSaving}
                  style={{ flex:2, padding:"11px 0", background:profileSaving?"#ccc":C.ink, color:"#fff", border:"none", borderRadius:10, fontSize:13, fontWeight:700, cursor:profileSaving?"default":"pointer" }}>
                  {profileSaving ? "Saving…" : "Save account"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Identity picker modal (shared chat) ── */}
      {identityPickerOpen && (() => {
        const list = (() => {
          const l = (project?.contacts || []).filter(c => c && c.name);
          if (project?.client && !l.find(c => slugify(c.name) === slugify(project.client))) {
            l.unshift({ id:"primary", name: project.client, role:"Client" });
          }
          return l;
        })();
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:24 }}
            onClick={(e) => { if (e.target === e.currentTarget && identity) setIdentityPickerOpen(false); }}>
            <div style={{ background:"#fff", borderRadius:18, padding:"28px 26px", maxWidth:380, width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,.25)" }}>
              <h3 style={{ fontSize:18, fontWeight:700, color:C.ink, margin:"0 0 6px" }}>Who's chatting?</h3>
              <p style={{ fontSize:13, color:C.muted, margin:"0 0 18px", lineHeight:1.5 }}>
                Pick your name so {studioName} and the rest of the project know who's saying what.
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
                {list.map(c => {
                  const isCurrent = identity && slugify(identity.name) === slugify(c.name);
                  return (
                    <button key={c.id || c.name} onClick={() => confirmIdentity(c.name)}
                      style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", border:`1.5px solid ${isCurrent?"#007AFF":C.border}`, borderRadius:12, background:isCurrent?"#f0f6ff":"#fff", cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
                      <span style={{ width:30, height:30, borderRadius:"50%", background:colorForName(c.name), color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700 }}>{initials(c.name)}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:13, fontWeight:600, color:C.ink, margin:0 }}>{c.name}</p>
                        {c.role && <p style={{ fontSize:11, color:C.muted, margin:"2px 0 0" }}>{c.role}</p>}
                      </div>
                      {isCurrent && <span style={{ fontSize:10, color:"#007AFF", fontWeight:700 }}>YOU</span>}
                    </button>
                  );
                })}
              </div>
              <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
                <p style={{ fontSize:11, color:C.muted, margin:"0 0 6px", textTransform:"uppercase", letterSpacing:1 }}>Not on the list?</p>
                <div style={{ display:"flex", gap:8 }}>
                  <input value={pickerNameDraft} onChange={e => setPickerNameDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && pickerNameDraft.trim()) confirmIdentity(pickerNameDraft.trim()); }}
                    placeholder="Your name"
                    style={{ flex:1, padding:"10px 12px", border:`1px solid ${C.border}`, borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit" }}/>
                  <button onClick={() => pickerNameDraft.trim() && confirmIdentity(pickerNameDraft.trim())}
                    disabled={!pickerNameDraft.trim()}
                    style={{ padding:"10px 16px", background: pickerNameDraft.trim()?C.ink:"#ccc", color:"#fff", border:"none", borderRadius:10, fontSize:13, fontWeight:600, cursor: pickerNameDraft.trim()?"pointer":"default" }}>
                    Continue
                  </button>
                </div>
              </div>
              {identity && (
                <button onClick={() => setIdentityPickerOpen(false)}
                  style={{ width:"100%", marginTop:14, padding:"8px 0", background:"none", border:"none", color:C.muted, fontSize:11, cursor:"pointer" }}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Lightbox ── */}
      {lightbox !== null && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.92)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 }} onClick={() => setLightbox(null)}>
          <button onClick={e => { e.stopPropagation(); setLightbox(prev => (prev-1+photos.length)%photos.length); }}
            style={{ position:"absolute", left:20, width:44, height:44, borderRadius:12, background:"rgba(255,255,255,.15)", border:"none", cursor:"pointer", color:"#fff", fontSize:22, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth:"90vw", maxHeight:"90vh" }}>
            {(() => { const ph=photos[lightbox]; const src=typeof ph==="string"?ph:ph?.url; const isVid=ph?.type==="video"||/\.(mp4|mov|webm)(\?|$)/i.test(src||""); return isVid?<video src={src} controls autoPlay style={{ maxWidth:"88vw", maxHeight:"85vh", borderRadius:4 }}/>:<img src={src} alt="" style={{ maxWidth:"88vw", maxHeight:"85vh", objectFit:"contain", borderRadius:4, display:"block" }}/>; })()}
            <p style={{ color:"rgba(255,255,255,.7)", fontSize:12, textAlign:"center", marginTop:10 }}>{lightbox+1} / {photos.length}</p>
          </div>
          <button onClick={e => { e.stopPropagation(); setLightbox(prev => (prev+1)%photos.length); }}
            style={{ position:"absolute", right:20, width:44, height:44, borderRadius:12, background:"rgba(255,255,255,.15)", border:"none", cursor:"pointer", color:"#fff", fontSize:22, display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ borderTop:`1px solid ${brd}`, padding:"20px 24px", textAlign:"center", marginTop:40 }}>
        <p style={{ fontSize:11, color:sub, margin:0 }}>Delivered by {studioName} · Powered by FrameFlow</p>
      </div>
    </div>
  );
}
