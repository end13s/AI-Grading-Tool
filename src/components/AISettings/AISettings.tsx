import { useState } from 'react';
import AISettingsTabs, { AIMode } from './AISettingsTabs';
import CustomPromptMode from './CustomPromptMode';
import AISuggestedMode from './AISuggestedMode';
import FeedbackReviewPanel from '@/components/FeedbackReviewPanel/FeedbackReviewPanel';
import { FeedbackItem, Student } from '@/components/StudentList/types';
import { RequirementVerdict } from '@/lib/llm';

interface AISettingsProps {
  onGenerateFeedback: () => void;
  onGenerateBatchFeedback: () => void;
  onGenerateAISuggestions?: () => void;
  onStopGeneration?: () => void;
  isGenerating: boolean;
  hasSelectedStudent: boolean;
  hasStudentsWithCode: boolean;
  suggestedFeedback?: FeedbackItem[];
  onRemoveSuggestion?: (id: number) => void;
  onPromoteSuggestions?: (items: FeedbackItem[]) => void;
  currentStudent?: Student | null;
  feedbackItems?: FeedbackItem[];
  onApplyReview?: (studentName: string, confirmedIds: number[]) => void;
  onDismissReview?: (studentName: string) => void;
  // Exercise-description evaluation
  onEvaluateExercise?: (exerciseDescription: string) => void;
  onEvaluateExerciseBatch?: (exerciseDescription: string) => void;
  onApplyExerciseRequirements?: (studentName: string, indices: number[], exerciseDescription: string) => void;
  onPromoteExerciseRequirements?: (indices: number[], requirements: RequirementVerdict[]) => void;
  onDismissExerciseResults?: (studentName: string) => void;
}

export default function AISettings({
  onGenerateFeedback,
  onGenerateBatchFeedback,
  onGenerateAISuggestions,
  onStopGeneration,
  isGenerating,
  hasSelectedStudent,
  hasStudentsWithCode,
  suggestedFeedback = [],
  onRemoveSuggestion,
  onPromoteSuggestions,
  currentStudent,
  feedbackItems = [],
  onApplyReview,
  onDismissReview,
  onEvaluateExercise,
  onEvaluateExerciseBatch,
  onApplyExerciseRequirements,
  onPromoteExerciseRequirements,
  onDismissExerciseResults,
}: AISettingsProps) {
  const [currentMode, setCurrentMode] = useState<AIMode>('predefined');

  const hasPendingReview =
    currentMode === 'predefined' &&
    !!currentStudent?.aiFeedback?.feedbackResponses &&
    Object.keys(currentStudent.aiFeedback.feedbackResponses).length > 0;

  return (
    <div className="ai-settings-panel space-y-4" style={{ background: '#393E46', padding: '20px', borderRadius: '8px' }}>
      <h3 style={{ color: '#DFD0B8' }} className="font-semibold text-lg">AI Feedback Settings</h3>

      {/* Status Indicator */}
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ background: '#948979' }}></div>
        <span style={{ color: '#DFD0B8' }} className="text-sm">AI Ready</span>
      </div>

      {isGenerating && onStopGeneration && (
        <button
          onClick={onStopGeneration}
          className="w-full px-4 py-2"
          style={{ background: '#8B0000', border: '1px solid #A00000' }}
        >
          Stop Generation
        </button>
      )}

      {/* Tabs */}
      <AISettingsTabs currentMode={currentMode} onModeChange={setCurrentMode} />

      {/* Tab Content */}
      <div className="pb-4">
        {currentMode === 'predefined' && (
          <div className="space-y-4">
            {/* Review panel — shown when AI has evaluated the selected student */}
            {hasPendingReview && currentStudent ? (
              <FeedbackReviewPanel
                student={currentStudent}
                feedbackItems={feedbackItems}
                onApply={(ids) => {
                  onApplyReview?.(currentStudent.name, ids);
                  onDismissReview?.(currentStudent.name);
                }}
                onDismiss={() => onDismissReview?.(currentStudent.name)}
              />
            ) : (
              <div className="space-y-4 p-4 rounded-lg" style={{ background: '#222831', border: '1px solid #948979' }}>
                <h4 style={{ color: '#DFD0B8' }} className="font-medium">Predefined Feedback — Binary Evaluation</h4>
                <p style={{ color: '#948979' }} className="text-sm">
                  AI evaluates the student's code against each feedback criterion and returns Yes / No / Unsure.
                  You review and confirm before anything is applied.
                </p>

                <div className="space-y-2">
                  <button
                    onClick={onGenerateFeedback}
                    disabled={!hasSelectedStudent || isGenerating}
                    className="w-full px-4 py-2"
                  >
                    {isGenerating ? 'Evaluating...' : 'Evaluate Selected Student'}
                  </button>

                  <button
                    onClick={onGenerateBatchFeedback}
                    disabled={!hasStudentsWithCode || isGenerating}
                    className="w-full px-4 py-2"
                  >
                    {isGenerating ? 'Running batch...' : 'Auto-Apply to All Students (YES only)'}
                  </button>
                </div>

                {!hasStudentsWithCode && (
                  <p style={{ color: '#948979' }} className="text-sm">
                    Import student submissions (ZIP) to enable AI feedback.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {currentMode === 'ai-suggested' && (
          <AISuggestedMode
            onGenerateSuggestions={onGenerateAISuggestions || (() => alert('Not implemented yet'))}
            isGenerating={isGenerating}
            hasStudentsWithCode={hasStudentsWithCode}
            suggestedFeedback={suggestedFeedback}
            onRemoveSuggestion={onRemoveSuggestion || (() => {})}
            onPromoteSuggestions={onPromoteSuggestions}
          />
        )}

        {currentMode === 'custom-prompt' && (
          <CustomPromptMode
            onEvaluate={onEvaluateExercise || (() => {})}
            onEvaluateBatch={onEvaluateExerciseBatch || (() => {})}
            onApplyRequirements={onApplyExerciseRequirements || (() => {})}
            onPromoteRequirements={onPromoteExerciseRequirements || (() => {})}
            onDismissResults={onDismissExerciseResults || (() => {})}
            isGenerating={isGenerating}
            hasSelectedStudent={hasSelectedStudent}
            hasStudentsWithCode={hasStudentsWithCode}
            currentStudent={currentStudent}
            feedbackItems={feedbackItems}
          />
        )}
      </div>
    </div>
  );
}
