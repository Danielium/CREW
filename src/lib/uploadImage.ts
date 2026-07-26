import imageCompression from 'browser-image-compression';

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
