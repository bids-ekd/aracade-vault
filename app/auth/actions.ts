"use server";

import { createClient } from "@/lib/supabase/server";

export type AuthActionResult = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_ERROR = "No se pudo completar la operación. Intenta de nuevo en unos minutos.";

export async function iniciarSesion(email: string, password: string): Promise<AuthActionResult> {
  const trimmedEmail = email?.trim() ?? "";

  if (!trimmedEmail || !password) {
    return { ok: false, error: "Completa todos los campos." };
  }
  if (!EMAIL_RE.test(trimmedEmail)) {
    return { ok: false, error: "El correo electrónico no es válido." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error) {
      return {
        ok: false,
        error: "Correo o contraseña incorrectos, o la cuenta aún no fue confirmada.",
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function crearCuenta(
  displayName: string,
  email: string,
  password: string,
): Promise<AuthActionResult> {
  const trimmedName = displayName?.trim() ?? "";
  const trimmedEmail = email?.trim() ?? "";

  if (!trimmedName || !trimmedEmail || !password) {
    return { ok: false, error: "Completa todos los campos." };
  }
  if (!EMAIL_RE.test(trimmedEmail)) {
    return { ok: false, error: "El correo electrónico no es válido." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: { data: { display_name: trimmedName } },
    });

    if (error) {
      return { ok: false, error: GENERIC_ERROR };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}
