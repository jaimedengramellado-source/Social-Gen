import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 5 * 1024 * 1024;
const YEAR_SECONDS = 60 * 60 * 24 * 365;

function extFromName(name: string): string | null {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return null;
  return name.slice(dot + 1).toLowerCase();
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  return map[mime] ?? "bin";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "Solo se permiten imágenes" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Máximo 5 MB" }, { status: 400 });
  }

  const ext = extFromName(file.name) ?? extFromMime(file.type);
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase
    .storage
    .from("chat-attachments")
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: signed, error: signError } = await supabase
    .storage
    .from("chat-attachments")
    .createSignedUrl(path, YEAR_SECONDS);

  if (signError || !signed) {
    return Response.json({ error: signError?.message ?? "Sign failed" }, { status: 500 });
  }

  return Response.json({ url: signed.signedUrl, path, mime_type: file.type });
}
