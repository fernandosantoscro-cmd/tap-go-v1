import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente público (chave publicável) usado apenas dentro de handlers de server
 * functions. Todo acesso público acontece via funções seguras no banco
 * (get_menu_by_code, get_voucher, ...), nunca lendo tabelas diretamente.
 */
export function publicDb(): SupabaseClient {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Backend não configurado");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}
