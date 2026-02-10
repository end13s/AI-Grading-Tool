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
    reasoning?: string; // AI reasoning for feedback assignment
    feedbackResponses?: Record<number, 'yes' | 'no' | 'unsure'>; // Feedback ID -> Yes/No/Unsure
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

export interface AutoSaveProps {
  onSave: () => Promise<void>;
  status: string;
  showStatus: boolean;
} 