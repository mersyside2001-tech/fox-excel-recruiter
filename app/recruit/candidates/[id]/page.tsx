import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

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
        <div className="h-1.5 bg-indigo-500 rounded-full" style={{ width: `${value * 10}%` }} />
      </div>
    </div>
  );
}

type Screening = {
  id: string;
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

export default async function CandidateDetailPage({ params }: { params: { id: string } }) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: { screenings: true },
  });

  if (!candidate) notFound();

  const cdp = candidate.screenings.find((s) => s.role === "CDP") as Screening | undefined;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Fox Excel Recruiter</h1>
          <p className="text-sm text-gray-500">Candidate detail</p>
        </div>
        <Link href="/recruit/candidates" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          ← Screening history
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Candidate header */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
          <h2 className="text-xl font-semibold text-gray-900">{candidate.name}</h2>
          {candidate.email && <p className="text-sm text-gray-500 mt-0.5">{candidate.email}</p>}
          <p className="text-xs text-gray-400 mt-1">
            Screened {new Date(candidate.createdAt).toLocaleDateString("en-GB", {
              day: "numeric", month: "long", year: "numeric",
            })} at {new Date(candidate.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        {/* CDP result */}
        {cdp ? (
          <div className="mb-4">
            <ResultCard s={cdp} />
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-4">No screening result found.</p>
        )}

        {/* Raw CV */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <details>
            <summary className="text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none">
              View raw CV
            </summary>
            <pre className="mt-3 text-xs text-gray-600 bg-gray-50 rounded p-3 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
              {candidate.cvText}
            </pre>
          </details>
        </div>
      </div>
    </main>
  );
}
