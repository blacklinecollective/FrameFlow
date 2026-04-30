import { createClient } from "@supabase/supabase-js";

// GET /api/calendar/<userId>.ics
// Public subscription feed in iCalendar (RFC 5545) format. The user
// pastes this URL into Apple Calendar / Google Calendar / Outlook as
// a subscribed calendar; their app polls it every few hours and shows
// FrameFlow events alongside their personal calendar.
//
// Read-only by design: events flow OUT of FrameFlow into their
// calendar app, never the other way. Real two-way sync requires
// OAuth integration per provider, which is a separate project.
//
// Authentication: the URL contains the user's UUID, which is 122 bits
// of randomness — unguessable. Anyone with the URL can read the feed,
// so don't share it. We can rotate by re-keying app_state if a user
// ever needs to revoke a stale link.
export const runtime = "nodejs";

// Strip newlines / commas / semicolons from text fields so they don't
// break the ICS format. Lines should also be folded at 75 chars per
// RFC 5545; we keep it simple and just truncate long descriptions.
const escIcs = (s) => String(s ?? "")
  .replace(/\\/g, "\\\\")
  .replace(/\n/g, "\\n")
  .replace(/,/g, "\\,")
  .replace(/;/g, "\\;")
  .slice(0, 200);

const formatDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  // YYYYMMDD format for all-day events
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
};

const formatDateTime = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  // YYYYMMDDTHHMMSSZ format for timed events (UTC)
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  const hh = String(dt.getUTCHours()).padStart(2, "0");
  const mm = String(dt.getUTCMinutes()).padStart(2, "0");
  const ss = String(dt.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${hh}${mm}${ss}Z`;
};

// Parse a "May 12, 2026" or "2026-05-12" or "2026-05-12T10:00" string
// into a Date or null. Skips "TBD" / "" / undefined gracefully.
const parseLooseDate = (s) => {
  if (!s) return null;
  const str = String(s).trim();
  if (!str || /^tbd$/i.test(str)) return null;
  const dt = new Date(str);
  if (isNaN(dt.getTime())) return null;
  return dt;
};

export async function GET(_request, { params }) {
  try {
    const userId = params?.userId;
    if (!userId) return new Response("userId required", { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      || process.env.SUPABASE_URL
      || "https://czmzxwtnzyguhbmivizq.supabase.co";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return new Response("Calendar feed not configured.", { status: 500 });

    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await sb
      .from("app_state")
      .select("projects, bookings, cal_events, brand_kit")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return new Response("Could not load calendar.", { status: 500 });
    if (!data)  return new Response("No data for this user.", { status: 404 });

    const studioName = data.brand_kit?.studioName || "FrameFlow";
    const events = [];

    // ── Project shoot dates ─────────────────────────────────────────
    for (const p of (data.projects || [])) {
      const dt = parseLooseDate(p?.due);
      if (!dt) continue;
      events.push({
        uid: `proj-${p.id}@frameflow`,
        summary: `📷 ${p.name || "Project"}${p.client ? ` — ${p.client}` : ""}`,
        description: [
          p.type ? `Type: ${p.type}` : "",
          p.client ? `Client: ${p.client}` : "",
          p.notes || "",
        ].filter(Boolean).join("\n"),
        date: formatDate(dt),
      });

      // ── Project checklist items with due dates ────────────────────
      for (const item of (p.checklist || [])) {
        const idt = parseLooseDate(item?.due);
        if (!idt) continue;
        events.push({
          uid: `task-${p.id}-${item.id}@frameflow`,
          summary: `☑ ${item.text || "Task"} — ${p.name || "Project"}`,
          description: [
            `Project: ${p.name || ""}`,
            `Category: ${item.cat || ""}`,
            item.note || "",
          ].filter(Boolean).join("\n"),
          date: formatDate(idt),
        });
      }
    }

    // ── Bookings ────────────────────────────────────────────────────
    for (const b of (data.bookings || [])) {
      const start = parseLooseDate(b?.date || b?.start || b?.startDate);
      if (!start) continue;
      const end = parseLooseDate(b?.endDate || b?.end);
      events.push({
        uid: `booking-${b.id || start.getTime()}@frameflow`,
        summary: `📅 ${b.title || b.label || "Booking"}${b.client ? ` — ${b.client}` : ""}`,
        description: [
          b.location ? `Location: ${b.location}` : "",
          b.client ? `Client: ${b.client}` : "",
          b.notes || "",
        ].filter(Boolean).join("\n"),
        // Use timed format if we have hours, else all-day
        ...(b.time
          ? { dtStart: formatDateTime(start), dtEnd: formatDateTime(end || new Date(start.getTime() + 60*60*1000)) }
          : { date: formatDate(start) }
        ),
      });
    }

    // ── Cal events (the "Calendar" tab on the dashboard) ────────────
    for (const e of (data.cal_events || [])) {
      const start = parseLooseDate(e?.date || e?.start);
      if (!start) continue;
      events.push({
        uid: `cal-${e.id || start.getTime()}@frameflow`,
        summary: `${e.title || "Event"}`,
        description: e.notes || e.description || "",
        date: formatDate(start),
      });
    }

    // ── Build the .ics body ─────────────────────────────────────────
    const now = formatDateTime(new Date());
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      `PRODID:-//FrameFlow//${escIcs(studioName)}//EN`,
      `X-WR-CALNAME:${escIcs(studioName)} — FrameFlow`,
      "X-WR-TIMEZONE:UTC",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
      "X-PUBLISHED-TTL:PT1H",
    ];
    for (const ev of events) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${escIcs(ev.uid)}`);
      lines.push(`DTSTAMP:${now}`);
      lines.push(`SUMMARY:${escIcs(ev.summary)}`);
      if (ev.description) lines.push(`DESCRIPTION:${escIcs(ev.description)}`);
      if (ev.dtStart) {
        lines.push(`DTSTART:${ev.dtStart}`);
        if (ev.dtEnd) lines.push(`DTEND:${ev.dtEnd}`);
      } else if (ev.date) {
        lines.push(`DTSTART;VALUE=DATE:${ev.date}`);
      }
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");

    // RFC 5545 requires CRLF line endings.
    const body = lines.join("\r\n") + "\r\n";

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="frameflow-${userId.slice(0, 8)}.ics"`,
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (err) {
    console.error("[api/calendar]", err);
    return new Response("Internal error", { status: 500 });
  }
}
