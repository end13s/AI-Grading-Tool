import { FeedbackItem } from '@/components/StudentList/types';

interface AISuggestedModeProps {
  onGenerateSuggestions: () => void;
  isGenerating: boolean;
  hasStudentsWithCode: boolean;
  suggestedFeedback: FeedbackItem[];
  onRemoveSuggestion: (id: number) => void;
}

export default function AISuggestedMode({
  onGenerateSuggestions,
  isGenerating,
  hasStudentsWithCode,
  suggestedFeedback,
  onRemoveSuggestion
}: AISuggestedModeProps) {
  return (
    <div className="space-y-4 p-4 rounded-lg" style={{ background: '#222831', border: '1px solid #948979' }}>
      <h3 style={{ color: '#DFD0B8' }} className="font-semibold text-lg">AI-Suggested Feedback</h3>

      <p style={{ color: '#948979' }} className="text-sm">
        The AI will analyze all student submissions and recommend new feedback criteria based on common patterns.
      </p>

      <button
        onClick={onGenerateSuggestions}
        disabled={!hasStudentsWithCode || isGenerating}
        className="w-full px-4 py-2"
      >
        {isGenerating ? 'Analyzing Submissions...' : 'Generate AI Suggestions'}
      </button>

      {suggestedFeedback.length > 0 && (
        <div className="space-y-2">
          <h4 style={{ color: '#DFD0B8' }} className="font-medium text-sm">Suggested Feedback (Temporary):</h4>
          <div className="space-y-2">
            {suggestedFeedback.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded"
                style={{ background: '#393E46', border: '1px solid #948979' }}
              >
                <div className="flex-1">
                  <p style={{ color: '#DFD0B8' }} className="text-sm font-medium">{item.comment}</p>
                  <p style={{ color: '#948979' }} className="text-xs mt-1">Points: {item.grade}</p>
                </div>
                <button
                  onClick={() => onRemoveSuggestion(item.id)}
                  className="ml-3 px-3 py-1 text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ color: '#948979' }} className="text-xs space-y-1">
        <p>Note: AI-suggested feedback items are temporary and will be removed on reset.</p>
        <p>They appear with a different style to distinguish them from predefined feedback.</p>
      </div>
    </div>
  );
}
