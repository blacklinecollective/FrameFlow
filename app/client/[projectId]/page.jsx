"use client";
import { useState, useEffect, useRef, useCallback } from "react";

const SUPABASE_URL  = "https://czmzxwtnzyguhbmivizq.supabase.co";
const SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bXp4d3RuenlndWhibWl2aXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODMwNTksImV4cCI6MjA5MjQ1OTA1OX0.8BFEhkHdCx0PgZ8SuySMlWk68AtMtcvT3sSsxj88wJo";

const C = {
  ink: "#1a1a1a", muted: "#888", border: "#e8e4df",
  warm: "#f5f2ee", cream: "#faf9f7", green: "#4a7a57", accent: "#c4974a",
};

const fmt = s => `${Math.floor((s||0)/60)}:${String(Math.floor((s||0)%60)).padStart(2,"0")}`;

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
function VideoReviewTab({ projectId, project, videoDeliverables, videoComments: initComments, brandColor, dark, fg, sub, brd, bg, studioName }) {
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
        p_project_id: Number(projectId),
        p_version_id: selVerId,
        p_comment:    comment,
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
                    {latest.url && (
                      <button onClick={e => { e.stopPropagation(); downloadVideo(latest.url, `${del.title || "video"}.mp4`); }}
                        title="Download video"
                        style={{ width:34, height:34, borderRadius:8, background:dark?"rgba(255,255,255,.1)":C.warm, border:`1px solid ${brd}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                      </button>
                    )}
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
        {selVer?.url && (
          <button onClick={() => downloadVideo(selVer.url, `${selDel.title || "video"} - ${selVer.label || "video"}.mp4`)}
            title="Download this version"
            style={{ padding:"5px 12px", borderRadius:8, border:`1px solid ${brd}`, background:dark?"rgba(255,255,255,.06)":"#fff", color:sub, fontSize:11, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download
          </button>
        )}
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
  const sbRef = useRef(null);
  const msgEndRef = useRef(null);

  useEffect(() => {
    if (!projectId || isNaN(projectId)) { setNotFound(true); setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
        sbRef.current = sb;
        const { data: result, error } = await sb.rpc("get_client_portal_data", { p_project_id: projectId });
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
        const { data: result } = await sb.rpc("get_client_portal_data", { p_project_id: Number(projectId) });
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

  const { delivery = {}, project = {}, photos: rawPhotos, brandKit = {}, invoices = [], videoDeliverables: rawVids, videoComments: rawCmts } = data || {};
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

  // ── Send message to photographer ────────────────────────────────────────────
  const sendMsg = async () => {
    const text = msgDraft.trim();
    if (!text || msgSending) return;
    setMsgSending(true);
    const tid = selThreadId || "default";
    const msg = {
      id:         "msg_" + Date.now(),
      from:       "client",
      senderName: project?.client || "Client",
      text,
      ts:         new Date().toISOString(),
    };
    setThreads(prev => {
      const prevThread = prev[tid] || { id: tid, contactName: project?.client||"Client", messages: [] };
      return { ...prev, [tid]: { ...prevThread, messages: [...prevThread.messages, msg] } };
    });
    setMsgDraft("");
    try {
      const sb = sbRef.current;
      if (sb) {
        await sb.rpc("send_client_message", {
          p_project_id:   Number(projectId),
          p_message:      msg,
          p_thread_id:    tid,
          p_contact_name: threads[tid]?.contactName || project?.client || "Client",
        });
        setMsgSent(true);
        setTimeout(() => setMsgSent(false), 3000);
      }
    } catch (_) {}
    setMsgSending(false);
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
      {tab === "gallery" && (
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>
          <div style={{ textAlign:"center", marginBottom:36 }}>
            <p style={{ fontSize:12, color:sub, textTransform:"uppercase", letterSpacing:3, margin:"0 0 10px" }}>{project.type} · {new Date().toLocaleDateString("en-US",{year:"numeric",month:"long"})}</p>
            <h1 style={{ fontFamily:"'Cormorant Garamond', Georgia, serif", fontSize:36, fontWeight:500, color:fg, margin:"0 0 12px", letterSpacing:-.5 }}>
              {delivery.galleryTitle || (project.name ? `${project.name} — Your Gallery` : "Your Gallery")}
            </h1>
            {delivery.message && <p style={{ fontSize:14, color:sub, maxWidth:540, margin:"0 auto 24px", lineHeight:1.7 }}>{delivery.message}</p>}
            {photos.length > 0 && (
              <button onClick={downloadAllPhotos} disabled={!!dlProgress}
                style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"11px 24px", background:dlProgress?"#a0a0a0":brandColor, color:"#fff", borderRadius:12, fontSize:13, fontWeight:600, cursor:dlProgress?"not-allowed":"pointer", border:"none", transition:"background .15s" }}>
                {dlProgress
                  ? (dlProgress.done === dlProgress.total
                      ? `✓ Downloaded all ${dlProgress.total} ${dlProgress.total===1?"photo":"photos"}`
                      : `↓ Downloading ${dlProgress.done} / ${dlProgress.total}…`)
                  : `↓ Download All (${photos.length} ${photos.length===1?"photo":"photos"})`}
              </button>
            )}
            {favs.length > 0 && <p style={{ fontSize:12, color:sub, marginTop:10 }}>{favs.length} photo{favs.length!==1?"s":""} hearted</p>}
          </div>
          {photos.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 0", color:sub }}><p style={{ fontSize:16 }}>Your photos will appear here once ready.</p></div>
          ) : (
            <div style={{ columns:3, columnGap:6 }}>
              {photos.map((photo, idx) => (
                <PhotoTile key={idx} photo={photo} isFav={favs.includes(idx)}
                  onFav={() => setFavs(prev => prev.includes(idx)?prev.filter(x=>x!==idx):[...prev,idx])}
                  onClick={() => setLightbox(idx)}
                  onDownload={() => {
                    const url = typeof photo === "string" ? photo : photo?.url;
                    const ext = (url||"").split("?")[0].split(".").pop() || "jpg";
                    const name = photo?.name || `photo-${idx+1}.${ext}`;
                    const isVid = photo?.type === "video" || /\.(mp4|mov|webm)(\?|$)/i.test(url||"");
                    if (isVid) { downloadVideo(url, name); } else { downloadBlob(url, name); }
                  }}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Video Review tab ── */}
      {tab === "video" && (
        <VideoReviewTab
          projectId={projectId}
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
                {checklist.map((item, idx) => (
                  <div key={idx} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px",
                    background:item.checked?(dark?"rgba(74,122,87,.15)":"#edf3ef"):(dark?"rgba(255,255,255,.04)":"#fff"),
                    border:`1px solid ${item.checked?(dark?"rgba(74,122,87,.3)":C.green):brd}`, borderRadius:12 }}>
                    <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${item.checked?C.green:brd}`, background:item.checked?C.green:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {item.checked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:13, fontWeight:600, color:item.checked?C.green:fg, margin:0 }}>{item.text}</p>
                      {item.due && <p style={{ fontSize:11, color:sub, margin:"2px 0 0" }}>Due {item.due}</p>}
                    </div>
                    {item.checked && <span style={{ fontSize:11, color:C.green, fontWeight:600 }}>✓ Done</span>}
                  </div>
                ))}
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

      {/* ── Pay Now modal ── */}
      {payModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:900, padding:24 }}
          onClick={e => { if(e.target===e.currentTarget && !paying) setPayModal(null); }}>
          <div style={{ background:dark?"#1a1a1a":"#fff", borderRadius:20, padding:"36px 32px", maxWidth:420, width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,.25)" }}>
            <h3 style={{ fontSize:20, fontWeight:700, color:fg, margin:"0 0 6px" }}>Confirm Payment</h3>
            <p style={{ fontSize:13, color:sub, margin:"0 0 24px" }}>{payModal.title||payModal.description||"Invoice"}</p>
            <div style={{ background:dark?"rgba(255,255,255,.06)":C.warm, borderRadius:12, padding:"16px 20px", marginBottom:24, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:14, color:sub }}>Amount Due</span>
              <span style={{ fontSize:24, fontWeight:800, color:fg }}>${Number(payModal.total||0).toLocaleString()}</span>
            </div>
            <p style={{ fontSize:12, color:sub, margin:"0 0 20px", lineHeight:1.6, textAlign:"center" }}>
              By confirming, you acknowledge this payment and your photographer will be notified.
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => !paying && setPayModal(null)}
                style={{ flex:1, padding:"13px 0", background:"none", border:`1px solid ${brd}`, borderRadius:12, fontSize:14, fontWeight:600, color:fg, cursor:"pointer" }}>
                Cancel
              </button>
              <button disabled={paying} onClick={async () => {
                  setPaying(true);
                  try {
                    const sb = sbRef.current;
                    if (sb) {
                      const paidAt = new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
                      await sb.rpc("pay_client_invoice", { p_project_id: Number(projectId), p_invoice_id: payModal.id, p_paid_at: paidAt });
                    }
                    setPayDone(prev => ({ ...prev, [payModal.id]: true }));
                    setPayModal(null);
                  } catch(err) { /* silently mark as paid locally even if RPC fails */ setPayDone(prev => ({...prev,[payModal.id]:true})); setPayModal(null); }
                  finally { setPaying(false); }
                }}
                style={{ flex:2, padding:"13px 0", background:paying?"#ccc":brandColor, color:"#fff", border:"none", borderRadius:12, fontSize:14, fontWeight:700, cursor:paying?"not-allowed":"pointer", transition:"background .2s" }}>
                {paying ? "Processing…" : `Confirm Payment`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Messages tab ── */}
      {tab === "messages" && (() => {
        const threadList = Object.values(threads);
        const activeThread = selThreadId ? (threads[selThreadId] || null) : null;
        const activeMsgs = activeThread?.messages || msgs; // fallback to old msgs state
        const clientName  = project?.client || "Client";
        const studioInits = studioName.split(" ").map(w=>w[0]).slice(0,2).join("");
        const clientInits = clientName.split(" ").map(w=>w[0]).slice(0,2).join("");
        const msgBg = dark ? "#1c1c1e" : "#fff";
        const bubbleMe    = "#007AFF";
        const bubbleThem  = dark ? "#3a3a3c" : "#E9E9EB";
        const textMe   = "#fff";
        const textThem = dark ? "#fff" : "#000";
        const grouped = activeMsgs.reduce((acc, m, i) => {
          const prev = activeMsgs[i-1]; const next = activeMsgs[i+1];
          return [...acc, { ...m, isFirst:!prev||prev.from!==m.from, isLast:!next||next.from!==m.from }];
        }, []);
        return (
          <div style={{ maxWidth:600, margin:"0 auto", display:"flex", flexDirection:"column", height:"calc(100vh - 57px)" }}>
            {/* Thread selector — only show if multiple threads */}
            {threadList.length > 1 && (
              <div style={{ padding:"8px 12px", borderBottom:`1px solid ${brd}`, background:bg, display:"flex", gap:6, overflowX:"auto", flexShrink:0 }}>
                {threadList.map(t => (
                  <button key={t.id}
                    onClick={() => setSelThreadId(t.id)}
                    style={{ padding:"5px 12px", borderRadius:16, border:`1.5px solid ${t.id===selThreadId?"#007AFF":brd}`, background:t.id===selThreadId?"#007AFF":"transparent", color:t.id===selThreadId?"#fff":fg, fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit" }}>
                    {t.contactName}
                  </button>
                ))}
              </div>
            )}
            {/* Header */}
            <div style={{ padding:"14px 20px", borderBottom:`1px solid ${brd}`, display:"flex", flexDirection:"column", alignItems:"center", gap:4, background:bg, flexShrink:0 }}>
              <div style={{ width:46, height:46, borderRadius:"50%", background:"linear-gradient(135deg,#636366,#8e8e93)", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, fontWeight:700 }}>
                {studioInits}
              </div>
              <p style={{ fontSize:14, fontWeight:600, color:fg, margin:0 }}>{studioName}</p>
              <p style={{ fontSize:11, color:sub, margin:0 }}>Photographer</p>
            </div>
            {/* Messages */}
            <div style={{ flex:1, overflowY:"auto", padding:"12px 16px", background:msgBg, display:"flex", flexDirection:"column", gap:1 }}>
              {activeMsgs.length === 0 && (
                <div style={{ textAlign:"center", padding:"60px 0", color:sub }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>💬</div>
                  <p style={{ fontSize:14, fontWeight:600, color:fg, margin:"0 0 6px" }}>No messages yet</p>
                  <p style={{ fontSize:13, color:sub, margin:0 }}>Say hello to {studioName}</p>
                </div>
              )}
              {grouped.map((m, i) => {
                const isMe = m.from === "client";
                const showAvatar = !isMe && m.isLast;
                const showName   = !isMe && m.isFirst;
                const timeStr = m.ts ? new Date(m.ts).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : (m.time||"");
                const br = { tl:18, tr:18, bl:18, br:18 };
                if (isMe) br.br = m.isLast ? 4 : 18;
                else       br.bl = m.isLast ? 4 : 18;
                return (
                  <div key={m.id||i}>
                    {showName && <p style={{ fontSize:11, color:sub, margin:"10px 0 3px 46px" }}>{m.senderName || studioName}</p>}
                    <div style={{ display:"flex", alignItems:"flex-end", gap:6, justifyContent:isMe?"flex-end":"flex-start", marginBottom:1 }}>
                      <div style={{ width:32, flexShrink:0, visibility:!isMe?"visible":"hidden" }}>
                        {showAvatar && (
                          <div style={{ width:32, height:32, borderRadius:"50%", background:brandColor, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700 }}>
                            {studioInits}
                          </div>
                        )}
                      </div>
                      <div style={{ maxWidth:"72%", padding:"10px 14px", fontSize:14, lineHeight:1.5,
                        borderRadius:`${br.tl}px ${br.tr}px ${br.br}px ${br.bl}px`,
                        background: isMe ? bubbleMe : bubbleThem,
                        color: isMe ? textMe : textThem,
                      }}>
                        {m.text}
                      </div>
                      {isMe && <div style={{ width:32, flexShrink:0 }}/>}
                    </div>
                    {m.isLast && (
                      <p style={{ fontSize:10, color:sub, margin:"2px 0 8px", textAlign:isMe?"right":"left", paddingRight:isMe?38:0, paddingLeft:isMe?0:46 }}>
                        {isMe ? clientName : (m.senderName || studioName)} · {timeStr}
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
