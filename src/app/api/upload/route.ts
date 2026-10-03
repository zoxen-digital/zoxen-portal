import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { apiUser } from "@/lib/session";
import { HttpError } from "@/lib/api";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = [
  "image/*",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "video/mp4",
  "video/quicktime",
];

/**
 * Hands the browser a short-lived token to upload one file straight to Vercel Blob
 * (so big files never pass through our server). Any signed-in user may upload.
 */
export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "File uploads are not set up yet" }, { status: 503 });
  }
  try {
    const body = (await req.json()) as HandleUploadBody;
    const result = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async (pathname) => {
        const user = await apiUser(["super_admin", "team_admin", "client"]);
        if (!pathname.startsWith("uploads/") || pathname.includes("..")) throw new HttpError("Invalid file path");
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ uid: user.id }),
        };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 400;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status });
  }
}
