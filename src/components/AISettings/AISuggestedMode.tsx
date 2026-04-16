import { FeedbackItem } from '@/components/StudentList/types';

interface AISuggestedModeProps {
  onGenerateSuggestions: () => void;
  isGenerating: boolean;
  hasStudentsWithCode: boolean;
  suggestedFeedback: FeedbackItem[];
  onRemoveSuggestion: (id: number) => void;
  onPromoteSuggestions?: (items: FeedbackItem[]) => void;
}

export default function AISuggestedMode({
  onGenerateSuggestions,
  isGenerating,
  hasStudentsWithCode,
  suggestedFeedback,
  onRemoveSuggestion,
  onPromoteSuggestions,
}: AISuggestedModeProps) {
  return (
    <div className="space-y-4 p-4 rounded-lg" style={{ background: '#222831', border: '1px solid #948979' }}>
      <h4 style={{ color: '#DFD0B8' }} className="font-medium">Step 1 — Discover Criteria</h4>

      <p style={{ color: '#948979' }} className="text-sm">
        AI scans all submissions for common patterns and suggests new feedback criteria.
        Promote the ones you like to use them in the binary evaluation step.
      </p>

      <button
        onClick={onGenerateSuggestions}
        disabled={!hasStudentsWithCode || isGenerating}
        className="w-full px-4 py-2"
      >
        {isGenerating ? 'Analyzing Submissions...' : 'Discover Criteria from Submissions'}
      </button>

      {suggestedFeedback.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 style={{ color: '#DFD0B8' }} className="font-medium text-sm">
              Suggested ({suggestedFeedback.length})
            </h4>
            {onPromoteSuggestions && (
              <button
                onClick={() => onPromoteSuggestions(suggestedFeedback)}
                style={{
                  background: '#2e4a3c',
                  color: '#4caf83',
                  border: '1px solid #4caf83',
                  padding: '3px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Promote All →
              </button>
            )}
          </div>

          <div className="space-y-2">
            {suggestedFeedback.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded"
                style={{ background: '#393E46', border: '1px solid #948979' }}
              >
                <div className="flex-1 min-w-0">
                  <p style={{ color: '#DFD0B8' }} className="text-sm font-medium">{item.comment}</p>
                  <p style={{ color: '#948979' }} className="text-xs mt-1">-{item.grade}pt</p>
                </div>
                <div className="flex gap-2 ml-3 flex-shrink-0">
                  {onPromoteSuggestions && (
                    <button
                      onClick={() => onPromoteSuggestions([item])}
                      title="Add to criteria list"
                      style={{
                        background: '#2e4a3c',
                        color: '#4caf83',
                        border: '1px solid #4caf83',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      + Add
                    </button>
                  )}
                  <button
                    onClick={() => onRemoveSuggestion(item.id)}
                    style={{
                      background: 'none',
                      color: '#948979',
                      border: '1px solid #393E46',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p style={{ color: '#948979' }} className="text-xs">
            Promoted items move to your criteria list and will be evaluated in the binary step.
          </p>
        </div>
      )}
    </div>
  );
}
