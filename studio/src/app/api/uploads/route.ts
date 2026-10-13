import { apiUser, handle, HttpError } from "@/lib/auth";
import { ALLOWED_UPLOAD_MIME, MAX_UPLOAD_BYTES, saveAsset } from "@/lib/storage";

export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Geen bestand ontvangen");
  if (!ALLOWED_UPLOAD_MIME.includes(file.type)) throw new HttpError(400, "Alleen PNG, JPG, WEBP, GIF of MP4");
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(400, "Bestand is groter dan 20 MB");
  const asset = await saveAsset({
    userId: user.id,
    kind: "upload",
    mime: file.type,
    data: Buffer.from(await file.arrayBuffer()),
    fileName: file.name,
  });
  return Response.json({ id: asset.id, mime: asset.mime, fileName: asset.fileName });
});
