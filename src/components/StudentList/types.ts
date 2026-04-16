export interface Student {
  name: string;
  email: string;
  status?: string;
  grade: string;
  lastModifiedSubmission?: string;
  feedback: string;
  appliedIds: number[];
  identifier?: string;
  idNumber?: string;
  maxGrade?: string;
  gradeCanBeChanged?: string;
  onlineText?: string;
  lastModifiedGrade?: string;
  // Code submission data
  submissionFiles?: {
    name: string;
    content: string;
  }[];
  submissionDate?: string;
  aiFeedback?: {
    lineComments: Record<number, string>;
    overallComments: string[];
    staticAnalysisOutput: string;
    reasoning?: string;
    feedbackResponses?: Record<number, 'yes' | 'no' | 'unsure'>;
    exerciseRequirements?: import('@/lib/llm').RequirementVerdict[];
  };
}

export interface FeedbackItem {
  id: number;
  comment: string;
  grade: number;
  applied?: boolean;
  isAISuggested?: boolean; // Marks AI-suggested temporary feedback
  sessionOnly?: boolean; // If true, will be removed on reset
}

export interface ChangeRecord {
  type: 'grade' | 'feedback' | 'import' | 'auto-save';
  studentName: string;
  oldValue: string | { grade: string; feedback: string; appliedIds: number[] };
  newValue: string | { grade: string; feedback: string; appliedIds: number[] };
  timestamp: string;
  message?: string;
}

export interface StudentListProps {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  selectedStudent: string | null;
  onStudentSelect: (student: string | null) => void;
  selectedStudents: Set<string>;
  setSelectedStudents: React.Dispatch<React.SetStateAction<Set<string>>>;
  assignmentName: string;
  setAssignmentName: (name: string) => void;
  feedbackItems: FeedbackItem[];
  setFeedbackItems: React.Dispatch<React.SetStateAction<FeedbackItem[]>>;
  onChangeTracked: (change: ChangeRecord) => void;
  onSaveProgress?: () => Promise<boolean>;
  onLastAutoSaveTimeUpdate: (time: string) => void;
  selectedFeedbackId: number | null;
  onFileHandleCreated: (handle: FileSystemFileHandle) => void;
}

export interface SaveData {
  students: Student[];
  assignmentName: string;
  timestamp: string;
  feedbackItems: FeedbackItem[];
}

// ── ZyBooks multi-part lab types ─────────────────────────────────────────────

export interface ZyBooksLabPart {
  /** Full column header, e.g. "8.11 - Lab (90)" */
  id: string;
  /** Human-readable name, e.g. "8.11 - Lab" */
  name: string;
  /** Section number for sorting, e.g. 8.11 */
  sectionNumber: number;
  /** Max points for this part as declared in the column header */
  maxPoints: number;
  /** If true, score is taken directly from ZyBooks CSV — no ZIP needed */
  isAutoGraded: boolean;
  /** ZyBooks percentage scores per student: school email → percentage (0–100) */
  zyBooksScores: Record<string, number>;
  /** Whether the instructor has loaded a ZIP for this part */
  submissionsLoaded: boolean;
  /** Manual grades saved after grading this part: email → grading state */
  manualGrades: Record<string, {
    grade: string;
    appliedIds: number[];
    feedback: string;
    submissionFiles?: { name: string; content: string }[];
  }>;
}

export interface ZyBooksSession {
  /** Sum of all lab part maxPoints, from "Lab total (X)" column */
  totalPoints: number;
  /** All detected lab parts */
  labs: ZyBooksLabPart[];
  /** ID of the lab part currently being graded (null = none selected) */
  activeLabId: string | null;
}

export interface AutoSaveProps {
  onSave: () => Promise<void>;
  status: string;
  showStatus: boolean;
} 