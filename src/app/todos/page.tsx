import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TodosClient } from "./todos-client";

export default async function TodosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: todos } = await supabase
    .from("todos").select("*").eq("user_id", user.id)
    .order("completed").order("created_at", { ascending: false });

  return <TodosClient initialTodos={todos ?? []} />;
}
