import { useState } from 'react';
import CodeViewer from '../CodeViewer/CodeViewer';
import { Student, FeedbackItem } from '@/components/StudentList/types';
import { Feedback } from '@/lib/llm';

interface StudentCodePanelProps {
  student: Student | null;
  feedbackItems?: FeedbackItem[];
  onPreviousStudent?: () => void;
  onNextStudent?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export default function StudentCodePanel({
  student,
  feedbackItems = [],
  onPreviousStudent,
  onNextStudent,
  hasPrevious = false,
  hasNext = false
}: StudentCodePanelProps) {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  if (!student) {
    return (
      <div className="h-full flex items-center justify-center rounded-lg" style={{ background: '#393E46' }}>
        <div className="text-center" style={{ color: '#948979' }}>
          <p className="text-lg font-medium">No Student Selected</p>
          <p className="text-sm">Select a student to view their code</p>
        </div>
      </div>
    );
  }

  if (!student.submissionFiles || student.submissionFiles.length === 0) {
    return (
      <div className="h-full flex items-center justify-center rounded-lg" style={{ background: '#393E46' }}>
        <div className="text-center" style={{ color: '#948979' }}>
          <p className="text-lg font-medium">No Code Submission</p>
          <p className="text-sm">{student.name} has not submitted code yet</p>
        </div>
      </div>
    );
  }

  const currentFile = student.submissionFiles[selectedFileIndex];
  const feedback: Feedback | undefined = student.aiFeedback;

  return (
    <div className="h-full flex flex-col rounded-lg overflow-hidden" style={{ background: '#222831' }}>
      {/* Header with Navigation */}
      <div className="p-4" style={{ background: '#393E46', borderBottom: '1px solid #948979' }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg" style={{ color: '#DFD0B8' }}>{student.name}</h3>
          <div className="flex gap-2">
            <button
              onClick={onPreviousStudent}
              disabled={!hasPrevious}
              className="px-3 py-1 rounded text-sm"
              title="Previous Student"
            >
              ← Previous
            </button>
            <button
              onClick={onNextStudent}
              disabled={!hasNext}
              className="px-3 py-1 rounded text-sm"
              title="Next Student"
            >
              Next →
            </button>
          </div>
        </div>
        <p className="text-sm" style={{ color: '#948979' }}>{student.email}</p>
        {student.submissionDate && (
          <p className="text-xs mt-1" style={{ color: '#948979' }}>
            Submitted: {student.submissionDate}
          </p>
        )}
      </div>

      {/* File Selector */}
      {student.submissionFiles.length > 1 && (
        <div className="px-4 py-2" style={{ background: '#393E46', borderBottom: '1px solid #948979' }}>
          <select
            value={selectedFileIndex}
            onChange={(e) => setSelectedFileIndex(Number(e.target.value))}
            className="w-full px-3 py-2 rounded focus:outline-none"
            style={{ background: '#222831', color: '#DFD0B8', border: '1px solid #948979' }}
          >
            {student.submissionFiles.map((file, index) => (
              <option key={index} value={index}>
                {file.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* AI Feedback Section */}
      {student.aiFeedback && (
        <div className="px-4 py-3 space-y-2" style={{ background: '#393E46', borderBottom: '1px solid #948979' }}>
          <h4 className="font-medium text-sm" style={{ color: '#DFD0B8' }}>AI Feedback Summary</h4>

          {student.aiFeedback.reasoning && (
            <div className="rounded p-2" style={{ background: '#222831', border: '1px solid #948979' }}>
              <p className="text-xs font-medium mb-1" style={{ color: '#DFD0B8' }}>AI Assessment Reasoning:</p>
              <p className="text-sm" style={{ color: '#948979' }}>{student.aiFeedback.reasoning}</p>
            </div>
          )}

          {student.aiFeedback.feedbackResponses && Object.keys(student.aiFeedback.feedbackResponses).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium" style={{ color: '#DFD0B8' }}>Feedback Criteria Assessment:</p>
              <div className="grid grid-cols-1 gap-1">
                {Object.entries(student.aiFeedback.feedbackResponses).map(([feedbackId, response]) => {
                  const item = feedbackItems.find(f => f.id === Number(feedbackId));
                  if (!item) return null;

                  const bgColor = response === 'yes' ? '#2d4a3e'
                    : response === 'no' ? '#4a2d2d'
                    : '#4a4a2d';

                  const borderColor = response === 'yes' ? '#4CAF50'
                    : response === 'no' ? '#f44336'
                    : '#948979';

                  const textColor = response === 'yes' ? '#4CAF50'
                    : response === 'no' ? '#f44336'
                    : '#948979';

                  return (
                    <div key={feedbackId} className="border rounded px-2 py-1 flex items-center justify-between" style={{ background: bgColor, borderColor }}>
                      <span className="text-xs" style={{ color: '#DFD0B8' }}>{item.comment}</span>
                      <span className="text-xs font-bold uppercase" style={{ color: textColor }}>{response}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {student.aiFeedback.overallComments && student.aiFeedback.overallComments.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium" style={{ color: '#DFD0B8' }}>Overall Comments:</p>
              {student.aiFeedback.overallComments.map((comment, idx) => (
                <p key={idx} className="text-sm" style={{ color: '#948979' }}>• {comment}</p>
              ))}
            </div>
          )}

          {student.aiFeedback.staticAnalysisOutput && (
            <div className="space-y-1">
              <p className="text-xs font-medium" style={{ color: '#DFD0B8' }}>Static Analysis:</p>
              <p className="text-xs font-mono whitespace-pre-wrap" style={{ color: '#948979' }}>
                {student.aiFeedback.staticAnalysisOutput}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Code Viewer */}
      <div className="flex-1 overflow-hidden">
        <CodeViewer
          code={currentFile.content}
          feedback={feedback}
          selectedFile={currentFile.name}
        />
      </div>
    </div>
  );
}
