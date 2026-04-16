import { useState } from 'react';
import { Student, FeedbackItem } from '@/components/StudentList/types';
import { RequirementVerdict } from '@/lib/llm';

interface CustomPromptModeProps {
  onEvaluate: (exerciseDescription: string) => void;
  onEvaluateBatch: (exerciseDescription: string) => void;
  onApplyRequirements: (studentName: string, indices: number[], exerciseDescription: string) => void;
  onPromoteRequirements: (indices: number[], requirements: RequirementVerdict[]) => void;
  onDismissResults: (studentName: string) => void;
  isGenerating: boolean;
  hasSelectedStudent: boolean;
  hasStudentsWithCode: boolean;
  currentStudent?: Student | null;
  feedbackItems?: FeedbackItem[];
}

const VERDICT_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  'met':      { bg: '#1a3d2e', color: '#4caf83', border: '#4caf83' },
  'not-met':  { bg: '#3d1a1a', color: '#f44336', border: '#f44336' },
  'partial':  { bg: '#3d2e1a', color: '#ff9800', border: '#ff9800' },
  'unsure':   { bg: '#2a2d3d', color: '#64b5f6', border: '#64b5f6' },
};

function VerdictBadge({ verdict }: { verdict: RequirementVerdict['verdict'] }) {
  const s = VERDICT_STYLES[verdict];
  const label = verdict === 'not-met' ? 'NOT MET' : verdict.toUpperCase();
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      padding: '2px 7px', borderRadius: '4px', fontSize: '10px',
      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

export default function CustomPromptMode({
  onEvaluate,
  onEvaluateBatch,
  onApplyRequirements,
  onPromoteRequirements,
  onDismissResults,
  isGenerating,
  hasSelectedStudent,
  hasStudentsWithCode,
  currentStudent,
  feedbackItems = [],
}: CustomPromptModeProps) {
  const [description, setDescription] = useState('');
  const [promptFile, setPromptFile] = useState<File | null>(null);

  const requirements = currentStudent?.aiFeedback?.exerciseRequirements ?? [];
  const hasPendingResults = requirements.length > 0;

  // Pre-select not-met and partial items
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());

  // Reset confirmed when new results arrive for a different student
  const [lastStudentName, setLastStudentName] = useState<string | null>(null);
  if (currentStudent?.name !== lastStudentName && hasPendingResults) {
    setLastStudentName(currentStudent?.name ?? null);
    const preselected = new Set<number>();
    requirements.forEach((r, i) => {
      if (r.verdict === 'not-met' || r.verdict === 'partial') preselected.add(i);
    });
    setConfirmed(preselected);
  }

  const toggle = (i: number) => {
    setConfirmed(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      setDescription(content);
      setPromptFile(file);
    } catch {
      alert('Failed to read the file. Please try again.');
    }
  };

  // ── Results view ───────────────────────────────────────────────────────────
  if (hasPendingResults && currentStudent) {
    const overall = currentStudent.aiFeedback?.overallComments ?? [];
    const reasoning = currentStudent.aiFeedback?.reasoning ?? '';

    return (
      <div style={{ background: '#222831', border: '1px solid #948979', borderRadius: '8px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          background: '#2a2f38', padding: '10px 14px',
          borderBottom: '1px solid #4a5568',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ color: '#DFD0B8', fontWeight: 700, fontSize: '13px' }}>
              Exercise Requirements
            </span>
            <span style={{ color: '#948979', fontSize: '11px', marginLeft: '8px' }}>
              {currentStudent.name}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: '#948979', fontSize: '11px', alignSelf: 'center' }}>
              {confirmed.size} selected
            </span>
            <button
              onClick={() => onDismissResults(currentStudent.name)}
              style={{
                background: 'none', border: '1px solid #393E46', color: '#948979',
                padding: '3px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer',
              }}
            >
              ✕ Clear
            </button>
          </div>
        </div>

        {/* Reasoning */}
        {reasoning && (
          <div style={{ padding: '8px 14px', background: '#1c2028', borderBottom: '1px solid #393E46' }}>
            <p style={{ color: '#948979', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>
              <strong style={{ color: '#DFD0B8' }}>Summary: </strong>{reasoning}
            </p>
          </div>
        )}

        {/* Requirements list */}
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '320px', overflowY: 'auto' }}>
          {requirements.map((req, i) => {
            const isConfirmed = confirmed.has(i);
            const clickable = req.verdict !== 'met';
            return (
              <div
                key={i}
                onClick={() => clickable && toggle(i)}
                style={{
                  background: isConfirmed ? '#1e2a22' : '#222831',
                  border: `1px solid ${isConfirmed ? '#4caf83' : '#393E46'}`,
                  borderRadius: '6px', padding: '8px 10px',
                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                  cursor: clickable ? 'pointer' : 'default',
                  opacity: req.verdict === 'met' ? 0.6 : 1,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={isConfirmed}
                  disabled={!clickable}
                  onChange={() => toggle(i)}
                  onClick={e => e.stopPropagation()}
                  style={{ marginTop: '2px', cursor: clickable ? 'pointer' : 'default', accentColor: '#4caf83', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#DFD0B8', fontSize: '12px', fontWeight: 600 }}>
                      {req.requirement}
                    </span>
                    {req.suggestedDeduction > 0 && (
                      <span style={{ color: '#948979', fontSize: '10px' }}>-{req.suggestedDeduction}pt</span>
                    )}
                  </div>
                  {req.comment && (
                    <p style={{ color: '#948979', fontSize: '11px', margin: '3px 0 0', lineHeight: 1.4 }}>
                      {req.comment}
                    </p>
                  )}
                </div>
                <VerdictBadge verdict={req.verdict} />
              </div>
            );
          })}
        </div>

        {/* Overall comments */}
        {overall.length > 0 && (
          <div style={{ padding: '6px 14px', borderTop: '1px solid #393E46' }}>
            {overall.map((c, i) => (
              <p key={i} style={{ color: '#948979', fontSize: '11px', margin: '2px 0' }}>• {c}</p>
            ))}
          </div>
        )}

        {/* Action bar */}
        <div style={{
          padding: '8px 12px', borderTop: '1px solid #393E46',
          display: 'flex', gap: '6px',
        }}>
          <button
            onClick={() => {
              onApplyRequirements(currentStudent.name, [...confirmed], description);
              onDismissResults(currentStudent.name);
            }}
            disabled={confirmed.size === 0}
            style={{
              flex: 1, padding: '7px',
              borderRadius: '6px',
              background: confirmed.size > 0 ? '#2e4a3c' : '#2a2f38',
              color: confirmed.size > 0 ? '#4caf83' : '#555',
              border: `1px solid ${confirmed.size > 0 ? '#4caf83' : '#393E46'}`,
              cursor: confirmed.size > 0 ? 'pointer' : 'not-allowed',
              fontSize: '12px', fontWeight: 600,
            }}
          >
            Apply {confirmed.size} to Student
          </button>
          <button
            onClick={() => {
              const selectedReqs = [...confirmed].map(i => requirements[i]);
              onPromoteRequirements([...confirmed], selectedReqs);
            }}
            disabled={confirmed.size === 0}
            title="Turn selected into permanent feedback criteria"
            style={{
              padding: '7px 10px', borderRadius: '6px',
              background: confirmed.size > 0 ? '#2d3a4a' : '#2a2f38',
              color: confirmed.size > 0 ? '#64b5f6' : '#555',
              border: `1px solid ${confirmed.size > 0 ? '#64b5f6' : '#393E46'}`,
              cursor: confirmed.size > 0 ? 'pointer' : 'not-allowed',
              fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
            }}
          >
            → Criteria
          </button>
        </div>
      </div>
    );
  }

  // ── Input view ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 p-4 rounded-lg" style={{ background: '#222831', border: '1px solid #948979' }}>
      <div>
        <h4 style={{ color: '#DFD0B8' }} className="font-medium">Step 3 — Exercise Description</h4>
        <p style={{ color: '#948979' }} className="text-sm mt-1">
          Paste the actual assignment description or problem statement. AI will extract
          every requirement and evaluate the student's code against each one.
        </p>
      </div>

      <div className="space-y-2">
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={`Paste the exercise description here…\n\nExample:\nWrite a Python program that:\n- Asks the user for their name and age\n- Prints a greeting using their name\n- Calculates and prints the year they were born\n- Handles non-numeric age input gracefully`}
          className="w-full px-3 py-2 rounded text-sm font-mono resize-y"
          rows={8}
          style={{ background: '#393E46', color: '#DFD0B8', border: '1px solid #948979' }}
        />

        <label className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-sm w-fit"
          style={{ background: '#393E46', color: '#DFD0B8', border: '1px solid #948979' }}>
          Upload .txt / .md
          <input type="file" accept=".txt,.md" onChange={handleFileUpload} className="hidden" />
        </label>
        {promptFile && (
          <span style={{ color: '#948979' }} className="text-xs">Loaded: {promptFile.name}</span>
        )}
      </div>

      <div className="space-y-2">
        <button
          onClick={() => onEvaluate(description)}
          disabled={!hasSelectedStudent || isGenerating || !description.trim()}
          className="w-full px-4 py-2"
        >
          {isGenerating ? 'Evaluating…' : 'Evaluate Selected Student'}
        </button>
        <button
          onClick={() => onEvaluateBatch(description)}
          disabled={!hasStudentsWithCode || isGenerating || !description.trim()}
          className="w-full px-4 py-2"
        >
          {isGenerating ? 'Running batch…' : 'Evaluate All Students (auto-apply NOT MET)'}
        </button>
      </div>

      {/* Already-known criteria warning */}
      {feedbackItems.length > 0 && (
        <p style={{ color: '#948979' }} className="text-xs">
          Tip: Requirements marked NOT MET can be promoted to your criteria list so they
          appear in the binary evaluation step for future batches.
        </p>
      )}
    </div>
  );
}
