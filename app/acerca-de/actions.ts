"use server";

import { Resend } from "resend";

export type ContactForm = { name: string; email: string; msg: string };
export type ContactActionResult = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_ERROR = "No se pudo enviar el mensaje. Intenta de nuevo en unos minutos.";

export async function enviarMensajeContacto(
  form: ContactForm
): Promise<ContactActionResult> {
  const name = form.name?.trim() ?? "";
  const email = form.email?.trim() ?? "";
  const msg = form.msg?.trim() ?? "";

  if (!name || !email || !msg) {
    return { ok: false, error: "Completa todos los campos." };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "El correo electrónico no es válido." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.RESEND_TO_EMAIL;

  if (!apiKey || !toEmail) {
    return { ok: false, error: GENERIC_ERROR };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: toEmail,
      replyTo: email,
      subject: `Nuevo mensaje de contacto — ${name}`,
      text: `De: ${name} <${email}>\n\n${msg}`,
    });

    if (error) {
      return { ok: false, error: GENERIC_ERROR };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}
