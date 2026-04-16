# AI Grading Tool — CLAUDE.md

## Project Overview

A web-based AI-powered grading tool designed to streamline the process of grading student code submissions. Originally built to integrate with Moodle's CSV export/import workflow, extended to support ZyBooks CSV grade sheets and multi-part lab assignments. The tool allows instructors to import student rosters, match code submissions, apply structured feedback, leverage AI code analysis, and export final grades back to Moodle.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18.3.1 + TypeScript 5.6.2 |
| Build Tool | Vite 6.2.0 |
| Routing | React Router DOM 7.1.1 |
| Styling | TailwindCSS 3.4.14 + ShadCN/UI |
| Icons | Bootstrap Icons 1.11.3 + Lucide React |
| CSV Parsing | PapaParse 5.4.1 |
| ZIP Handling | JSZip 3.10.1 |
| File Download | file-saver 2.0.5 |
| AI Integration | OpenAI SDK 6.10.0 (GPT-4O-mini) |
| Drag & Drop | @dnd-kit/core, @dnd-kit/sortable |
| Tables | @tanstack/react-table 8.20.5 |
| Code Display | react-syntax-highlighter 16.1.0 |
| Accessible Primitives | Radix UI (Checkbox, Slot) |
| Linting | ESLint 9.13.0 |

---

## Project Structure

```
/src
  /components
    /AISettings/          — AI feedback generation UI (3 modes: Predefined, AI-Suggested, Custom)
    /StudentList/         — Student roster table, CSV/ZIP import, save/load progress
      /components/        — TableHeader, TableBody, FileControls, AutoSaveDebugPanel
      /hooks/             — useCSVHandling, useZipHandling
      /types.ts           — Core TypeScript interfaces
    /StudentCodePanel/    — Code viewer panel for selected student
    /CodeViewer/          — Syntax-highlighted code display
    /Feedback/            — Feedback item management, drag-and-drop, search
    /ChangeHistoryPanel/  — Change tracking and revert functionality
    /StatusMessage/       — Status notification component
    /ui/                  — ShadCN UI primitives (Button, Input, Table, Checkbox, etc.)
  /lib
    /llm.ts               — OpenAI API integration
    /zipUtils.ts          — ZIP file parsing and student matching logic
    /utils.ts             — Shared utilities
  /utils
    /moodleDataImport.ts  — Moodle CSV data helper
  /types
    /chrome.d.ts          — Chrome extension type declarations
    /global.d.ts          — Global type declarations
  App.tsx                 — Root component, global state, layout
  main.tsx                — React entry point
  index.css / App.css     — Global and app-level styles
```

---

## Application Features

### Data Import / Export

- **Moodle CSV Import** — Import student roster from Moodle's gradebook CSV. Extracts name, email, grade, maximum grade, feedback, status, and submission metadata.
- **ZyBooks CSV Import** — Import ZyBooks lab grade sheets. Supports multi-part lab assignments, displays all lab parts, allows marking parts as auto-graded (no code required), and lets instructor assign ZIP files per lab part.
- **ZIP Submission Import** — Import student code submission ZIP files. Supports:
  - Canvas nested ZIP format (LASTNAME_FIRSTNAME_email_DATE)
  - ZyBooks ZIP format
  - Generic .py file archives
- **JSON Progress Save/Load** — Serialize and restore full grading session (students, feedback items, assignment name) to/from a JSON file. Uses File System Access API for persistent file handles.
- **CSV Export** — Export final grades and feedback in Moodle-compatible CSV format, ready to re-import into Moodle gradebook.

### Student Management

- Searchable, sortable student roster table (name, email, grade, feedback)
- Multi-select students for batch feedback application
- Auto-match submitted files to roster students by email
- Display submission metadata (date, format, status)

### Grading System

- Predefined feedback item library with configurable point deductions
- Drag-and-drop reorder feedback items
- Toggle feedback items on/off per student (or batch apply to multiple students)
- Auto-calculate grade: `maxPoints - sum(applied deductions)`
- Add, edit, delete feedback items
- Sort feedback by comment, deduction, or applied status
- Search feedback items (Ctrl+F)

### AI-Powered Features

- **Predefined Feedback Mode** — AI evaluates student code against defined feedback criteria, returns Yes/No/Unsure per criterion
- **AI-Suggested Feedback** — AI analyzes multiple student submissions and suggests new feedback criteria
- **Custom Prompt Mode** — Freeform AI prompts for open-ended analysis
- **Batch Generation** — Run AI feedback for all students in one action
- Uses GPT-4O-mini model
- Line-level code comments and overall summary feedback

### ZyBooks Multi-Part Lab Workflow

For assignments where ZyBooks has multiple lab parts (e.g. `8.10 - Lab` and `8.11 - Lab`) that can't map cleanly to a single Moodle grade slot.

**Import ZyBooks CSV** button (top control bar, turns green when loaded) — parses the ZyBooks grade export:
- Detects lab part columns by pattern `\d+\.\d+ - Lab \(\d+\)`, extracts max points from the header
- Reads per-student scores (percentages 0–100) keyed by `School email`
- Applies auto-graded heuristic: parts where all non-zero scores are whole numbers are pre-marked auto-graded
- Displays error banner in the student panel if parsing fails

**ZyBooksPanel** — appears inside the student list slide-in panel after CSV import:
- Lists all detected lab parts with name, max points, and status badge (Auto-graded / ZIP not loaded / ZIP loaded / N graded)
- Per-part `Auto-graded` checkbox — when checked, score is taken directly from ZyBooks CSV (no ZIP needed)
- `Load ZIP` button per manual part — triggers the normal ZIP import flow, marks part as loaded
- Clicking a manual row sets it as the **active lab** (shown in an indicator banner)
- `Compute Final Grades` button — enabled when all non-auto-graded parts have been graded

