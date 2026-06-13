import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import mime from "mime-types";

const DOCS_DIR = process.env.DOCS_LOCAL_PATH ?? "";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string[] }> }
) {
  if (!DOCS_DIR) {
    return NextResponse.json({ error: "DOCS_LOCAL_PATH not set" }, { status: 500 });
  }

  const { filename } = await params;
  const filePath = path.join(DOCS_DIR, ...filename);

  // Prevent path traversal outside DOCS_DIR
  if (!filePath.startsWith(path.resolve(DOCS_DIR))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  const contentType = mime.lookup(filePath) || "application/octet-stream";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${path.basename(filePath)}"`,
    },
  });
}
