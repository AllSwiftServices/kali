import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const bucket = (formData.get("bucket") as string) || "kyc";
    let path = formData.get("path") as string;

    if (!file) {
      return NextResponse.json(
        { message: "File is required" },
        { status: 400 }
      );
    }

    if (!path) {
        // Generate a random path if none provided
        const ext = file.name.split('.').pop();
        path = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${ext}`;
    }

    const buffer = await file.arrayBuffer();
    
    // Upload to specified bucket
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      console.error(`Supabase storage error (bucket: ${bucket}, path: ${path}):`, error);
      throw error;
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(path);

    return NextResponse.json({ url: publicUrl }); // Return 'url' as expected by frontend
  } catch (error: any) {
    console.error("Upload route error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}
