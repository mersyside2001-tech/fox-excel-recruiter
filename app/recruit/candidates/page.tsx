import { prisma } from "../../lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

const VERDICT_STYLES: Record<string, string> = {
  "STRONG FIT": "bg-green-100 text-green-800",
  "WORTH INTERVIEWING": "bg-blue-100 text-blue-800",
  BORDERLINE: "bg-amber-100 text-amber-800",
  "NOT SUITABLE": "bg-red-100 text-red-800",
};

function VerdictBadge({ verdict }: { verdict: string }) {
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${VERDICT_STYLES[verdict] ?? "bg-gray-100 text-gray-700"}`}>
      {verdict}
    </span>
  );
}

export default async function CandidatesPage() {
  const candidates = await prisma.candidate.findMany({
    include: { screenings: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Fox Excel Recruiter</h1>
          <p className="text-sm text-gray-500">Screening history</p>
        </div>
        <Link href="/recruit" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          ← Screen a candidate
        </Link>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {candidates.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">No candidates screened yet.</p>
            <Link href="/recruit" className="mt-2 inline-block text-sm text-indigo-600 hover:underline">
              Screen your first candidate →
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Candidate</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 w-56">CDP verdict</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">Date</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {candidates.map((c) => {
                  const cdp = c.screenings.find((s) => s.role === "CDP");
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/recruit/candidates/${c.id}`} className="block">
                          <span className="font-medium text-gray-900 hover:text-indigo-600">{c.name}</span>
                          {c.email && <span className="block text-xs text-gray-400">{c.email}</span>}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {cdp ? (
                          <div className="flex flex-col items-center gap-1">
                            <VerdictBadge verdict={cdp.verdict} />
                            <span className="text-xs text-gray-500">{cdp.overallScore}/10</span>
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(c.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/recruit/candidates/${c.id}`} className="text-gray-300 hover:text-indigo-500 text-xs">
                          →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
