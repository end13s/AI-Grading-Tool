import { useState } from 'react';
import AISettingsTabs, { AIMode } from './AISettingsTabs';
import CustomPromptMode from './CustomPromptMode';
import AISuggestedMode from './AISuggestedMode';
import { FeedbackItem } from '@/components/StudentList/types';

interface AISettingsProps {
  onGenerateFeedback: () => void;
  onGenerateBatchFeedback: () => void;
  onGenerateWithCustomPrompt?: (prompt: string) => void;
  onGenerateAISuggestions?: () => void;
  isGenerating: boolean;
  hasSelectedStudent: boolean;
  hasStudentsWithCode: boolean;
  suggestedFeedback?: FeedbackItem[];
  onRemoveSuggestion?: (id: number) => void;
}

export default function AISettings({
  onGenerateFeedback,
  onGenerateBatchFeedback,
  onGenerateWithCustomPrompt,
  onGenerateAISuggestions,
  isGenerating,
  hasSelectedStudent,
  hasStudentsWithCode,
  suggestedFeedback = [],
  onRemoveSuggestion
}: AISettingsProps) {
  const [currentMode, setCurrentMode] = useState<AIMode>('predefined');

  return (
    <div className="ai-settings-panel space-y-4" style={{ background: '#393E46', padding: '20px', borderRadius: '8px' }}>
      <h3 style={{ color: '#DFD0B8' }} className="font-semibold text-lg">AI Feedback Settings</h3>

      {/* Status Indicator */}
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ background: '#948979' }}></div>
        <span style={{ color: '#DFD0B8' }} className="text-sm">AI Ready</span>
      </div>

      {/* Tabs */}
      <AISettingsTabs currentMode={currentMode} onModeChange={setCurrentMode} />

      {/* Tab Content */}
      <div className="pb-4">
        {currentMode === 'predefined' && (
          <div className="space-y-4 p-4 rounded-lg" style={{ background: '#222831', border: '1px solid #948979' }}>
            <h4 style={{ color: '#DFD0B8' }} className="font-medium">Predefined Feedback Mode</h4>
            <p style={{ color: '#948979' }} className="text-sm">
              AI evaluates code against your predefined feedback criteria with Yes/No/Unsure responses.
            </p>

            <div className="space-y-2">
              <button
                onClick={onGenerateFeedback}
                disabled={!hasSelectedStudent || isGenerating}
                className="w-full px-4 py-2"
              >
                {isGenerating ? 'Generating...' : 'Generate AI Feedback (Selected Student)'}
              </button>

              <button
                onClick={onGenerateBatchFeedback}
                disabled={!hasStudentsWithCode || isGenerating}
                className="w-full px-4 py-2"
              >
                {isGenerating ? 'Generating...' : 'Generate Batch Feedback (All Students)'}
              </button>
            </div>

            {!hasStudentsWithCode && (
              <p style={{ color: '#948979' }} className="text-sm">
                Import student submissions (ZIP) to enable AI feedback
              </p>
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
          />
        )}

        {currentMode === 'custom-prompt' && (
          <CustomPromptMode
            onGenerateFeedback={onGenerateWithCustomPrompt || ((prompt) => alert(`Custom prompt: ${prompt}`))}
            isGenerating={isGenerating}
            hasSelectedStudent={hasSelectedStudent}
            hasStudentsWithCode={hasStudentsWithCode}
          />
        )}
      </div>
    </div>
  );
}
