import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ImagenesClient } from "./imagenes-client";
import type { GeneratedImage } from "@/types";

export default async function ImagenesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: images }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("generated_images")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <ImagenesClient
      profile={profile!}
      initialImages={(images ?? []) as GeneratedImage[]}
    />
  );
}
