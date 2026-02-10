import React, { useState, useEffect } from 'react';
import './App.css';
import Feedback from './components/Feedback/Feedback';
import StudentList from './components/StudentList/StudentList';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import { Student, ChangeRecord, FeedbackItem } from '@/components/StudentList/types';
import ChangeHistoryPanel from './components/StudentList/components/ChangeHistoryPanel';
import AISettings from './components/AISettings/AISettings';
import StudentCodePanel from './components/StudentCodePanel/StudentCodePanel';
import { generateFeedback } from './lib/llm';
import { getMainPythonFile } from './lib/zipUtils';

const MAX_CHANGES = 50;
const SAVE_HANDLE_KEY = 'save_handle_id';

const defaultFeedback: FeedbackItem[] = [
  { id: 1, comment: "Add more comments", grade: 3 },
  { id: 2, comment: "Poor indentation", grade: 2 },
  { id: 3, comment: "Looks good!", grade: 0 },
  { id: 4, comment: "No submission", grade: 20 },
];

interface MoodleMessage {
  type: 'MOODLE_DATA';
  data: {
    assignmentName: string;
    maxPoints: string;
    students: MoodleStudent[];
    timestamp: string;
  };
}

interface StorageData {
  moodleGradingData?: {
    assignmentName: string;
    maxPoints: string;
    students: MoodleStudent[];
    timestamp: string;
  };
}

declare global {
  interface Window {
    chrome: {
      runtime: {
        onMessage: {
          addListener: (callback: (message: MoodleMessage, sender: unknown, sendResponse: () => void) => void) => void;
          removeListener: (callback: (message: MoodleMessage, sender: unknown, sendResponse: () => void) => void) => void;
        };
        sendMessage: (message: MoodleMessage) => void;
      };
      storage: {
        local: {
          get: (keys: string[], callback: (result: StorageData) => void) => void;
          set: (items: StorageData, callback?: () => void) => void;
          remove: (keys: string | string[], callback?: () => void) => void;
        };
      };
    };
    showOpenFilePicker: (options?: {
      id?: string;
      startIn?: string;
      types?: Array<{
        description: string;
        accept: Record<string, string[]>;
      }>;
      multiple?: boolean;
    }) => Promise<FileSystemFileHandle[]>;
  }
}

type MoodleStudent = {
  name: string;
  email: string;
  idNumber?: string;
  status?: string;
  grade?: string;
  lastModifiedSubmission?: string;
  feedback?: string;
  appliedIds?: number[];
  onlineText?: string;
  lastModifiedGrade?: string;
  maxGrade?: string;
  gradeCanBeChanged?: string;
}

