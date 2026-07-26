import imageCompression from 'browser-image-compression';

export async function uploadImage(file: File): Promise<string | null> {
  try {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };
    
    const compressedFile = await imageCompression(file, options);
    
    const formData = new FormData();
    formData.append("file", compressedFile);

    const response = await fetch("/api/upload", {
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
