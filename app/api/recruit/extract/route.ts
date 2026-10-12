import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { DocumentBlockParam, TextBlockParam } from "@anthropic-ai/sdk/resources";

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function cleanText(raw: string): string {
  return raw
    .replace(CONTROL_CHARS, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Fallback for scanned/image PDFs: send to Claude vision to OCR the content
async function ocrWithClaude(buffer: Buffer): Promise<string> {
  const apiKey = process.env.FOX_EXCEL_ANTHROPIC_KEY;
  if (!apiKey) throw new Error("FOX_EXCEL_ANTHROPIC_KEY not set");
  const client = new Anthropic({ apiKey, baseURL: undefined });

  const docBlock: DocumentBlockParam = {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
  };
  const textBlock: TextBlockParam = {
    type: "text",
    text: "Extract all text from this document. Return only the raw text content, preserving structure and layout. No commentary, no markdown, just the extracted text.",
  };

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: [docBlock, textBlock] }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  return cleanText(raw);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const name = file.name.toLowerCase();

    let text = "";

    if (name.endsWith(".pdf")) {
      // pdf-parse v1 exports a plain async function; v2 is class-based and breaks
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
      // pdf-parse bundles an old pdf.js that throws on some valid PDFs (e.g. "bad XRef entry")
      try {
        const result = await pdfParse(buffer);
        text = cleanText(result.text);
      } catch (err) {
        console.warn("pdf-parse failed, falling back to OCR:", err);
      }

      // Scanned/image PDF, or one pdf-parse could not read — fall back to Claude vision OCR
      if (!text) {
        text = await ocrWithClaude(buffer);
      }
    } else if (name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = cleanText(result.value);
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a PDF or .docx file." },
        { status: 400 }
      );
    }

    if (!text) {
      return NextResponse.json(
        { error: "Could not extract any text from this file. Try pasting the CV manually." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error("Extract error:", err);
    return NextResponse.json({ error: "Failed to extract text from file." }, { status: 500 });
  }
}
