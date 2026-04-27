"use client";
import { useState, useEffect, useRef } from "react";

// ── Minimal colour tokens ─────────────────────────────
const C = {
  ink: "#1a1a1a", muted: "#888", border: "#e8e4df",
  warm: "#f5f2ee", cream: "#faf9f7", green: "#4a7a57",
};

// ── PIN Gate ──────────────────────────────────────────
function PinGate({ pin, onUnlock }) {
  const [input, setInput] = useState("");
  const [shake,  setShake] = useState(false);

  const attempt = () => {
    if (input === String(pin)) { onUnlock(); return; }
    setShake(true);
    setInput("");
    setTimeout(() => setShake(false), 600);
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.cream, padding:24 }}>
      <div style={{ background:"#fff", borderRadius:20, padding:"40px 36px", maxWidth:360, width:"100%", boxShadow:"0 8px 40px rgba(0,0,0,.08)", textAlign:"center" }}>
        <div style={{ width:56, height:56, borderRadius:16, background:C.warm, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.ink, margin:"0 0 8px" }}>Private Gallery</h2>
        <p style={{ fontSize:13, color:C.muted, margin:"0 0 28px", lineHeight:1.5 }}>Your photographer has protected this gallery with a PIN. Enter it below to view your photos.</p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={input}
          onChange={e => setInput(e.target.value.replace(/\D/g,""))}
          onKeyDown={e => e.key === "Enter" && attempt()}
          placeholder="Enter PIN"
          style={{
            width:"100%", padding:"14px 16px", border:`2px solid ${shake?"#e05a5a":C.border}`,
            borderRadius:12, fontSize:22, letterSpacing:8, fontWeight:700, textAlign:"center",
            color:C.ink, background:C.cream, outline:"none", boxSizing:"border-box",
            transition:"border-color .2s", animation: shake ? "shake .4s ease" : "none",
          }}
        />
        {shake && <p style={{ fontSize:12, color:"#e05a5a", margin:"8px 0 0" }}>Incorrect PIN — try again</p>}
        <button onClick={attempt} style={{ marginTop:16, width:"100%", padding:"13px 0", background:C.ink, color:"#fff", border:"none", borderRadius:12, fontSize:14, fontWeight:700, cursor:"pointer" }}>
          Unlock Gallery
        </button>
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}`}</style>
      </div>
    </div>
  );
}

// ── Photo tile ────────────────────────────────────────
function PhotoTile({ photo, onClick, isFav, onFav }) {
  const src = typeof photo === "string" ? photo : photo?.url;
  const isVid = photo?.type === "video" || /\.(mp4|mov|webm)(\?|$)/i.test(src||"");
  return (
    <div style={{ breakInside:"avoid", marginBottom:6, position:"relative", cursor:"pointer", borderRadius:8, overflow:"hidden" }}
      onClick={onClick}>
      {isVid
        ? <video src={src} muted playsInline preload="metadata" style={{ width:"100%", height:"auto", display:"block" }}/>
        : <img src={src} alt="" style={{ width:"100%", height:"auto", display:"block" }} loading="lazy"/>
      }
      <button onClick={e => { e.stopPropagation(); onFav(); }}
        style={{ position:"absolute", top:7, right:7, width:28, height:28, borderRadius:"50%",
          background: isFav ? "#e87d7d" : "rgba(255,255,255,.85)",
          border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
          backdropFilter:"blur(4px)", transition:"background .15s" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill={isFav?"#fff":"none"} stroke={isFav?"#fff":"#888"} strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>
    </div>
  );
}

// ── Main Client Portal Page ───────────────────────────
export default function ClientPortalPage({ params }) {
  // Safely parse projectId — guard against non-numeric slugs
  const projectId = params?.projectId ? Number(params.projectId) : null;

  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);
  const [expired,   setExpired]   = useState(false);
  const [notReady,  setNotReady]  = useState(false); // published === false
  const [fetchErr,  setFetchErr]  = useState(null);
  const [unlocked,  setUnlocked]  = useState(false);
  const [data,      setData]      = useState(null);
  const [tab,       setTab]       = useState("gallery");
  const [favs,      setFavs]      = useState([]);
  const [lightbox,  setLightbox]  = useState(null);
  const [msgDraft,  setMsgDraft]  = useState("");
  const [msgs,      setMsgs]      = useState([]);
  const [msgSent,   setMsgSent]   = useState(false);

  useEffect(() => {
    if (!projectId || isNaN(projectId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        // Lazy-init Supabase inside the effect so module-level init never runs on the server
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          "https://czmzxwtnzyguhbmivizq.supabase.co",
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bXp4d3RuenlndWhibWl2aXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODMwNTksImV4cCI6MjA5MjQ1OTA1OX0.8BFEhkHdCx0PgZ8SuySMlWk68AtMtcvT3sSsxj88wJo"
        );

        const { data: result, error } = await supabase.rpc("get_client_portal_data", {
          p_project_id: projectId,
        });

        if (cancelled) return;

        if (error) {
          console.error("[portal] RPC error:", error);
          setFetchErr(error.message || "Failed to load gallery.");
          setLoading(false);
          return;
        }
        if (!result) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const delivery = result.delivery || {};

        // Gallery not published yet
        if (!delivery.published) {
          setNotReady(true);
          setLoading(false);
          return;
        }

        // Check expiry
        if (delivery.expiryEnabled && delivery.expiryDate) {
          if (new Date(delivery.expiryDate) < new Date()) {
            setExpired(true);
            setLoading(false);
            return;
          }
        }

        // Auto-unlock if no PIN
        if (!delivery.pinEnabled) setUnlocked(true);

        setData(result);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error("[portal] Unexpected error:", err);
        setFetchErr(err?.message || "Something went wrong loading the gallery.");
        setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [projectId]);

  // ── Loading ──────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.cream }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:40, height:40, border:`3px solid ${C.border}`, borderTopColor:C.ink, borderRadius:"50%", animation:"spin 1s linear infinite", margin:"0 auto 16px" }}/>
        <p style={{ fontSize:13, color:C.muted }}>Loading your gallery…</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  // ── Not found ────────────────────────────────────────
  if (notFound) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.cream, padding:24 }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:16 }}>🔍</div>
        <p style={{ fontSize:20, fontWeight:700, color:C.ink, marginBottom:8 }}>Gallery Not Found</p>
        <p style={{ fontSize:13, color:C.muted }}>This link may be invalid or the gallery has been removed.</p>
      </div>
    </div>
  );

  // ── Not published yet ────────────────────────────────
  if (notReady) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.cream, padding:24 }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:16 }}>📷</div>
        <p style={{ fontSize:20, fontWeight:700, color:C.ink, marginBottom:8 }}>Gallery Coming Soon</p>
        <p style={{ fontSize:13, color:C.muted }}>Your photographer is still preparing your gallery. Check back soon!</p>
      </div>
    </div>
  );

  // ── Fetch error ──────────────────────────────────────
  if (fetchErr) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.cream, padding:24 }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:16 }}>⚠️</div>
        <p style={{ fontSize:20, fontWeight:700, color:C.ink, marginBottom:8 }}>Unable to Load Gallery</p>
        <p style={{ fontSize:13, color:C.muted, maxWidth:320 }}>{fetchErr}</p>
        <button onClick={() => window.location.reload()} style={{ marginTop:20, padding:"10px 22px", background:C.ink, color:"#fff", border:"none", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer" }}>
          Try Again
        </button>
      </div>
    </div>
  );

  // ── Expired ──────────────────────────────────────────
  if (expired) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.cream, padding:24 }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:16 }}>⏰</div>
        <p style={{ fontSize:20, fontWeight:700, color:C.ink, marginBottom:8 }}>Gallery Expired</p>
        <p style={{ fontSize:13, color:C.muted }}>This gallery link has expired. Please contact your photographer for a new link.</p>
      </div>
    </div>
  );

  const { delivery = {}, project = {}, photos: rawPhotos, brandKit = {}, invoices = [] } = data || {};
  const photos = Array.isArray(rawPhotos) ? rawPhotos : [];

  // ── PIN gate ─────────────────────────────────────────
  if (!unlocked && delivery.pinEnabled) {
    return <PinGate pin={delivery.pin} onUnlock={() => setUnlocked(true)}/>;
  }

  const brandColor = brandKit.primaryColor || C.ink;
  const studioName = brandKit.studioName || "Your Photographer";
  const dark = delivery.darkMode;
  const bg   = dark ? "#111" : "#fff";
  const fg   = dark ? "#fff" : C.ink;
  const sub  = dark ? "rgba(255,255,255,.55)" : C.muted;
  const brd  = dark ? "rgba(255,255,255,.12)" : C.border;

  const TABS = [
    { id:"gallery",  label:"Gallery",  icon:"🖼" },
    { id:"invoice",  label:"Invoice",  icon:"🧾" },
    { id:"progress", label:"Progress", icon:"✓"  },
    { id:"messages", label:"Messages", icon:"💬" },
  ];

  const checklist = project.checklist || [];
  const done = checklist.filter(c => c.checked).length;

  const openInvoices = invoices.filter(i => i.status !== "Paid");
  const totalDue     = openInvoices.reduce((s, i) => s + (Number(i.total)||0), 0);

  const sendMsg = () => {
    if (!msgDraft.trim()) return;
    setMsgs(prev => [...prev, { from:"client", text:msgDraft.trim(), time:"Now" }]);
    setMsgDraft("");
    setMsgSent(true);
    setTimeout(() => setMsgSent(false), 3000);
  };

  return (
    <div style={{ minHeight:"100vh", background:bg, color:fg, fontFamily:"Inter, system-ui, sans-serif" }}>

      {/* ── Top nav ── */}
      <div style={{ background:bg, borderBottom:`1px solid ${brd}`, padding:"0 24px", display:"flex", alignItems:"center", gap:16, position:"sticky", top:0, zIndex:100 }}>
        {brandKit.logoUrl
          ? <img src={brandKit.logoUrl} alt={studioName} style={{ height:32, objectFit:"contain" }}/>
          : <span style={{ fontSize:15, fontWeight:700, color:fg, padding:"16px 0" }}>{studioName}</span>
        }
        <div style={{ flex:1 }}/>
        <div style={{ display:"flex", gap:4 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding:"16px 14px", fontSize:12, fontWeight:tab===t.id?700:400,
                color:tab===t.id?fg:sub, background:"none", border:"none",
                borderBottom:`2px solid ${tab===t.id?brandColor:"transparent"}`,
                cursor:"pointer", transition:"all .15s", display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ fontSize:14 }}>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Gallery tab ── */}
      {tab === "gallery" && (
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>
          <div style={{ textAlign:"center", marginBottom:36 }}>
            <p style={{ fontSize:12, color:sub, textTransform:"uppercase", letterSpacing:3, margin:"0 0 10px" }}>
              {project.type} · {new Date().toLocaleDateString("en-US",{year:"numeric",month:"long"})}
            </p>
            <h1 style={{ fontFamily:"'Cormorant Garamond', Georgia, serif", fontSize:36, fontWeight:500, color:fg, margin:"0 0 12px", letterSpacing:-.5 }}>
              {delivery.galleryTitle || (project.name ? `${project.name} — Your Gallery` : "Your Gallery")}
            </h1>
            {delivery.message && (
              <p style={{ fontSize:14, color:sub, maxWidth:540, margin:"0 auto 24px", lineHeight:1.7 }}>{delivery.message}</p>
            )}
            {delivery.downloadEnabled && photos.length > 0 && (
              <a href="#download-all" onClick={e => {
                  e.preventDefault();
                  photos.forEach((ph, idx) => {
                    const a = document.createElement("a");
                    a.href = typeof ph === "string" ? ph : ph.url;
                    a.download = ph.name || `photo-${idx+1}`;
                    a.target = "_blank";
                    a.click();
                  });
                }}
                style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"11px 24px", background:brandColor, color:"#fff", borderRadius:12, fontSize:13, fontWeight:600, cursor:"pointer", textDecoration:"none" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download All ({photos.length} {photos.length===1?"photo":"photos"})
              </a>
            )}
            {favs.length > 0 && (
              <p style={{ fontSize:12, color:sub, marginTop:10 }}>{favs.length} photo{favs.length!==1?"s":""} hearted</p>
            )}
          </div>

          {photos.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 0", color:sub }}>
              <p style={{ fontSize:16 }}>Your photos will appear here once ready.</p>
            </div>
          ) : (
            <div style={{ columns:3, columnGap:6 }}>
              {photos.map((photo, idx) => (
                <PhotoTile key={idx} photo={photo}
                  isFav={favs.includes(idx)}
                  onFav={() => setFavs(prev => prev.includes(idx) ? prev.filter(x=>x!==idx) : [...prev, idx])}
                  onClick={() => setLightbox(idx)}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Invoice tab ── */}
      {tab === "invoice" && (
        <div style={{ maxWidth:680, margin:"0 auto", padding:"40px 24px" }}>
          <h2 style={{ fontSize:22, fontWeight:700, color:fg, margin:"0 0 6px" }}>Invoices</h2>
          <p style={{ fontSize:13, color:sub, margin:"0 0 28px" }}>Your billing summary from {studioName}</p>

          {invoices.length === 0 ? (
            <div style={{ textAlign:"center", padding:"48px 0", color:sub }}>
              <p style={{ fontSize:15 }}>No invoices yet.</p>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {invoices.map((inv, idx) => (
                <div key={idx} style={{ background:dark?"rgba(255,255,255,.06)":"#fff", border:`1px solid ${brd}`, borderRadius:14, padding:"18px 20px", display:"flex", alignItems:"center", gap:16 }}>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:14, fontWeight:600, color:fg, margin:"0 0 3px" }}>{inv.title || inv.description || `Invoice #${inv.id||idx+1}`}</p>
                    <p style={{ fontSize:12, color:sub, margin:0 }}>Due {inv.dueDate || "—"}</p>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <p style={{ fontSize:18, fontWeight:700, color:fg, margin:"0 0 4px" }}>${Number(inv.total||0).toLocaleString()}</p>
                    <span style={{ fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:99,
                      background: inv.status==="Paid" ? "#edf3ef" : "#fdf4e7",
                      color:      inv.status==="Paid" ? C.green   : "#8a6a2a" }}>
                      {inv.status || "Pending"}
                    </span>
                  </div>
                </div>
              ))}
              {totalDue > 0 && (
                <div style={{ background: dark?"rgba(255,255,255,.04)":C.warm, border:`1px solid ${brd}`, borderRadius:14, padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <p style={{ fontSize:14, fontWeight:600, color:fg, margin:0 }}>Total Due</p>
                  <p style={{ fontSize:20, fontWeight:700, color:fg, margin:0 }}>${totalDue.toLocaleString()}</p>
                </div>
              )}
              <div style={{ background:dark?"rgba(255,255,255,.06)":C.cream, border:`1px dashed ${brd}`, borderRadius:14, padding:"18px 20px", textAlign:"center" }}>
                <p style={{ fontSize:13, color:sub, margin:"0 0 12px" }}>To make a payment, contact your photographer:</p>
                <button onClick={() => setTab("messages")}
                  style={{ padding:"10px 22px", background:brandColor, color:"#fff", border:"none", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                  Send a Message
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Progress tab ── */}
      {tab === "progress" && (
        <div style={{ maxWidth:600, margin:"0 auto", padding:"40px 24px" }}>
          <h2 style={{ fontSize:22, fontWeight:700, color:fg, margin:"0 0 6px" }}>Project Progress</h2>
          <p style={{ fontSize:13, color:sub, margin:"0 0 28px" }}>Here's where things stand with your {project.type || "project"}</p>

          {checklist.length === 0 ? (
            <div style={{ textAlign:"center", padding:"48px 0", color:sub }}>
              <p style={{ fontSize:15 }}>Your photographer will update progress here as the project moves forward.</p>
            </div>
          ) : (
            <>
              <div style={{ background:dark?"rgba(255,255,255,.1)":C.border, borderRadius:99, height:6, marginBottom:24, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.round((done/checklist.length)*100)}%`, background:brandColor, borderRadius:99, transition:"width .4s" }}/>
              </div>
              <p style={{ fontSize:13, color:sub, margin:"0 0 20px" }}>{done} of {checklist.length} steps complete</p>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {checklist.map((item, idx) => (
                  <div key={idx} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px",
                    background: item.checked ? (dark?"rgba(74,122,87,.15)":"#edf3ef") : (dark?"rgba(255,255,255,.04)":"#fff"),
                    border:`1px solid ${item.checked?(dark?"rgba(74,122,87,.3)":C.green):brd}`,
                    borderRadius:12, transition:"all .2s" }}>
                    <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${item.checked?C.green:brd}`,
                      background:item.checked?C.green:"transparent",
                      display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
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

      {/* ── Messages tab ── */}
      {tab === "messages" && (
        <div style={{ maxWidth:600, margin:"0 auto", padding:"40px 24px", display:"flex", flexDirection:"column", height:"calc(100vh - 57px)" }}>
          <h2 style={{ fontSize:22, fontWeight:700, color:fg, margin:"0 0 6px" }}>Messages</h2>
          <p style={{ fontSize:13, color:sub, margin:"0 0 20px" }}>Send a note to {studioName}</p>
          <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:12, marginBottom:16 }}>
            {msgs.length === 0 && (
              <div style={{ textAlign:"center", padding:"32px 0", color:sub }}>
                <p style={{ fontSize:14 }}>No messages yet. Say hello!</p>
              </div>
            )}
            {msgs.map((m, idx) => (
              <div key={idx} style={{ display:"flex", justifyContent: m.from==="client" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth:"75%", padding:"10px 14px", borderRadius:14,
                  background: m.from==="client" ? brandColor : (dark?"rgba(255,255,255,.08)":C.warm),
                  color: m.from==="client" ? "#fff" : fg }}>
                  <p style={{ fontSize:13, lineHeight:1.5, margin:0 }}>{m.text}</p>
                  <p style={{ fontSize:10, opacity:.6, margin:"4px 0 0", textAlign:"right" }}>{m.time}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:10, flexShrink:0 }}>
            <input value={msgDraft} onChange={e => setMsgDraft(e.target.value)}
              onKeyDown={e => e.key==="Enter" && !e.shiftKey && sendMsg()}
              placeholder={`Message ${studioName}…`}
              style={{ flex:1, padding:"12px 16px", border:`1px solid ${brd}`, borderRadius:12,
                fontSize:13, color:fg, background:dark?"rgba(255,255,255,.07)":C.cream, outline:"none", fontFamily:"inherit" }}/>
            <button onClick={sendMsg} style={{ padding:"12px 18px", background:brandColor, color:"#fff", border:"none", borderRadius:12, fontSize:13, fontWeight:600, cursor:"pointer" }}>
              Send
            </button>
          </div>
          {msgSent && <p style={{ fontSize:12, color:C.green, marginTop:8, textAlign:"center" }}>Message sent! We'll get back to you soon.</p>}
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox !== null && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.92)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 }}
          onClick={() => setLightbox(null)}>
          <button onClick={e => { e.stopPropagation(); setLightbox(prev => (prev - 1 + photos.length) % photos.length); }}
            style={{ position:"absolute", left:20, width:44, height:44, borderRadius:12, background:"rgba(255,255,255,.15)", border:"none", cursor:"pointer", color:"#fff", fontSize:22, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth:"90vw", maxHeight:"90vh" }}>
            {(() => {
              const ph = photos[lightbox];
              const src = typeof ph === "string" ? ph : ph?.url;
              const isVid = ph?.type === "video" || /\.(mp4|mov|webm)(\?|$)/i.test(src||"");
              return isVid
                ? <video src={src} controls autoPlay style={{ maxWidth:"88vw", maxHeight:"85vh", borderRadius:4 }}/>
                : <img src={src} alt="" style={{ maxWidth:"88vw", maxHeight:"85vh", objectFit:"contain", borderRadius:4, display:"block" }}/>;
            })()}
            <p style={{ color:"rgba(255,255,255,.7)", fontSize:12, textAlign:"center", marginTop:10 }}>{lightbox+1} / {photos.length}</p>
          </div>
          <button onClick={e => { e.stopPropagation(); setLightbox(prev => (prev + 1) % photos.length); }}
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
