import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/send-email
// Body: { to, subject, html, from?, replyTo?, attachments? }
export async function POST(request) {
  try {
    const body = await request.json();
    const { to, subject, html, from, replyTo, attachments } = body;

    if (!to || !subject || !html) {
      return Response.json(
        { error: "Missing required fields: to, subject, html" },
        { status: 400 }
      );
    }

    const fromAddress =
      from ||
      process.env.EMAIL_FROM ||
      "FrameFlow <noreply@" + (process.env.EMAIL_DOMAIN || "frameflow.co") + ">";

    const emailPayload = {
      from: fromAddress,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    };

    if (replyTo) emailPayload.reply_to = replyTo;
    if (attachments) emailPayload.attachments = attachments;

    const { data, error } = await resend.emails.send(emailPayload);

    if (error) {
      console.error("Resend error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, id: data.id });
  } catch (err) {
    console.error("Email send error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
