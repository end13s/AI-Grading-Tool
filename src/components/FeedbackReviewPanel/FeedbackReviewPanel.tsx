import { useState } from 'react';
import { FeedbackItem, Student } from '@/components/StudentList/types';

interface FeedbackReviewPanelProps {
  student: Student;
  feedbackItems: FeedbackItem[];
  onApply: (confirmedIds: number[]) => void;
  onDismiss: () => void;
}

const VERDICT_STYLES: Record<string, React.CSSProperties> = {
  yes: { background: '#1a3d2e', color: '#4caf83', border: '1px solid #4caf83' },
  no: { background: '#3d1a1a', color: '#f44336', border: '1px solid #f44336' },
  unsure: { background: '#3d3020', color: '#ff9800', border: '1px solid #ff9800' },
};

function VerdictBadge({ verdict }: { verdict: 'yes' | 'no' | 'unsure' }) {
  return (
    <span style={{
      ...VERDICT_STYLES[verdict],
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '10px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      flexShrink: 0,
    }}>
      {verdict}
    </span>
  );
}

export default function FeedbackReviewPanel({
  student,
  feedbackItems,
  onApply,
  onDismiss,
}: FeedbackReviewPanelProps) {
  const responses = student.aiFeedback?.feedbackResponses ?? {};
  const reasoning = student.aiFeedback?.reasoning ?? '';
  const overallComments = student.aiFeedback?.overallComments ?? [];

  // Pre-select items where AI said "yes"
  const [confirmed, setConfirmed] = useState<Set<number>>(() => {
    const s = new Set<number>();
    for (const [idStr, verdict] of Object.entries(responses)) {
      if (verdict === 'yes') s.add(Number(idStr));
    }
    return s;
  });

  const toggle = (id: number) => {
    setConfirmed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setConfirmed(new Set(
      feedbackItems
        .filter(item => responses[item.id] === 'yes' || responses[item.id] === 'unsure')
        .map(item => item.id)
    ));
  };

  const selectNone = () => setConfirmed(new Set());

  // Sort: yes first, then unsure, then no, then unrated
  const verdictOrder = { yes: 0, unsure: 1, no: 2 };
  const sortedItems = [...feedbackItems].sort((a, b) => {
    const ra = responses[a.id];
    const rb = responses[b.id];
    const va = ra ? verdictOrder[ra] : 3;
    const vb = rb ? verdictOrder[rb] : 3;
    return va - vb;
  });

  const itemsWithVerdict = sortedItems.filter(item => responses[item.id]);
  const itemsWithoutVerdict = sortedItems.filter(item => !responses[item.id]);

  return (
    <div style={{
      background: '#2a2f38',
      borderRadius: '8px',
      border: '1px solid #4a5568',
      display: 'flex',
      flexDirection: 'column',
      gap: '0',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: '#393E46',
        padding: '12px 16px',
        borderBottom: '1px solid #4a5568',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h4 style={{ color: '#DFD0B8', fontWeight: 700, fontSize: '14px', margin: 0 }}>
            AI Feedback Review
          </h4>
          <span style={{ color: '#948979', fontSize: '11px' }}>{student.name}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={selectAll}
            style={{ background: 'none', border: '1px solid #948979', color: '#948979', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
          >
            All Yes/Unsure
          </button>
          <button
            onClick={selectNone}
            style={{ background: 'none', border: '1px solid #948979', color: '#948979', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
          >
            None
          </button>
        </div>
      </div>

      {/* Reasoning */}
      {reasoning && (
        <div style={{ padding: '10px 16px', background: '#222831', borderBottom: '1px solid #393E46' }}>
          <span style={{ color: '#948979', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            AI Reasoning
          </span>
          <p style={{ color: '#948979', fontSize: '12px', lineHeight: 1.5, margin: '4px 0 0' }}>
            {reasoning}
          </p>
        </div>
      )}

      {/* Overall comments */}
      {overallComments.length > 0 && (
        <div style={{ padding: '10px 16px', background: '#222831', borderBottom: '1px solid #393E46' }}>
          <span style={{ color: '#948979', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Overall Comments
          </span>
          {overallComments.map((c, i) => (
            <p key={i} style={{ color: '#948979', fontSize: '12px', lineHeight: 1.5, margin: '4px 0 0' }}>
              • {c}
            </p>
          ))}
        </div>
      )}

      {/* Feedback items list */}
      <div style={{ padding: '8px 12px', overflowY: 'auto', maxHeight: '340px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {itemsWithVerdict.length === 0 ? (
          <p style={{ color: '#948979', fontSize: '13px', padding: '8px 4px' }}>
            No feedback criteria were evaluated.
          </p>
        ) : (
          itemsWithVerdict.map(item => {
            const verdict = responses[item.id];
            const isConfirmed = confirmed.has(item.id);
            const clickable = verdict !== 'no';

            return (
              <div
                key={item.id}
                onClick={() => clickable && toggle(item.id)}
                style={{
                  background: isConfirmed ? '#1e2e26' : '#222831',
                  border: `1px solid ${isConfirmed ? '#4caf83' : '#393E46'}`,
                  borderRadius: '6px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  opacity: verdict === 'no' ? 0.55 : 1,
                  cursor: clickable ? 'pointer' : 'default',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={isConfirmed}
                  disabled={!clickable}
                  onChange={() => toggle(item.id)}
                  onClick={e => e.stopPropagation()}
                  style={{ cursor: clickable ? 'pointer' : 'default', accentColor: '#4caf83', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: '#DFD0B8', fontSize: '13px' }}>{item.comment}</span>
                  <span style={{ color: '#948979', fontSize: '11px', marginLeft: '8px' }}>
                    -{item.grade}pt
                  </span>
                </div>
                <VerdictBadge verdict={verdict} />
              </div>
            );
          })
        )}

        {itemsWithoutVerdict.length > 0 && (
          <p style={{ color: '#948979', fontSize: '11px', padding: '4px', marginTop: '2px' }}>
            {itemsWithoutVerdict.length} item(s) not evaluated by AI.
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid #393E46',
        display: 'flex',
        gap: '8px',
      }}>
        <button
          onClick={() => onApply([...confirmed])}
          disabled={confirmed.size === 0}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: '6px',
            background: confirmed.size > 0 ? '#2e4a3c' : '#2a2f38',
            color: confirmed.size > 0 ? '#4caf83' : '#555',
            border: `1px solid ${confirmed.size > 0 ? '#4caf83' : '#393E46'}`,
            cursor: confirmed.size > 0 ? 'pointer' : 'not-allowed',
            fontSize: '13px',
            fontWeight: 600,
            transition: 'all 0.15s',
          }}
        >
          Apply {confirmed.size} Item{confirmed.size !== 1 ? 's' : ''}
        </button>
        <button
          onClick={onDismiss}
          style={{
            padding: '8px 14px',
            borderRadius: '6px',
            background: 'none',
            color: '#948979',
            border: '1px solid #393E46',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
