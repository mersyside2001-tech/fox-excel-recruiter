"use client";

import { useState } from "react";
import Link from "next/link";

const VERDICT_STYLES: Record<string, string> = {
  "STRONG FIT": "bg-green-100 text-green-800",
  "WORTH INTERVIEWING": "bg-blue-100 text-blue-800",
  BORDERLINE: "bg-amber-100 text-amber-800",
  "NOT SUITABLE": "bg-red-100 text-red-800",
};

type Screening = {
  role: string;
  verdict: string;
  overallScore: number;
  volumeScore: number;
  leadershipScore: number;
  venueFitScore: number;
  commitmentScore: number;
  strengths: string;
  concerns: string;
  recommendation: string;
};

type ScreenResult = { id: string; name: string; screenings: Screening[] };

// strengths/concerns arrive as JSON-encoded string arrays
function parseList(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="font-medium text-gray-700">{value}/10</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full">
        <div
          className="h-1.5 bg-indigo-500 rounded-full transition-all"
          style={{ width: `${Math.max(0, Math.min(10, value)) * 10}%` }}
        />
      </div>
    </div>
  );
}

function ResultCard({ s }: { s: Screening }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Chef de Partie</h3>
          <p className="text-xs text-gray-500 mt-0.5">Pub kitchen</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-3xl font-bold text-gray-900 leading-none">
            {s.overallScore}<span className="text-base text-gray-400">/10</span>
          </div>
          <span className={`inline-block mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${VERDICT_STYLES[s.verdict] ?? "bg-gray-100 text-gray-700"}`}>
            {s.verdict}
          </span>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-600 mb-2">Dimension scores</p>
        <ScoreBar label="Service volume" value={s.volumeScore} />
        <ScoreBar label="Section ownership" value={s.leadershipScore} />
        <ScoreBar label="Pub kitchen fit" value={s.venueFitScore} />
        <ScoreBar label="Commitment" value={s.commitmentScore} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-medium text-green-700 mb-1.5">Strengths</p>
          <ul className="space-y-1">
            {parseList(s.strengths).map((item, i) => (
              <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                <span className="text-green-500 shrink-0">✓</span>{item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-red-700 mb-1.5">Concerns</p>
          <ul className="space-y-1">
            {parseList(s.concerns).map((item, i) => (
              <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                <span className="text-red-400 shrink-0">✗</span>{item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs font-medium text-gray-600 mb-1">Recommendation</p>
        <p className="text-xs text-gray-600 leading-relaxed">{s.recommendation}</p>
      </div>
    </div>
  );
}

export default function RecruitPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cvText, setCvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [screening, setScreening] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [screenError, setScreenError] = useState("");
  const [result, setResult] = useState<ScreenResult | null>(null);

  // Errors are only ever set from the handlers below, all of which run in
  // response to a click, drop or submit — nothing sets them on page load.

  async function handleFile(file: File) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) {
      setExtractError("Please upload a PDF or .docx file.");
      return;
    }
    setExtracting(true);
    setExtractError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/recruit/extract", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || typeof data.text !== "string") {
        throw new Error(data.error || "Extraction failed");
      }
      setCvText(data.text);
      setFileName(file.name);
    } catch (err: unknown) {
      setExtractError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  // The file input is created on demand and never lives in the DOM, so Safari
  // has nothing to session-restore and cannot fire a change event on page load.
  function openFilePicker() {
    if (extracting) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.docx";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (extracting) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function removeFile() {
    setFileName("");
    setCvText("");
    setExtractError("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (screening || extracting) return;

    setScreenError("");
    setExtractError("");
    if (!name.trim()) {
      setScreenError("Please enter a candidate name.");
      return;
    }
    if (!cvText.trim()) {
      setExtractError("Please upload a CV or paste the CV text.");
      return;
    }

    setScreening(true);
    setResult(null);
    try {
      const res = await fetch("/api/recruit/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), cvText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Screening failed");
      setResult(data);
    } catch (err: unknown) {
      setScreenError(err instanceof Error ? err.message : "Screening failed");
    } finally {
      setScreening(false);
    }
  }

  const cdp = result?.screenings?.find((s) => s.role === "CDP") ?? result?.screenings?.[0];

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Fox Excel Recruiter</h1>
          <p className="text-sm text-gray-500">CDP — pub kitchen</p>
        </div>
        <Link href="/recruit/candidates" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          Screening history →
        </Link>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} noValidate autoComplete="off" className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-1">Screen a candidate</h2>
          <p className="text-sm text-gray-500 mb-4">Scores against CDP — pub kitchen.</p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="candidate-name" className="block text-sm font-medium text-gray-700 mb-1">
                Candidate name <span className="text-red-500">*</span>
              </label>
              <input
                id="candidate-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Full name"
              />
            </div>
            <div>
              <label htmlFor="candidate-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                id="candidate-email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="optional"
              />
            </div>
          </div>

          {/* CV: upload or paste */}
          <div className="mb-5">
            <p className="block text-sm font-medium text-gray-700 mb-2">
              CV <span className="text-red-500">*</span>
            </p>
            <div
              role="button"
              tabIndex={0}
              onClick={openFilePicker}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openFilePicker();
                }
              }}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragging(false);
              }}
              className={`mb-3 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500
                ${isDragging ? "border-indigo-400 bg-indigo-50" : "border-gray-300 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/40"}
                ${extracting ? "cursor-wait opacity-70" : "cursor-pointer"}`}
            >
              {extracting ? (
                <div className="flex items-center gap-2 text-sm text-indigo-600">
                  <Spinner />
                  Extracting text…
                </div>
              ) : fileName ? (
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-700 font-medium truncate max-w-xs">{fileName}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeFile(); }}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    ✕ Remove
                  </button>
                </div>
              ) : (
                <>
                  <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1" />
                  </svg>
                  <div className="text-center">
                    <p className="text-sm text-gray-600"><span className="font-medium text-indigo-600">Upload a CV</span> or drag and drop</p>
                    <p className="text-xs text-gray-400 mt-0.5">PDF or Word (.docx)</p>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <textarea
                rows={8}
                value={cvText}
                readOnly={!!fileName}
                onChange={(e) => setCvText(e.target.value)}
                className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y
                  ${fileName ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""}`}
                placeholder="…or paste CV text here manually"
              />
              {cvText && (
                <span className="absolute bottom-2 right-3 text-xs text-gray-300 select-none">{cvText.length.toLocaleString()} chars</span>
              )}
            </div>
            {fileName && (
              <p className="mt-1 text-xs text-gray-400">Text extracted from the uploaded file. Remove the file to paste manually.</p>
            )}

            {extractError && (
              <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{extractError}</div>
            )}
          </div>

          {screenError && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{screenError}</div>
          )}

          <button
            type="submit"
            disabled={screening || extracting}
            className="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {screening ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner />
                Screening…
              </span>
            ) : "Screen candidate"}
          </button>
        </form>

        {result && cdp && (
          <div>
            <div className="mb-3">
              <h2 className="text-base font-semibold text-gray-900">{result.name} — screening result</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Saved to history. <Link href="/recruit/candidates" className="text-indigo-600 hover:underline">View all →</Link>
              </p>
            </div>
            <ResultCard s={cdp} />
          </div>
        )}
      </div>
    </main>
  );
}
