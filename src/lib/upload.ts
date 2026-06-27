export async function uploadChatImage(file: File): Promise<{ url: string; path: string; mime_type: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload/chat-image", { method: "POST", body: fd });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Upload failed");
  }
  return res.json();
}

export async function uploadChatFile(file: File): Promise<{ url: string; path: string; mime_type: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload/chat-file", { method: "POST", body: fd });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Upload failed");
  }
  return res.json();
}
