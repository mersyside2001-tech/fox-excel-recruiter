import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

function getClient() {
  const apiKey = process.env.FOX_EXCEL_ANTHROPIC_KEY;
  if (!apiKey) throw new Error("FOX_EXCEL_ANTHROPIC_KEY environment variable is not set");
  return new Anthropic({ apiKey, baseURL: undefined });
}

const SYSTEM_PROMPT = `You are a recruiter screening candidates for a Chef de Partie (CDP) position in a busy pub kitchen. The role requires someone who can own their section, produce consistent quality at pace during busy service, and work reliably under a Head Chef with minimal supervision.

What you are looking for in a CDP:
- Solid professional kitchen background (pubs, restaurants, hotels, contract catering)
- Clear section ownership experience (grill, cold, larder, pastry, or similar)
- Ability to work at pace and maintain quality during busy covers
- Confidence working without close supervision
- Good food hygiene and allergen awareness
- Full-time availability and reliability — no excessive job-hopping

Score the candidate on four dimensions, each out of 10:
- volumeScore: experience handling busy covers and service volume
- leadershipScore: section ownership and ability to work independently
- venueFitScore: fit for a pub kitchen environment and culture
- commitmentScore: reliability, stability, and signals of full-time commitment

Return ONLY a JSON object with these exact fields:
{
  verdict: string (one of: STRONG FIT, WORTH INTERVIEWING, BORDERLINE, NOT SUITABLE),
  overallScore: number (1-10),
  volumeScore: number (1-10),
  leadershipScore: number (1-10),
  venueFitScore: number (1-10),
  commitmentScore: number (1-10),
  strengths: string[] (2-3 items),
  concerns: string[] (2-3 items),
  recommendation: string (2 sentences, direct and honest)
}
No markdown, no preamble. JSON only.`;

async function screenCDP(client: Anthropic, cvText: string): Promise<Record<string, unknown>> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Role: Chef de Partie (CDP) — pub kitchen\n\nCV:\n${cvText}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  return JSON.parse(cleaned);
}

// Strips control chars that break JSON.parse or PostgreSQL text storage.
// Keeps tab (\x09), LF (\x0A), CR (\x0D) — valid in both contexts.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export async function POST(req: NextRequest) {
  try {
    // Read as raw text first so control chars in the body don't break JSON.parse
    const rawBody = (await req.text()).replace(CONTROL_CHARS, "");
    const { name, email, cvText: rawCvText } = JSON.parse(rawBody);
    // Second pass on cvText in case it arrived via manual paste rather than extract route
    const cvText: string = (rawCvText ?? "").replace(CONTROL_CHARS, "");

    if (!name || !cvText) {
      return NextResponse.json({ error: "name and cvText are required" }, { status: 400 });
    }

    const client = getClient();
    const cdpResult = await screenCDP(client, cvText);

    const candidate = await prisma.candidate.create({
      data: {
        name,
        email: email || null,
        cvText,
        screenings: {
          create: [
            {
              role: "CDP",
              verdict: cdpResult.verdict as string,
              overallScore: cdpResult.overallScore as number,
              volumeScore: cdpResult.volumeScore as number,
              leadershipScore: cdpResult.leadershipScore as number,
              venueFitScore: cdpResult.venueFitScore as number,
              commitmentScore: cdpResult.commitmentScore as number,
              strengths: JSON.stringify(cdpResult.strengths),
              concerns: JSON.stringify(cdpResult.concerns),
              recommendation: cdpResult.recommendation as string,
            },
          ],
        },
      },
      include: { screenings: true },
    });

    return NextResponse.json(candidate);
  } catch (err) {
    console.error("Screening error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
