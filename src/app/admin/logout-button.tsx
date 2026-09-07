"use client";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LogoutButton() {
  async function logout() {
    await createSupabaseBrowserClient().auth.signOut();
    window.location.assign("/admin/login");
  }

  return (
    <Button type="button" variant="outline" onClick={logout}>
      Cerrar sesión
    </Button>
  );
}
