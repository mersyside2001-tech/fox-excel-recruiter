"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";

const VERDICT_STYLES: Record<string, string> = {
  "STRONG FIT": "bg-green-100 text-green-800",
  "WORTH INTERVIEWING": "bg-blue-100 text-blue-800",
  BORDERLINE: "bg-amber-100 text-amber-800",
  "NOT SUITABLE": "bg-red-100 text-red-800",
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="font-medium text-gray-700">{value}/10</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full">
        <div className="h-1.5 bg-indigo-500 rounded-full transition-all" style={{ width: `${value * 10}%` }} />
      </div>
    </div>
  );
}

type Screening = {
  role: "AKM" | "CDP";
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

function ResultCard({ s }: { s: Screening }) {
  return (
    <div className="rounded-lg border border-gray-200 p-5 flex flex-col gap-4">
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
            {JSON.parse(s.strengths).map((item: string, i: number) => (
              <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                <span className="text-green-500 shrink-0">✓</span>{item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-red-700 mb-1.5">Concerns</p>
          <ul className="space-y-1">
            {JSON.parse(s.concerns).map((item: string, i: number) => (
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
  const [form, setForm] = useState({ name: "", email: "", cvText: "" });
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<{ name: string; id: string; screenings: Screening[] } | null>(null);
  const [error, setError] = useState("");
  const [extractError, setExtractError] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      setExtractError("Please upload a PDF or .docx file.");
      return;
    }
    setExtracting(true);
    setExtractError("");
    setUploadedFileName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/recruit/extract", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");
      setForm((f) => ({ ...f, cvText: data.text }));
    } catch (err: unknown) {
      setExtractError(err instanceof Error ? err.message : "Extraction failed");
      setUploadedFileName("");
    } finally {
      setExtracting(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function clearFile() {
    setUploadedFileName("");
    setForm((f) => ({ ...f, cvText: "" }));
    setExtractError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cvText.trim()) {
      setExtractError("Please upload a CV or paste the CV text.");
      return;
    }
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/recruit/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Screening failed");
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Screening failed");
    } finally {
      setLoading(false);
    }
  }

  const cdp = result?.screenings?.find((s) => s.role === "CDP");

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
        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-1">Screen a candidate</h2>
          <p className="text-sm text-gray-500 mb-4">Scores against CDP — pub kitchen.</p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Candidate name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="text"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="optional"
              />
            </div>
          </div>

          {/* CV upload */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CV <span className="text-red-500">*</span>
            </label>
            <label
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              className={`mb-3 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-5 cursor-pointer transition-colors
                ${isDragging ? "border-indigo-400 bg-indigo-50" : "border-gray-300 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/40"}
                ${extracting ? "cursor-wait opacity-70 pointer-events-none" : ""}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileInput}
                className="sr-only"
              />
              {extracting ? (
                <div className="flex items-center gap-2 text-sm text-indigo-600">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Extracting text…
                </div>
              ) : uploadedFileName ? (
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-700 font-medium truncate max-w-xs">{uploadedFileName}</span>
                  <button type="button" onClick={(e) => { e.preventDefault(); clearFile(); }} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
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
            </label>
            {extractError && (
              <p className="mb-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{extractError}</p>
            )}
            <div className="relative">
              <textarea
                rows={8}
                value={form.cvText}
                onChange={(e) => { setForm({ ...form, cvText: e.target.value }); if (uploadedFileName) setUploadedFileName(""); }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                placeholder="…or paste CV text here manually"
              />
              {form.cvText && (
                <span className="absolute bottom-2 right-3 text-xs text-gray-300 select-none">{form.cvText.length.toLocaleString()} chars</span>
              )}
            </div>
          </div>

          {error && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || extracting}
            className="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Screening…
              </span>
            ) : "Screen candidate"}
          </button>
        </form>

        {/* Result */}
        {result && cdp && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{result.name} — screening result</h2>
                <p className="text-xs text-gray-500 mt-0.5">Saved to history. <Link href="/recruit/candidates" className="text-indigo-600 hover:underline">View all →</Link></p>
              </div>
            </div>
            <ResultCard s={cdp} />
          </div>
        )}
      </div>
    </main>
  );
}
