import { useState } from 'react';
import Papa, { ParseResult } from 'papaparse';
import { ZyBooksLabPart, ZyBooksSession } from '@/components/StudentList/types';

// Matches columns like "8.10 - Lab (10)" or "8.11 - Lab (90)"
const LAB_COLUMN_REGEX = /^(\d+\.\d+)\s*-\s*Lab\s*\((\d+)\)$/i;

// Matches "Lab total (X)" to extract total points
const LAB_TOTAL_REGEX = /^Lab\s+total\s*\((\d+)\)$/i;

/**
 * Parses the ZyBooks CSV and returns a ZyBooksSession describing
 * all detected lab parts and their per-student scores.
 */
export const useZyBooksCSVHandling = () => {
  const [error, setError] = useState<string>('');
  const [session, setSession] = useState<ZyBooksSession | null>(null);

  const parseZyBooksCSV = (content: string): ZyBooksSession | null => {
    let result: ZyBooksSession | null = null;

    Papa.parse<string[]>(content, {
      header: false,
      skipEmptyLines: true,
      complete: (parsed: ParseResult<string[]>) => {
        const rows = parsed.data;
        if (rows.length < 2) {
          setError('ZyBooks CSV is empty or has no student rows.');
          return;
        }

        const headers = rows[0];

        // ── Locate key columns ───────────────────────────────────────────────
        const schoolEmailIdx = headers.findIndex(
          h => h.trim().toLowerCase() === 'school email'
        );
        if (schoolEmailIdx === -1) {
          setError('ZyBooks CSV is missing the "School email" column.');
          return;
        }

        // Find total points from "Lab total (X)"
        let totalPoints = 0;
        const labTotalIdx = headers.findIndex(h => LAB_TOTAL_REGEX.test(h.trim()));
        if (labTotalIdx !== -1) {
          const match = headers[labTotalIdx].trim().match(LAB_TOTAL_REGEX);
          if (match) totalPoints = parseInt(match[1], 10);
        }

        // ── Detect lab part columns ──────────────────────────────────────────
        const labColumns: Array<{ index: number; id: string; name: string; sectionNumber: number; maxPoints: number }> = [];

        headers.forEach((header, idx) => {
          const match = header.trim().match(LAB_COLUMN_REGEX);
          if (match) {
            labColumns.push({
              index: idx,
              id: header.trim(),
              name: `${match[1]} - Lab`,
              sectionNumber: parseFloat(match[1]),
              maxPoints: parseInt(match[2], 10),
            });
          }
        });

        if (labColumns.length === 0) {
          setError('No lab part columns found in ZyBooks CSV. Expected format: "8.11 - Lab (90)"');
          return;
        }

        // Sort lab columns by section number
        labColumns.sort((a, b) => a.sectionNumber - b.sectionNumber);

        // ── Build per-student score maps ─────────────────────────────────────
        const labParts: ZyBooksLabPart[] = labColumns.map(col => ({
          id: col.id,
          name: col.name,
          sectionNumber: col.sectionNumber,
          maxPoints: col.maxPoints,
          isAutoGraded: false,
          zyBooksScores: {},
          submissionsLoaded: false,
          manualGrades: {},
        }));

        // Process student rows (skip header row)
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const schoolEmail = (row[schoolEmailIdx] || '').trim().toLowerCase();
          if (!schoolEmail) continue;

          labColumns.forEach((col, partIdx) => {
            const rawScore = (row[col.index] || '0').trim();
            const score = parseFloat(rawScore);
            labParts[partIdx].zyBooksScores[schoolEmail] = isNaN(score) ? 0 : score;
          });
        }

        // ── Auto-graded heuristic ────────────────────────────────────────────
        // If ALL non-zero scores for a part are round numbers (multiples of 1
        // with no decimals), it's likely a participation/quiz activity.
        labParts.forEach(part => {
          const scores = Object.values(part.zyBooksScores).filter(s => s > 0);
          if (scores.length === 0) return;
          const allRound = scores.every(s => Number.isInteger(s) || s % 1 === 0);
          if (allRound) part.isAutoGraded = true;
        });

        if (totalPoints === 0) {
          totalPoints = labParts.reduce((sum, p) => sum + p.maxPoints, 0);
        }

        result = {
          totalPoints,
          labs: labParts,
          activeLabId: null,
        };
      },
      error: (err: Error) => {
        setError(`CSV parse error: ${err.message}`);
      },
    });

    return result;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    file.text().then(content => {
      const parsed = parseZyBooksCSV(content);
      if (parsed) {
        setSession(parsed);
      }
    }).catch(() => {
      setError('Failed to read the ZyBooks CSV file.');
    });

    // Reset input so the same file can be re-imported
    e.target.value = '';
  };

  return { error, session, setSession, handleFileChange };
};