**Active lab** indicator — small banner above the student table showing which lab is currently being graded.

**Grade isolation per lab** — switching between lab parts automatically:
1. Snapshots current student grades/feedback/appliedIds into that lab's saved state
2. Restores saved grades and submission files for the newly selected lab

**Compute Final Grades** — weighted average across all parts, written to `student.grade`:
```
earnedPts = Σ:
  auto part  → (zyBooksScore / 100) × part.maxPoints
  manual part → (manualGrade / moodleMax) × part.maxPoints
finalGrade = (earnedPts / totalZyBooksPoints) × moodleMax
```
After computing, the existing Moodle CSV export writes the final grades.

**Files involved:**
- `src/components/StudentList/hooks/useZyBooksCSVHandling.ts` — CSV parsing hook
- `src/components/ZyBooksPanel/ZyBooksPanel.tsx` — lab parts UI panel
- `src/components/StudentList/types.ts` — `ZyBooksLabPart`, `ZyBooksSession` interfaces
- `src/App.tsx` — session state, `commitActiveLabGrades`, `handleLabSelect`, `handleZipImportForLab`, `handleComputeFinalGrades`

### Change Tracking

- Full change history with timestamps (grade changes, feedback changes, imports)
- Revert individual changes
- Auto-save detection (tracks unsaved changes)
- Debug panel (Ctrl+Shift+D)

### Auto-Save

- Periodic auto-save every 60 seconds when unsaved changes are detected
- Uses File System Access API for persistent saves
- Toggle auto-save on session load
- Status indicator with last-saved timestamp

### UI / UX

- Dark theme: `#222831` / `#393E46` / `#948979` / `#DFD0B8`
- 3-column layout: AI + Feedback | Code Viewer | (extensible right panel)
- Slide-in student list panel (hamburger toggle)
- Collapsible AI settings panel
- Responsive grid layout with scrollable containers

---

## Core Data Types

```typescript
interface Student {
  name: string;
  email: string;
  status?: string;
  grade: string;
  feedback: string;
  appliedIds: number[];
  identifier?: string;
  idNumber?: string;
  maxGrade?: string;
  gradeCanBeChanged?: string;
  onlineText?: string;
  lastModifiedGrade?: string;
  lastModifiedSubmission?: string;
  submissionFiles?: { name: string; content: string }[];
  submissionDate?: string;
  aiFeedback?: {
    lineComments: Record<number, string>;
    overallComments: string[];
    staticAnalysisOutput: string;
    reasoning?: string;
    feedbackResponses?: Record<number, 'yes' | 'no' | 'unsure'>;
  };
}

interface FeedbackItem {
  id: number;
  comment: string;
  grade: number;          // Negative = deduction
  applied?: boolean;
  isAISuggested?: boolean;
  sessionOnly?: boolean;
}

interface ChangeRecord {
  type: 'grade' | 'feedback' | 'import' | 'auto-save';
  studentName: string;
  oldValue: string | { grade: string; feedback: string; appliedIds: number[] };
  newValue: string | { grade: string; feedback: string; appliedIds: number[] };
  timestamp: string;
  message?: string;
}
```

---

## ZyBooks Multi-Part Lab Workflow

> This feature enables grading multi-part ZyBooks lab assignments where each part is submitted separately as a ZIP and the final grade is computed (averaged or weighted) back into the Moodle CSV.

### Flow

1. Import Moodle CSV → student roster loaded
2. Import ZyBooks CSV → lab structure detected (list of lab parts per student)
3. Select a lab to work with from the detected labs
4. For each lab part:
   - Mark as **auto-graded** (skip, no code needed) OR
   - Assign a ZIP file with student code submissions
5. Grade each part independently using the normal feedback workflow
6. When all parts are done, compute final grade:
   - **No weights**: average across all non-auto-graded parts + auto-graded scores from ZyBooks CSV
   - **With weights** (future): weighted average per part
7. Write computed grades into the Moodle student records
8. Export the final Moodle CSV

### ZyBooks CSV Structure (Expected)

Columns include: student name/email, and one column per lab part (e.g., `Lab 5.1`, `Lab 5.2`, `Lab 5.3`). Auto-graded parts already have scores filled in. Manually graded parts may be blank or have placeholder values.

### Key Design Decisions

- ZyBooks lab parts are stored separately from the main student array during the multi-part session
- Auto-graded parts take their score directly from the ZyBooks CSV (no ZIP import needed)
- Manual parts require a ZIP import and go through the normal grading pipeline
- Final grade merge writes only to the Moodle student grade field, preserving all other Moodle metadata
- The Moodle CSV export remains the single export target

---

## State Management

- React hooks pattern (no Redux/Zustand)
- Global state in `App.tsx`, passed down via props
- Custom hooks: `useCSVHandling`, `useZipHandling`
- Local storage: last save filename, file handle metadata
- Session storage: temporary loaded file content

---

## Grading Calculation

```typescript
const totalDeduction = appliedIds.reduce((sum, id) => {
  const feedback = feedbackItems.find(f => f.id === id);
  return sum + (feedback?.grade || 0);
}, 0);
const newGrade = Math.max(0, maxPoints - totalDeduction);
const finalGrade = appliedIds.length > 0 ? newGrade.toString() : '';
```

---

## Development

```bash
npm run dev       # Start dev server (port 3000)
npm run build     # TypeScript check + Vite build
npm run lint      # ESLint
npm run deploy    # Deploy to GitHub Pages
```

Path alias: `@/` → `src/`

---

## Color Palette

| Token | Hex |
|---|---|
| Background | `#222831` |
| Surface | `#393E46` |
| Muted | `#948979` |
| Light | `#DFD0B8` |
