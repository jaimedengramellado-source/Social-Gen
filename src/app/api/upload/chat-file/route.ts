import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 10 * 1024 * 1024;
const YEAR_SECONDS = 60 * 60 * 24 * 365;

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
]);

function extFromName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "bin";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });

  if (!ALLOWED_MIMES.has(file.type)) {
    return Response.json({ error: "Tipo de archivo no permitido. Usa PDF, Word, TXT o CSV." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Máximo 10 MB" }, { status: 400 });
  }

  const ext = extFromName(file.name);
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase
    .storage
    .from("chat-attachments")
    .upload(path, file, { contentType: file.type });

  if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 });

  const { data: signed, error: signError } = await supabase
    .storage
    .from("chat-attachments")
    .createSignedUrl(path, YEAR_SECONDS);

  if (signError || !signed) return Response.json({ error: signError?.message ?? "Sign failed" }, { status: 500 });

  return Response.json({ url: signed.signedUrl, path, mime_type: file.type });
}
