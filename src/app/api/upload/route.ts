import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    // Временно разрешаем загрузку без авторизации для экрана регистрации
    // (Аватар загружается ДО того, как пользователь зарегистрирован)

    const data = await req.formData();
    const file: File | null = data.get('file') as unknown as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validation: Check file type and size (max 5MB)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only JPEG, PNG, WEBP, and GIF are allowed." }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 5MB limit" }, { status: 400 });
    }
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const filename = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
    const uploadPath = path.join(process.cwd(), 'public', 'uploads', filename);
    
    await writeFile(uploadPath, buffer);
    
    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (error) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
