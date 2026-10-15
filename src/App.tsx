import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Feedback from './components/Feedback/Feedback';
import StudentList from './components/StudentList/StudentList';
import { StudentListHandle } from './components/StudentList/StudentList';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import { Student, ChangeRecord, FeedbackItem, ZyBooksSession, ZyBooksLabPart } from '@/components/StudentList/types';
import ChangeHistoryPanel from './components/ChangeHistoryPanel/ChangeHistoryPanel';
import AISettings from './components/AISettings/AISettings';
import StudentCodePanel from './components/StudentCodePanel/StudentCodePanel';
import { generateFeedback, evaluateAgainstExercise } from './lib/llm';
import { getStoredApiKey, storeApiKey } from './lib/aiConfig';
import { getMainPythonFile } from './lib/zipUtils';
import { useZyBooksCSVHandling } from '@/hooks';
import ZyBooksPanel from './components/ZyBooksPanel/ZyBooksPanel';
import TurtlePanel from './components/TurtlePanel/TurtlePanel';

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
  const [apiKey, setApiKey] = useState<string>(getStoredApiKey);
  const handleApiKeyChange = (key: string) => {
    storeApiKey(key);
    setApiKey(key.trim());
  };
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const batchCancelRef = useRef(false);

  const handleStopGeneration = () => {
    batchCancelRef.current = true;
    setIsGeneratingFeedback(false);
  };

  // Ref to StudentList for calling its methods
  const studentListRef = useRef<StudentListHandle>(null);
  const loadFileInputRef = useRef<HTMLInputElement>(null);
  const [showLoadOptions, setShowLoadOptions] = useState(false);
  const [loadStudents, setLoadStudents] = useState(true);
  const [loadFeedback, setLoadFeedback] = useState(true);

  // UI state for collapsible panels
  const [isStudentListMinimized, setIsStudentListMinimized] = useState(false);

  // State for AI-suggested feedback (temporary, session-only)
  const [aiSuggestedFeedback, setAISuggestedFeedback] = useState<FeedbackItem[]>([]);

  // ── ZyBooks multi-part lab session ──────────────────────────────────────────
  const {
    error: zyBooksError,
    session: zyBooksSession,
    setSession: setZyBooksSession,
    handleFileChange: handleZyBooksFileChange,
  } = useZyBooksCSVHandling();

  // Ref used to detect when a ZIP import was triggered for a specific lab
  const zipLoadingForLabRef = useRef<string | null>(null);

  // After students state changes, check if we just loaded a ZIP for a lab part
  useEffect(() => {
    const labId = zipLoadingForLabRef.current;
    if (!labId || !zyBooksSession) return;
    const hasFiles = students.some(s => s.submissionFiles && s.submissionFiles.length > 0);
    if (hasFiles) {
      setZyBooksSession((prev: ZyBooksSession | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          labs: prev.labs.map((lab: ZyBooksLabPart) =>
            lab.id === labId ? { ...lab, submissionsLoaded: true } : lab
          ),
        };
      });
      zipLoadingForLabRef.current = null;
    }
  }, [students]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Snapshot each student's current grading state into the active lab's manualGrades.
   * Returns the updated session without mutating state.
   */
  const commitActiveLabGrades = (session: ZyBooksSession, currentStudents: Student[]): ZyBooksSession => {
    if (!session.activeLabId) return session;
    return {
      ...session,
      labs: session.labs.map(lab => {
        if (lab.id !== session.activeLabId) return lab;
        const updatedGrades = { ...lab.manualGrades };
        currentStudents.forEach(s => {
          const key = s.email.trim().toLowerCase();
          updatedGrades[key] = {
            grade: s.grade,
            appliedIds: s.appliedIds,
            feedback: s.feedback,
            submissionFiles: s.submissionFiles,
          };
        });
        return { ...lab, manualGrades: updatedGrades };
      }),
    };
  };

  /**
   * Switch the active lab. Commits current grades, then restores saved state
   * for the new lab (grades + submission files).
   */
  const handleLabSelect = (labId: string) => {
    if (!zyBooksSession) return;

    // Commit current lab grades before switching
    const committed = commitActiveLabGrades(zyBooksSession, students);

    // Restore grades & files for the new lab
    const newLab = committed.labs.find(l => l.id === labId);
    if (newLab && !newLab.isAutoGraded) {
      setStudents(prev => prev.map(s => {
        const key = s.email.trim().toLowerCase();
        const saved = newLab.manualGrades[key];
        if (saved) {
          return {
            ...s,
            grade: saved.grade,
            appliedIds: saved.appliedIds,
            feedback: saved.feedback,
            submissionFiles: saved.submissionFiles ?? s.submissionFiles,
          };
        }
        // No saved state for this student in this lab — clear grading
        return { ...s, grade: '', appliedIds: [], feedback: '', submissionFiles: undefined };
      }));
    }

    setZyBooksSession({ ...committed, activeLabId: labId });
  };

  /**
   * Called when the instructor loads a ZIP for a specific lab part.
   * Clears current submissions, sets the active lab, then triggers the normal ZIP import.
   */
  const handleZipImportForLab = (labId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!zyBooksSession) return;

    // Commit current lab first
    const committed = commitActiveLabGrades(zyBooksSession, students);

    // Clear student submissions and grades so the new ZIP starts fresh
    setStudents(prev => prev.map(s => ({
      ...s,
      grade: '',
      appliedIds: [],
      feedback: '',
      submissionFiles: undefined,
    })));

    setZyBooksSession({ ...committed, activeLabId: labId });

    // Mark that we're waiting for this lab's ZIP to load
    zipLoadingForLabRef.current = labId;

    // Delegate to the normal ZIP import handler
    studentListRef.current?.handleZipImport(e);
  };

  /**
   * Compute the final weighted grade for every student across all lab parts
   * and write it into student.grade, ready for Moodle CSV export.
   *
   * Formula (per student):
   *   earnedPts = Σ over all parts:
   *     auto-graded  → (zyBooksScore / 100) × part.maxPoints
   *     manual       → (manualGrade  / moodleMax) × part.maxPoints
   *   finalGrade = (earnedPts / session.totalPoints) × moodleMax
   */
  const handleComputeFinalGrades = () => {
    if (!zyBooksSession) return;

    // Commit any unsaved grades for the current active lab
    const committed = commitActiveLabGrades(zyBooksSession, students);
    setZyBooksSession(committed);

    setStudents(prev => prev.map(student => {
      const email = student.email.trim().toLowerCase();
      let earnedPts = 0;

      committed.labs.forEach(lab => {
        if (lab.isAutoGraded) {
          const pct = lab.zyBooksScores[email] ?? 0;
          earnedPts += (pct / 100) * lab.maxPoints;
        } else {
          const saved = lab.manualGrades[email];
          const gradeNum = saved ? parseFloat(saved.grade) : 0;
          const normalised = isNaN(gradeNum) ? 0 : gradeNum / maxPoints;
          earnedPts += normalised * lab.maxPoints;
        }
      });

      const finalGrade = (earnedPts / committed.totalPoints) * maxPoints;
      return { ...student, grade: parseFloat(finalGrade.toFixed(2)).toString() };
    }));

    alert('Final grades computed and written to the student roster. You can now export the Moodle CSV.');
  };

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

      // Store AI feedback for review — do NOT auto-apply to avoid slop.
      // The FeedbackReviewPanel will show verdicts and let the instructor confirm.
      setStudents(prev => prev.map(s =>
        s.name === selectedStudent ? { ...s, aiFeedback: feedback } : s
      ));
    } catch (error) {
      console.error('Error generating feedback:', error);
      alert(`Error generating feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingFeedback(false);
    }
  };

  /**
   * Apply the instructor-confirmed feedback IDs from the review panel to a student.
   * Uses the same grade calculation as the Feedback component.
   */
  const handleApplyReviewedFeedback = (studentName: string, confirmedIds: number[]) => {
    setStudents(prev => prev.map(student => {
      if (student.name !== studentName) return student;

      // Merge with any already-applied IDs (union)
      const merged = Array.from(new Set([...student.appliedIds, ...confirmedIds]));

      const totalDeduction = merged.reduce((sum, id) => {
        const item = feedbackItems.find(f => f.id === id);
        return sum + (item?.grade || 0);
      }, 0);

      const newGrade = Math.max(0, maxPoints - totalDeduction);
      const newFeedbackText = merged
        .map(id => feedbackItems.find(f => f.id === id)?.comment)
        .filter(Boolean)
        .join('\n');

      const oldState = { grade: student.grade, feedback: student.feedback, appliedIds: [...student.appliedIds] };
      const updated = { ...student, appliedIds: merged, grade: newGrade.toString(), feedback: newFeedbackText };

      handleChangeTracked({
        type: 'feedback',
        studentName,
        oldValue: oldState,
        newValue: { grade: updated.grade, feedback: updated.feedback, appliedIds: updated.appliedIds },
        timestamp: new Date().toISOString(),
        message: 'AI review applied',
      });

      window.dispatchEvent(new CustomEvent('grading-change'));
      return updated;
    }));
  };

  /** Clear pending AI feedback for a student (dismiss the review panel). */
  const handleDismissReview = (studentName: string) => {
    setStudents(prev => prev.map(s =>
      s.name === studentName ? { ...s, aiFeedback: undefined } : s
    ));
  };

  const handleGenerateBatchFeedback = async () => {
    const studentsWithCode = students.filter(s => s.submissionFiles && s.submissionFiles.length > 0);

    if (studentsWithCode.length === 0) {
      alert('No students with code submissions found');
      return;
    }

    const confirmed = confirm(
      `Generate AI feedback for ${studentsWithCode.length} students?\n\n` +
      `Feedback items where AI says YES will be auto-applied (binary assignment).\n` +
      `This may take several minutes.`
    );

    if (!confirmed) return;

    batchCancelRef.current = false;
    setIsGeneratingFeedback(true);
    let successCount = 0;
    let errorCount = 0;

    for (const student of studentsWithCode) {
      if (batchCancelRef.current) break;
      try {
        const feedback = await generateAIFeedbackForStudent(student);

        // Batch mode: auto-apply all "yes" items (binary system — no slop).
        const yesIds = Object.entries(feedback.feedbackResponses ?? {})
          .filter(([, verdict]) => verdict === 'yes')
          .map(([idStr]) => Number(idStr));

        setStudents(prevStudents =>
          prevStudents.map(s => {
            if (s.email !== student.email) return s;

            const merged = Array.from(new Set([...s.appliedIds, ...yesIds]));
            const totalDeduction = merged.reduce((sum, id) => {
              const item = feedbackItems.find(f => f.id === id);
              return sum + (item?.grade || 0);
            }, 0);
            const newGrade = Math.max(0, maxPoints - totalDeduction);
            const newFeedbackText = merged
              .map(id => feedbackItems.find(f => f.id === id)?.comment)
              .filter(Boolean)
              .join('\n');

            return {
              ...s,
              aiFeedback: feedback,
              appliedIds: merged,
              grade: merged.length > 0 ? newGrade.toString() : s.grade,
              feedback: merged.length > 0 ? newFeedbackText : s.feedback,
            };
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
    if (batchCancelRef.current) {
      alert(`Generation stopped.\n\nProcessed: ${successCount + errorCount} students\nSuccess: ${successCount}`);
    } else {
      alert(`Batch feedback complete!\n\nSuccess: ${successCount}\nErrors: ${errorCount}\n\nYES-verdict items were auto-applied. Select individual students to review UNSURE items.`);
    }
  };

  /** Promote AI-suggested items into the permanent feedbackItems list. */
  const handlePromoteSuggestions = (items: FeedbackItem[]) => {
    const promoted = items.map(item => ({ ...item, isAISuggested: false, sessionOnly: false }));
    setFeedbackItems(prev => [...prev, ...promoted]);
    setAISuggestedFeedback(prev => prev.filter(p => !items.some(i => i.id === p.id)));
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
          email: student.email,
          lastName: student.name.split(' ')[1] || '',
          firstName: student.name.split(' ')[0] || '',
          submissionDate: student.submissionDate || '',
          files: student.submissionFiles ?? []
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

      if (response.suggestions && response.suggestions.length > 0) {
        const newSuggestions: FeedbackItem[] = response.suggestions.map((sug, idx) => ({
          id: Date.now() + idx,
          comment: sug.comment || 'AI-suggested feedback',
          grade: sug.grade || 0,
          isAISuggested: true,
          sessionOnly: true
        }));

        setAISuggestedFeedback(prev => [...prev, ...newSuggestions]);
        alert(`Generated ${newSuggestions.length} AI-suggested feedback criteria!`);
      } else {
        alert('AI did not return any suggestions. Try again.');
      }
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      alert('Failed to generate AI suggestions');
    } finally {
      setIsGeneratingFeedback(false);
    }
  };

  // ── Exercise-description evaluation handlers ─────────────────────────────

  const getMainFileForStudent = (student: Student) => {
    return getMainPythonFile({
      email: student.email,
      lastName: student.name.split(' ')[1] || '',
      firstName: student.name.split(' ')[0] || '',
      submissionDate: student.submissionDate || '',
      files: student.submissionFiles ?? [],
    });
  };

  const handleEvaluateExercise = async (exerciseDescription: string) => {
    if (!selectedStudent) { alert('Please select a student first'); return; }
    const student = students.find(s => s.name === selectedStudent);
    if (!student?.submissionFiles?.length) return;

    const mainFile = getMainFileForStudent(student);
    if (!mainFile) { alert('No Python file found in submission'); return; }

    setIsGeneratingFeedback(true);
    try {
      const result = await evaluateAgainstExercise(mainFile.content, exerciseDescription, assignmentName, apiKey);
      setStudents(prev => prev.map(s =>
        s.name === selectedStudent
          ? { ...s, aiFeedback: { ...s.aiFeedback, lineComments: s.aiFeedback?.lineComments ?? {}, overallComments: result.overallComments, staticAnalysisOutput: '', reasoning: result.reasoning, exerciseRequirements: result.requirements } }
          : s
      ));
    } catch (err) {
      alert(`Evaluation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGeneratingFeedback(false);
    }
  };

  const handleEvaluateExerciseBatch = async (exerciseDescription: string) => {
    const studentsWithCode = students.filter(s => s.submissionFiles?.length);
    if (!studentsWithCode.length) { alert('No students with code submissions found'); return; }
    if (!confirm(`Evaluate ${studentsWithCode.length} students against the exercise description?\n\nNOT MET requirements will be auto-applied.`)) return;

    batchCancelRef.current = false;
    setIsGeneratingFeedback(true);
    let ok = 0, errors = 0;

    for (const student of studentsWithCode) {
      if (batchCancelRef.current) break;
      const mainFile = getMainFileForStudent(student);
      if (!mainFile) { errors++; continue; }
      try {
        const result = await evaluateAgainstExercise(mainFile.content, exerciseDescription, assignmentName, apiKey);

        // Auto-apply all NOT MET requirements as feedback text
        const failedReqs = result.requirements.filter(r => r.verdict === 'not-met' || r.verdict === 'partial');
        const feedbackText = failedReqs.map(r => `${r.requirement}: ${r.comment}`).join('\n');
        const totalDeduction = failedReqs.reduce((sum, r) => sum + r.suggestedDeduction, 0);
        const newGrade = Math.max(0, maxPoints - totalDeduction);

        setStudents(prev => prev.map(s => {
          if (s.email !== student.email) return s;
          return {
            ...s,
            aiFeedback: { ...s.aiFeedback, lineComments: s.aiFeedback?.lineComments ?? {}, overallComments: result.overallComments, staticAnalysisOutput: '', reasoning: result.reasoning, exerciseRequirements: result.requirements },
            feedback: feedbackText || s.feedback,
            grade: failedReqs.length > 0 ? newGrade.toString() : s.grade,
          };
        }));

        ok++;
        await new Promise(r => setTimeout(r, 800));
      } catch { errors++; }
    }

    setIsGeneratingFeedback(false);
    if (batchCancelRef.current) {
      alert(`Evaluation stopped.\n\nProcessed: ${ok + errors} students\nSuccess: ${ok}`);
    } else {
      alert(`Done! Success: ${ok}  Errors: ${errors}\n\nNOT MET items were auto-applied. Select individual students to review PARTIAL/UNSURE results.`);
    }
  };

  const handleApplyExerciseRequirements = (studentName: string, indices: number[], _exerciseDescription: string) => {
    setStudents(prev => prev.map(student => {
      if (student.name !== studentName) return student;
      const reqs = student.aiFeedback?.exerciseRequirements ?? [];
      const selected = indices.map(i => reqs[i]).filter(Boolean);
      if (!selected.length) return student;

      const feedbackLines = selected.map(r => `${r.requirement}: ${r.comment}`);
      const totalDeduction = selected.reduce((sum, r) => sum + r.suggestedDeduction, 0);
      const newFeedback = [student.feedback, ...feedbackLines].filter(Boolean).join('\n');
      const newGrade = Math.max(0, maxPoints - totalDeduction);

      const oldState = { grade: student.grade, feedback: student.feedback, appliedIds: [...student.appliedIds] };
      const updated = { ...student, feedback: newFeedback, grade: newGrade.toString() };

      handleChangeTracked({ type: 'feedback', studentName, oldValue: oldState, newValue: { grade: updated.grade, feedback: updated.feedback, appliedIds: updated.appliedIds }, timestamp: new Date().toISOString(), message: 'Exercise requirements applied' });
      window.dispatchEvent(new CustomEvent('grading-change'));
      return updated;
    }));
  };

  const handlePromoteExerciseRequirements = (_indices: number[], requirements: import('@/lib/llm').RequirementVerdict[]) => {
    const newItems: FeedbackItem[] = requirements.map(r => ({
      id: Date.now() + Math.random(),
      comment: r.requirement,
      grade: r.suggestedDeduction,
      isAISuggested: false,
      sessionOnly: false,
    }));
    setFeedbackItems(prev => [...prev, ...newItems]);
  };

  const handleDismissExerciseResults = (studentName: string) => {
    setStudents(prev => prev.map(s => {
      if (s.name !== studentName || !s.aiFeedback) return s;
      const { exerciseRequirements: _removed, ...rest } = s.aiFeedback;
      return { ...s, aiFeedback: rest };
    }));
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
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px',
        width: '780px'
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
          Import Moodle CSV
          <input
            type="file"
            id="csv-import-top"
            accept=".csv"
            className="hidden"
            onChange={(e) => studentListRef.current?.handleFileChange(e)}
          />
        </label>

        <label htmlFor="zip-import-top" className="px-3 py-2 rounded-md cursor-pointer text-sm flex items-center justify-center" style={{ background: '#393E46', color: '#DFD0B8', border: '1px solid #948979' }}>
          Import Code (ZIP)
          <input
            type="file"
            id="zip-import-top"
            accept=".zip"
            className="hidden"
            onChange={(e) => studentListRef.current?.handleZipImport(e)}
          />
        </label>

        <label
          htmlFor="zybooks-csv-import"
          className="px-3 py-2 rounded-md cursor-pointer text-sm flex items-center justify-center"
          style={{
            background: zyBooksSession ? '#2e4a3c' : '#393E46',
            color: zyBooksSession ? '#4caf83' : '#DFD0B8',
            border: `1px solid ${zyBooksSession ? '#4caf83' : '#948979'}`,
          }}
          title={zyBooksError || 'Import ZyBooks CSV to enable multi-part lab grading'}
        >
          {zyBooksSession ? `ZyBooks (${zyBooksSession.labs.length} labs)` : 'Import ZyBooks CSV'}
          <input
            type="file"
            id="zybooks-csv-import"
            accept=".csv"
            className="hidden"
            onChange={handleZyBooksFileChange}
          />
        </label>

        <div className="relative">
          <button
            className="px-3 py-2 rounded-md transition-colors text-sm w-full"
            onClick={() => setShowLoadOptions(!showLoadOptions)}
          >
            Load Progress
          </button>
          {showLoadOptions && (
            <div className="absolute top-full left-0 mt-1 p-3 rounded-md z-50" style={{ background: '#2D2D2D', border: '1px solid #948979', minWidth: '200px' }}>
              <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={loadStudents}
                  onChange={(e) => setLoadStudents(e.target.checked)}
                />
                Load Students
              </label>
              <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={loadFeedback}
                  onChange={(e) => setLoadFeedback(e.target.checked)}
                />
                Load Feedback
              </label>
              <input
                ref={loadFileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  studentListRef.current?.handleLoadProgress(e, { loadStudents, loadFeedback });
                  setShowLoadOptions(false);
                }}
              />
              <button
                className="px-3 py-1 rounded-md text-sm w-full mt-1"
                style={{ background: '#393E46', border: '1px solid #948979' }}
                onClick={() => loadFileInputRef.current?.click()}
                disabled={!loadStudents && !loadFeedback}
              >
                Confirm Load
              </button>
            </div>
          )}
        </div>

        <button
          className="px-3 py-2 rounded-md transition-colors text-sm"
          onClick={() => studentListRef.current?.handleSaveProgress()}
          disabled={students.length === 0}
          style={{ opacity: students.length > 0 ? 1 : 0.5, cursor: students.length > 0 ? 'pointer' : 'not-allowed' }}
        >
          Save Progress
        </button>

        {/* Display the last auto-save time */}
        {lastAutoSaveTime && (
          <div className="col-span-4 text-xs text-center" style={{ color: '#948979', paddingTop: '4px' }}>
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
            <span className="text-xs" style={{ color: '#948979' }}>v2.1.0</span>
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

        {/* ZyBooks error banner */}
        {zyBooksError && (
          <div style={{ background: '#5a1a1a', border: '1px solid #a03030', borderRadius: '6px', padding: '8px 12px', marginBottom: '8px', fontSize: '12px', color: '#ffaaaa' }}>
            ZyBooks import error: {zyBooksError}
          </div>
        )}

        {/* ZyBooks Lab Parts Panel — shown only when a ZyBooks CSV is loaded */}
        {zyBooksSession && (
          <>
            {/* Active lab indicator */}
            {zyBooksSession.activeLabId && (
              <div style={{ background: '#393E46', border: '1px solid #948979', borderRadius: '6px', padding: '6px 12px', marginBottom: '8px', fontSize: '12px', color: '#DFD0B8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#948979' }}>Grading:</span>
                <span style={{ fontWeight: 600 }}>
                  {zyBooksSession.labs.find((l: ZyBooksLabPart) => l.id === zyBooksSession.activeLabId)?.name ?? zyBooksSession.activeLabId}
                </span>
              </div>
            )}
            <ZyBooksPanel
              session={zyBooksSession}
              onSessionChange={(s) => setZyBooksSession(s)}
              onLabSelect={handleLabSelect}
              onZipImportForLab={handleZipImportForLab}
              onComputeFinalGrades={handleComputeFinalGrades}
              moodleMaxPoints={maxPoints}
            />
          </>
        )}

        <StudentList
          ref={studentListRef}
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
            onGenerateAISuggestions={handleGenerateAISuggestions}
            onStopGeneration={handleStopGeneration}
            apiKey={apiKey}
            onApiKeyChange={handleApiKeyChange}
            isGenerating={isGeneratingFeedback}
            hasSelectedStudent={!!selectedStudent}
            hasStudentsWithCode={hasStudentsWithCode}
            suggestedFeedback={aiSuggestedFeedback}
            onRemoveSuggestion={handleRemoveAISuggestion}
            onPromoteSuggestions={handlePromoteSuggestions}
            currentStudent={currentStudent}
            feedbackItems={feedbackItems}
            onApplyReview={handleApplyReviewedFeedback}
            onDismissReview={handleDismissReview}
            onEvaluateExercise={handleEvaluateExercise}
            onEvaluateExerciseBatch={handleEvaluateExerciseBatch}
            onApplyExerciseRequirements={handleApplyExerciseRequirements}
            onPromoteExerciseRequirements={handlePromoteExerciseRequirements}
            onDismissExerciseResults={handleDismissExerciseResults}
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

        {/* Right Column: Turtle Panel (visible when student has turtle code) */}
        <div className="right" style={{
          display: currentStudent?.submissionFiles?.some(f =>
            /import turtle|from turtle\s+import/.test(f.content)
          ) ? 'block' : 'none'
        }}>
          <TurtlePanel
            student={currentStudent}
            apiKey={apiKey}
            assignmentName={assignmentName}
          />
        </div>
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
