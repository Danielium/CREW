import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";

// Load from .env manually just to be safe
const envContent = fs.readFileSync(".env", "utf8");
const envMap = {};
envContent.split("\n").forEach(line => {
  const match = line.match(/^([^=]+)="?(.*?)"?$/);
  if (match) envMap[match[1]] = match[2];
});

const s3Client = new S3Client({
  region: envMap.YANDEX_S3_REGION || "ru-central1",
  endpoint: "https://storage.yandexcloud.net",
  credentials: {
    accessKeyId: envMap.YANDEX_S3_ACCESS_KEY_ID,
    secretAccessKey: envMap.YANDEX_S3_SECRET_ACCESS_KEY,
  },
});

async function testUpload() {
  try {
    const command = new PutObjectCommand({
      Bucket: envMap.YANDEX_S3_BUCKET_NAME,
      Key: "test2.txt",
      Body: "Hello Yandex Cloud S3!",
      ContentType: "text/plain",
    });

    const res = await s3Client.send(command);
    console.log("Success:", res);
  } catch (error) {
    console.error("S3 Upload error:", error);
  }
}

testUpload();