const MainApp = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [assignmentName, setAssignmentName] = useState<string>("Assignment 1");
  const [maxPoints, setMaxPoints] = useState<number>(20);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>(defaultFeedback);

  const [changeHistory, setChangeHistory] = useState<ChangeRecord[]>([]);
  const [isChangeHistoryVisible, setIsChangeHistoryVisible] = useState(false);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string>('');
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<number | null>(null);
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);

  // AI-related state
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);

  // UI state for collapsible panels
  const [isStudentListMinimized, setIsStudentListMinimized] = useState(false);

  // State for AI-suggested feedback (temporary, session-only)
  const [aiSuggestedFeedback, setAISuggestedFeedback] = useState<FeedbackItem[]>([]);

  useEffect(() => {
    // First try to get data from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const dataParam = urlParams.get('data');
    
    if (dataParam) {
      try {
        const parsedData = JSON.parse(decodeURIComponent(dataParam));
        console.log('Found URL data:', parsedData);
        
        // Set max points first
        if (parsedData.maxPoints) {
          console.log('Setting max points from URL:', parsedData.maxPoints);
          setMaxPoints(parseFloat(parsedData.maxPoints));
        }
        
        // Set assignment name
        if (parsedData.assignmentName) {
          setAssignmentName(parsedData.assignmentName);
        }
        
        // Transform and set students data
        if (parsedData.students && Array.isArray(parsedData.students)) {
          const maxPointsValue = parsedData.maxPoints || '20.00';
          console.log('Using max points value for students:', maxPointsValue);
          
          const transformedStudents = parsedData.students.map((student: MoodleStudent) => ({
            name: student.name || '',
            email: student.email || '',
            grade: student.grade || '',
            feedback: student.feedback || '',
            appliedIds: student.appliedIds || [],
            identifier: student.idNumber || '',
            idNumber: student.idNumber || '',
            status: student.status || '',
            lastModifiedSubmission: student.lastModifiedSubmission || '',
            onlineText: student.onlineText || '',
            lastModifiedGrade: student.lastModifiedGrade || '',
            maxGrade: maxPointsValue,
            gradeCanBeChanged: student.gradeCanBeChanged || 'Yes'
          }));
          
          console.log('Setting students with max points:', transformedStudents);
          setStudents(transformedStudents);
        }
      } catch (error) {
        console.error('Error parsing URL data:', error);
      }
    }

    // Then check chrome.storage.local for data
    if (window.chrome?.storage?.local) {
      window.chrome.storage.local.get(['moodleGradingData'], (result) => {
        if (result.moodleGradingData) {
          try {
            const parsedData = result.moodleGradingData;
            console.log('Found Moodle data:', parsedData);
            
            // Set max points first
            const maxPointsValue = parsedData.maxPoints || '20.00';
            console.log('Setting max points from storage:', maxPointsValue);
            setMaxPoints(parseFloat(maxPointsValue));
            
            if (parsedData.students && Array.isArray(parsedData.students)) {
              console.log('Found valid students array:', parsedData.students);
              
              const transformedStudents: Student[] = parsedData.students.map((student: MoodleStudent) => ({
                name: student.name || '',
                email: student.email || '',
                grade: student.grade || '',
                feedback: student.feedback || '',
                appliedIds: student.appliedIds || [],
                identifier: student.idNumber || '',
                idNumber: student.idNumber || '',
                status: student.status || '',
                lastModifiedSubmission: student.lastModifiedSubmission || '',
                onlineText: student.onlineText || '',
                lastModifiedGrade: student.lastModifiedGrade || '',
                maxGrade: maxPointsValue,
                gradeCanBeChanged: student.gradeCanBeChanged || 'Yes'
              }));
              
              console.log('Setting students state with:', transformedStudents);
              setStudents(transformedStudents);
              
              if (parsedData.assignmentName) {
                console.log('Setting assignment name:', parsedData.assignmentName);
                setAssignmentName(parsedData.assignmentName);
              }
            }
            
            // Clear the data after loading
            window.chrome.storage.local.remove('moodleGradingData');
          } catch (error) {
            console.error('Error parsing Moodle data:', error);
          }
        }
      });
    }
  }, []);

  // Try to restore saved file handle on mount
  useEffect(() => {
    const handleId = localStorage.getItem(SAVE_HANDLE_KEY);
    if (handleId) {
      // Attempt to restore the file handle
      navigator.storage?.getDirectory?.()?.then(async (root) => {
        try {
          const handle = await root.getFileHandle(handleId);
          if (handle) {
            console.log('File handle restored successfully');
            setFileHandle(handle);
          }
        } catch (err) {
          console.error('Could not restore file handle:', err);
          localStorage.removeItem(SAVE_HANDLE_KEY);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (fileHandle) {
      console.log('File handle updated:', fileHandle);
      // Store the file handle ID for future sessions
      localStorage.setItem(SAVE_HANDLE_KEY, fileHandle.name);
    }
  }, [fileHandle]);

  const handleChangeTracked = (change: ChangeRecord) => {
    // Only track grade and feedback changes, ignore auto-saves
    if (change.type !== 'grade' && change.type !== 'feedback') return;

    setChangeHistory(prev => {
      let message = '';
      if (change.type === 'grade') {
        message = `${change.studentName}: ${change.oldValue} → ${change.newValue} points`;
      } else if (change.type === 'feedback') {
        const oldValue = change.oldValue as { grade: string; feedback: string; appliedIds: number[] };
        const newValue = change.newValue as { grade: string; feedback: string; appliedIds: number[] };
        message = `${change.studentName}: ${oldValue.grade || '0'} → ${newValue.grade} points`;
      }

      const newChange = {
        ...change,
        message,
        timestamp: new Date().toISOString()
      };

      // Prevent duplicate entries within 1 second
      if (prev.length > 0) {
        const lastChange = prev[0];
        if (
          lastChange.studentName === change.studentName &&
          lastChange.type === change.type &&
          Math.abs(new Date(lastChange.timestamp).getTime() - Date.now()) < 1000
        ) {
          return prev;
        }
      }

      return [newChange, ...prev.slice(0, MAX_CHANGES - 1)];
    });
  };

  const handleRevertChange = (change: ChangeRecord) => {
    if (!change.studentName) return;

    // Revert the student's state
    setStudents(prev => prev.map(student => {
      if (student.name === change.studentName) {
        if (change.type === 'grade') {
          return { ...student, grade: change.oldValue as string };
        } else if (change.type === 'feedback') {
          const oldValue = change.oldValue as { grade: string; feedback: string; appliedIds: number[] };
          return { 
            ...student, 
            grade: oldValue.grade,
            feedback: oldValue.feedback,
            appliedIds: oldValue.appliedIds
          };
        }
      }
      return student;
    }));

    // Remove the change from history
    setChangeHistory(prev => prev.filter(c => c !== change));
  };

  const handleFeedbackEdit = (oldFeedback: FeedbackItem, newFeedback: FeedbackItem) => {
    setStudents(prevStudents => 
      prevStudents.map(student => {
        if (Array.isArray(student.appliedIds) && student.appliedIds.includes(oldFeedback.id)) {
          const updatedFeedback = student.feedback
            .split('\n')
            .map(line => {
              if (line.trim().startsWith(`${oldFeedback.comment.trim()}`)) {
                return `${newFeedback.comment.trim()}`;
              }
              return line;
            })
            .filter(line => line.trim() !== '')
            .join('\n');

          const totalDeduction = student.appliedIds.reduce((sum, id) => {
            if (id === oldFeedback.id) {
              return sum + newFeedback.grade;
            }
            const feedback = feedbackItems.find(f => f.id === id);
            return sum + (feedback?.grade || 0);
          }, 0);

          const newGrade = Math.max(0, maxPoints - totalDeduction);

          window.dispatchEvent(new CustomEvent('grading-change'));
          
          const oldState = {
            grade: student.grade,
            feedback: student.feedback,
            appliedIds: [...student.appliedIds]
          };

          const newState = {
            ...student,
            feedback: updatedFeedback,
            grade: updatedFeedback.trim() ? newGrade.toString() : '',
          };

          handleChangeTracked({
            type: 'feedback',
            studentName: student.name,
            oldValue: oldState,
            newValue: newState,
            timestamp: new Date().toISOString()
          });

          return newState;
        }
        return student;
      })
    );
  };

  // Function to handle feedback selection
  const handleFeedbackSelect = (feedbackId: number | null) => {
    console.log('App received feedback selection:', feedbackId);

    // Debug: Log all students who have this feedback applied
    if (feedbackId !== null) {
      const studentsWithFeedback = students.filter(student =>
        Array.isArray(student.appliedIds) && student.appliedIds.includes(feedbackId)
      );
      console.log('Students with this feedback:', studentsWithFeedback.map(s => s.name));
    }

    // Toggle selection if clicking the same feedback again
    if (selectedFeedbackId === feedbackId) {
      console.log('Deselecting feedback:', feedbackId);
      setSelectedFeedbackId(null);
    } else {
      console.log('Selecting feedback:', feedbackId);
      setSelectedFeedbackId(feedbackId);
    }
  };

  // AI Feedback Generation Functions
  const generateAIFeedbackForStudent = async (student: Student) => {
    if (!student.submissionFiles || student.submissionFiles.length === 0) {
      throw new Error('No code submission found for this student');
    }

    const mainFile = getMainPythonFile({
      email: student.email,
      lastName: student.name.split(' ').pop() || '',
      firstName: student.name.split(' ')[0] || '',
      submissionDate: student.submissionDate || '',
      files: student.submissionFiles
    });

    if (!mainFile) {
      throw new Error('No Python file found in submission');
    }

    const prompt = `You are a computer science grading assistant. Analyze the following Python code submission and evaluate it against specific feedback criteria.

For each feedback criterion below, respond with "yes", "no", or "unsure":
- **yes**: The feedback clearly applies to this code
- **no**: The feedback does NOT apply to this code
- **unsure**: You're not certain whether this feedback applies

Feedback criteria to evaluate:
${feedbackItems.map(item => `${item.id}. "${item.comment}"`).join('\n')}

Code:
\`\`\`python
{{code}}
\`\`\`

Respond ONLY with valid JSON in this exact format:
{
  "line_comments": {
    "3": "Example comment for line 3"
  },
  "overall_comments": [
    "Brief overall assessment"
  ],
  "feedback_responses": {
    "1": "yes",
    "2": "no",
    "3": "unsure"
  },
  "reasoning": "Explanation of your assessment for each feedback criterion"
}

Guidelines:
- Be objective and specific in your evaluation
- Only mark "yes" if the feedback clearly and definitely applies
- Use "unsure" when the feedback might apply but you need more context
- Provide brief, helpful line_comments for specific issues
- Keep overall_comments concise and constructive`;

    const feedback = await generateFeedback(
      mainFile.content,
      '', // No linter output for now
      prompt,
      assignmentName,
      apiKey
    );

    return feedback;
  };

  const handleGenerateFeedback = async () => {
    if (!selectedStudent) {
      alert('Please select a student first');
      return;
    }

    const student = students.find(s => s.name === selectedStudent);
    if (!student) return;

    setIsGeneratingFeedback(true);
    try {
      const feedback = await generateAIFeedbackForStudent(student);

      // Update student with AI feedback (now includes feedbackResponses)
      const updatedStudents = students.map(s => {
        if (s.name === selectedStudent) {
          return {
            ...s,
            aiFeedback: feedback,
            feedback: s.feedback + (s.feedback ? '\n' : '') + feedback.overallComments.join('\n')
          };
        }
        return s;
      });

      setStudents(updatedStudents);

      handleChangeTracked({
        type: 'feedback',
        studentName: selectedStudent,
        oldValue: student.feedback,
        newValue: student.feedback + '\n' + feedback.overallComments.join('\n'),
        timestamp: new Date().toISOString(),
        message: 'AI feedback generated'
      });

      alert('AI feedback generated successfully!');
    } catch (error) {
      console.error('Error generating feedback:', error);
      alert(`Error generating feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingFeedback(false);
    }
  };

  const handleGenerateBatchFeedback = async () => {
    const studentsWithCode = students.filter(s => s.submissionFiles && s.submissionFiles.length > 0);

    if (studentsWithCode.length === 0) {
      alert('No students with code submissions found');
      return;
    }

    const confirmed = confirm(
      `Generate AI feedback for ${studentsWithCode.length} students? This may take several minutes.`
    );

    if (!confirmed) return;

    setIsGeneratingFeedback(true);
    let successCount = 0;
    let errorCount = 0;

    for (const student of studentsWithCode) {
      try {
        const feedback = await generateAIFeedbackForStudent(student);

        // Update student with feedback responses
        setStudents(prevStudents =>
          prevStudents.map(s => {
            if (s.email === student.email) {
              return {
                ...s,
                aiFeedback: feedback,
                feedback: s.feedback + (s.feedback ? '\n' : '') + feedback.overallComments.join('\n')
              };
            }
            return s;
          })
        );

        successCount++;
        console.log(`Generated feedback for ${student.name} (${successCount}/${studentsWithCode.length})`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error generating feedback for ${student.name}:`, error);
        errorCount++;
      }
    }

    setIsGeneratingFeedback(false);
    alert(`Batch feedback generation complete!\n\nSuccess: ${successCount}\nErrors: ${errorCount}`);
  };

  // Generate AI-suggested feedback based on all submissions
  const handleGenerateAISuggestions = async () => {
    const studentsWithCode = students.filter(s => s.submissionFiles && s.submissionFiles.length > 0);

    if (studentsWithCode.length === 0) {
      alert('No student submissions found');
      return;
    }

    setIsGeneratingFeedback(true);

    try {
      // Collect all code snippets
      const codeSnippets = studentsWithCode.slice(0, 10).map(student => {
        const mainFile = getMainPythonFile({
          lastName: student.name.split(' ')[1] || '',
          firstName: student.name.split(' ')[0] || '',
          submissionDate: student.submissionDate || '',
          files: student.submissionFiles
        });
        return mainFile?.content || '';
      }).filter(code => code.length > 0);

      const prompt = `You are a computer science grading assistant. Analyze these ${codeSnippets.length} student code submissions and suggest 3-5 new feedback criteria that would be useful for grading.

Code samples:
${codeSnippets.map((code, idx) => `\n--- Student ${idx + 1} ---\n${code.substring(0, 500)}\n`).join('\n')}

Respond ONLY with valid JSON in this format:
{
  "suggestions": [
    {"comment": "Brief feedback criterion", "grade": 2},
    {"comment": "Another feedback criterion", "grade": 3}
  ],
  "reasoning": "Why these criteria would be useful"
}

Focus on common patterns, issues, or good practices you observe across submissions.`;

      const response = await generateFeedback('', '', prompt, assignmentName, apiKey);

      try {
        const aiResponse = response as any;
        if (aiResponse.suggestions && Array.isArray(aiResponse.suggestions)) {
          const newSuggestions: FeedbackItem[] = aiResponse.suggestions.map((sug: any, idx: number) => ({
            id: Date.now() + idx,
            comment: sug.comment || 'AI-suggested feedback',
            grade: sug.grade || 0,
            isAISuggested: true,
            sessionOnly: true
          }));

          setAISuggestedFeedback(prev => [...prev, ...newSuggestions]);
          alert(`Generated ${newSuggestions.length} AI-suggested feedback criteria!`);
        }
      } catch (parseError) {
        console.error('Error parsing AI suggestions:', parseError);
        alert('AI generated suggestions but format was invalid');
      }
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      alert('Failed to generate AI suggestions');
    } finally {
      setIsGeneratingFeedback(false);
    }
  };

  // Generate feedback with custom prompt
  const handleGenerateWithCustomPrompt = async (customPrompt: string) => {
    if (!selectedStudent) {
      alert('Please select a student first');
      return;
    }

    const student = students.find(s => s.name === selectedStudent);
    if (!student || !student.submissionFiles) return;

    setIsGeneratingFeedback(true);

    try {
      const mainFile = getMainPythonFile({
        lastName: student.name.split(' ')[1] || '',
        firstName: student.name.split(' ')[0] || '',
        submissionDate: student.submissionDate || '',
        files: student.submissionFiles
      });

      if (!mainFile) {
        throw new Error('No Python file found');
      }

      const prompt = `${customPrompt}\n\nCode to evaluate:\n\`\`\`python\n${mainFile.content}\n\`\`\`\n\nProvide your evaluation as JSON: {"overall_comments": ["comment1"], "line_comments": {"1": "comment"}, "reasoning": "explanation"}`;

      const feedback = await generateFeedback(mainFile.content, '', prompt, assignmentName, apiKey);

      // Update student
      setStudents(prevStudents =>
        prevStudents.map(s => {
          if (s.name === selectedStudent) {
            return {
              ...s,
              aiFeedback: feedback,
              feedback: s.feedback + (s.feedback ? '\n' : '') + feedback.overallComments.join('\n')
            };
          }
          return s;
        })
      );

      alert('Custom prompt feedback generated successfully!');
    } catch (error) {
      console.error('Error generating custom feedback:', error);
      alert('Failed to generate feedback with custom prompt');
    } finally {
      setIsGeneratingFeedback(false);
    }
  };

  // Remove AI-suggested feedback item
  const handleRemoveAISuggestion = (id: number) => {
    setAISuggestedFeedback(prev => prev.filter(item => item.id !== id));
  };

  // Reset function to clear all data
  const handleReset = () => {
    if (confirm('Are you sure you want to reset? This will clear all students, feedback, and imported data.')) {
      setStudents([]);
      setSelectedStudent(null);
      setSelectedStudents(new Set());
      setAssignmentName("Assignment 1");
      setMaxPoints(20);
      setFeedbackItems(defaultFeedback);
      setChangeHistory([]);
      setFileHandle(null);
      setAISuggestedFeedback([]); // Clear AI suggestions

      // Clear localStorage
      localStorage.removeItem('lastSaveFileName');
      localStorage.removeItem('lastFileHandle');

      alert('All data has been reset successfully.');
    }
  };

  // Get the currently selected student object for the code viewer
  const currentStudent = selectedStudent ? students.find(s => s.name === selectedStudent) || null : null;

  // Check if there are students with code submissions
  const hasStudentsWithCode = students.some(s => s.submissionFiles && s.submissionFiles.length > 0);

  // Navigation functions for Previous/Next student
  const handlePreviousStudent = () => {
    if (!selectedStudent || students.length === 0) return;
    const currentIndex = students.findIndex(s => s.name === selectedStudent);
    if (currentIndex > 0) {
      setSelectedStudent(students[currentIndex - 1].name);
    }
  };

  const handleNextStudent = () => {
    if (!selectedStudent || students.length === 0) return;
    const currentIndex = students.findIndex(s => s.name === selectedStudent);
    if (currentIndex < students.length - 1) {
      setSelectedStudent(students[currentIndex + 1].name);
    }
  };

  const currentStudentIndex = selectedStudent ? students.findIndex(s => s.name === selectedStudent) : -1;
  const hasPrevious = currentStudentIndex > 0;
  const hasNext = currentStudentIndex >= 0 && currentStudentIndex < students.length - 1;

  return (
    <div className="grading-assistant relative">
      {/* Panel Toggle Button (Windows-style) */}
      <button
        onClick={() => setIsStudentListMinimized(!isStudentListMinimized)}
        className={`panel-toggle-btn ${isStudentListMinimized ? 'panel-open' : ''}`}
        title={isStudentListMinimized ? 'Close Student List' : 'Open Student List'}
      >
        {isStudentListMinimized ? '−' : '☰'}
      </button>

      {/* Control Panel - Grid Layout */}
      <div className="control-panel-grid absolute top-4 right-60" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        width: '600px'
      }}>
        <button
          onClick={() => setIsChangeHistoryVisible(!isChangeHistoryVisible)}
          className="px-3 py-2 rounded-md transition-colors flex items-center justify-between text-sm"
        >
          <span>{isChangeHistoryVisible ? 'Hide' : 'Show'} Changes</span>
          <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: '#393E46' }}>
            {changeHistory.length}
          </span>
        </button>

        <button
          onClick={handleReset}
          className="px-3 py-2 rounded-md transition-colors text-sm"
          style={{ background: '#8B0000', borderColor: '#A00000' }}
        >
          Reset
        </button>

        <label htmlFor="csv-import-top" className="px-3 py-2 rounded-md cursor-pointer text-sm flex items-center justify-center" style={{ background: '#393E46', color: '#DFD0B8', border: '1px solid #948979' }}>
          Import Roster (CSV)
          <input type="file" id="csv-import-top" accept=".csv" className="hidden" />
        </label>

        <label htmlFor="zip-import-top" className="px-3 py-2 rounded-md cursor-pointer text-sm flex items-center justify-center" style={{ background: '#393E46', color: '#DFD0B8', border: '1px solid #948979' }}>
          Import Code (ZIP)
          <input type="file" id="zip-import-top" accept=".zip" className="hidden" />
        </label>

        <button className="px-3 py-2 rounded-md transition-colors text-sm">
          Load Progress
        </button>

        <button className="px-3 py-2 rounded-md transition-colors text-sm">
          Save Progress
        </button>

        {/* Display the last auto-save time */}
        {lastAutoSaveTime && (
          <div className="col-span-3 text-xs text-center" style={{ color: '#948979', paddingTop: '4px' }}>
            Last auto-save: {lastAutoSaveTime}
          </div>
        )}
      </div>

      {/* Change History Panel */}
      {isChangeHistoryVisible && (
        <ChangeHistoryPanel
          changeHistory={changeHistory}
          onClose={() => setIsChangeHistoryVisible(false)}
          onRevert={handleRevertChange}
        />
      )}

      {/* Main content */}
      <header>
        <div>
          <div className="flex items-center gap-2">
            <h1>Grading Assistant</h1>
            <span className="text-xs" style={{ color: '#948979' }}>v1.0.0</span>
          </div>
          <input
            type="text"
            value={assignmentName}
            onChange={(e) => setAssignmentName(e.target.value)}
            className="text-lg font-semibold px-2 py-1 border rounded"
          />
          <p>Max Points: {maxPoints.toFixed(2)}</p>
        </div>
      </header>

      {/* Student List Slide-in Panel */}
      <div className={`student-list-panel ${isStudentListMinimized ? 'open' : ''}`}>
        <StudentList
          students={students}
          setStudents={setStudents}
          selectedStudent={selectedStudent}
          onStudentSelect={setSelectedStudent}
          selectedStudents={selectedStudents}
          setSelectedStudents={setSelectedStudents}
          assignmentName={assignmentName}
          setAssignmentName={setAssignmentName}
          onChangeTracked={handleChangeTracked}
          feedbackItems={feedbackItems}
          setFeedbackItems={setFeedbackItems}
          onLastAutoSaveTimeUpdate={setLastAutoSaveTime}
          selectedFeedbackId={selectedFeedbackId}
          onFileHandleCreated={setFileHandle}
          setMaxPoints={setMaxPoints}
        />
      </div>

      <main>
        {/* Left Column: AI Settings + Feedback */}
        <div className="left">
          <AISettings
            onGenerateFeedback={handleGenerateFeedback}
            onGenerateBatchFeedback={handleGenerateBatchFeedback}
            onGenerateWithCustomPrompt={handleGenerateWithCustomPrompt}
            onGenerateAISuggestions={handleGenerateAISuggestions}
            isGenerating={isGeneratingFeedback}
            hasSelectedStudent={!!selectedStudent}
            hasStudentsWithCode={hasStudentsWithCode}
            suggestedFeedback={aiSuggestedFeedback}
            onRemoveSuggestion={handleRemoveAISuggestion}
          />
          <Feedback
            selectedStudent={selectedStudent}
            selectedStudents={selectedStudents}
            appliedIds={
              selectedStudent
                ? students.find(s => s.name === selectedStudent)?.appliedIds || []
                : selectedStudents.size > 0
                  ? [...selectedStudents].reduce((ids, studentName) => {
                      const student = students.find(s => s.name === studentName);
                      return student?.appliedIds ? [...ids, ...student.appliedIds] : ids;
                    }, [] as number[])
                  : []
            }
            onFeedbackEdit={handleFeedbackEdit}
            feedbackItems={feedbackItems}
            setFeedbackItems={setFeedbackItems}
            onStudentsUpdate={setStudents}
            onChangeTracked={handleChangeTracked}
            onFeedbackSelect={handleFeedbackSelect}
            selectedFeedbackId={selectedFeedbackId}
            maxPoints={maxPoints}
          />
        </div>

        {/* Center Column: Student Code Viewer */}
        <div className="center">
          <StudentCodePanel
            student={currentStudent}
            feedbackItems={feedbackItems}
            onPreviousStudent={handlePreviousStudent}
            onNextStudent={handleNextStudent}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
          />
        </div>

        {/* Right Column: Empty placeholder for layout */}
        <div className="right" style={{ display: 'none' }}></div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainApp />} />
      </Routes>
    </Router>
  );
};

export default App;
