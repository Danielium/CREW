import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    // BUG-001 fix: require authentication for file uploads
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    
    // BUG-002 fix: use cryptographically secure random bytes for filename
    const extension = file.type.split('/')[1] || 'jpeg';
    const safeName = crypto.randomBytes(16).toString('hex');
    const filename = `${Date.now()}-${safeName}.${extension}`;
    
    const uploadPath = path.join(process.cwd(), 'public', 'uploads', filename);
    
    await writeFile(uploadPath, buffer);
    
    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (error) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
