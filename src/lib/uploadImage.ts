import imageCompression from 'browser-image-compression';

export type MediaKind = "image" | "video";
export type UploadedMedia = { url: string; type: MediaKind };

/**
 * Uploads either an image or a video.
 * Images are compressed client-side and posted through /api/upload.
 * Videos bypass the serverless body limit by PUTting straight to S3 with a
 * presigned URL from /api/upload/presign.
 */
export async function uploadMedia(file: File): Promise<UploadedMedia | null> {
  if (file.type.startsWith("video/")) {
    try {
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      });
      const presign = await presignRes.json();
      if (!presignRes.ok) throw new Error(presign.error || "Presign failed");

      const put = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("S3 upload failed");

      return { url: presign.url, type: "video" };
    } catch (error) {
      console.error("Error uploading video:", error);
      return null;
    }
  }

  const url = await uploadImage(file);
  return url ? { url, type: "image" } : null;
}

export async function uploadImage(file: File, prefix?: string): Promise<string | null> {
  try {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };
    
    const compressedFile = await imageCompression(file, options);
    
    const formData = new FormData();
    formData.append("file", compressedFile);

    const uploadUrl = prefix ? `/api/upload?prefix=${encodeURIComponent(prefix)}` : "/api/upload";
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Upload failed");
    }

    return data.url;
  } catch (error) {
    console.error("Error uploading image:", error);
    return null;
  }
}

/**
 * Deletes every object referenced by a media column, which may hold either a bare
 * URL (legacy rows) or a JSON array of {url, type} entries.
 */
export async function deleteMediaFromS3(raw: string | null) {
  if (!raw) return;
  const value = raw.trim();
  let urls: string[] = [];

  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        urls = parsed.map((item) => item?.url).filter((u): u is string => typeof u === "string");
      }
    } catch {
      urls = [];
    }
  } else {
    urls = [value];
  }

  await Promise.allSettled(urls.map((u) => deleteImageFromS3(u)));
}

export async function deleteImageFromS3(url: string | null) {
  if (!url || !url.includes("storage.yandexcloud.net")) return;
  
  try {
    const urlObj = new URL(url);
    const bucketName = process.env.YANDEX_S3_BUCKET_NAME;
    if (!bucketName) return;
    
    // URL format: https://storage.yandexcloud.net/bucketname/filename.jpg
    const prefix = `/${bucketName}/`;
    if (!urlObj.pathname.startsWith(prefix)) return;
    
    const key = urlObj.pathname.substring(prefix.length);
    
    // Using dynamic import because this runs on the server side
    const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    
    const s3Client = new S3Client({
      region: process.env.YANDEX_S3_REGION || "ru-central1",
      endpoint: "https://storage.yandexcloud.net",
      credentials: {
        accessKeyId: process.env.YANDEX_S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.YANDEX_S3_SECRET_ACCESS_KEY!,
      },
    });

    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }));
    
    console.log(`[CREW] Deleted S3 object: ${key}`);
  } catch (e) {
    console.error("Failed to delete image from S3:", e);
  }
}
