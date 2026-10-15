import { useState } from 'react';
import { Student, ChangeRecord } from '@/components/StudentList/types';
import { parseMultiSubmissionZip, StudentSubmission } from '@/lib/zipUtils';

export const useZipHandling = (
  students: Student[],
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>,
  onChangeTracked?: (change: ChangeRecord) => void
) => {
  const [zipError, setZipError] = useState<string>("");
  const [zipStatus, setZipStatus] = useState<string>("");

  const matchStudentByEmail = (email: string, studentList: Student[]): Student | undefined => {
    const normalizedEmail = email.toLowerCase().trim();
    return studentList.find(student => student.email.toLowerCase().trim() === normalizedEmail);
  };

  // Fallback: match by name parts when the ZIP filename has a compound last name
  // e.g. "Vanden_Heuvel_Abigail_..." parses as lastName="Vanden", firstName="Heuvel"
  // but the roster has "Abigail Vanden Heuvel" — both parts appear in the full name
  const matchStudentByName = (sub: StudentSubmission, studentList: Student[]): Student | undefined => {
    const subLast = sub.lastName.toLowerCase().trim();
    const subFirst = sub.firstName.toLowerCase().trim();
    if (!subLast || !subFirst) return undefined;
    return studentList.find(student => {
      const fullName = student.name.toLowerCase();
      return fullName.includes(subLast) && fullName.includes(subFirst);
    });
  };

  const handleZipImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setZipError("");
    setZipStatus("Parsing ZIP file...");

    try {
      const result = await parseMultiSubmissionZip(file);

      console.log('====== ZIP PARSING RESULT ======');
      console.log('Total students in ZIP:', result.totalStudents);
      console.log('Successful extractions:', result.successfulExtractions);
      console.log('Extracted student emails:', result.students.map(s => s.email));
      console.log('Current roster emails:', students.map(s => s.email));
      console.log('Errors:', result.errors);
      console.log('================================');

      if (result.errors.length > 0) {
        console.warn('ZIP parsing errors:', result.errors);
      }

      // Match ZIP submissions with CSV roster
      let matchedCount = 0;
      let unmatchedSubmissions: StudentSubmission[] = [];

      console.log('====== STARTING EMAIL MATCHING ======');
      const updatedStudents = students.map(student => {
        const submission = result.students.find(sub => {
          // Primary: exact email match
          if (matchStudentByEmail(sub.email, [student])) {
            console.log(`✓ Email match: "${sub.email}" → "${student.email}"`);
            return true;
          }
          // Fallback: name-based match (handles compound last names like "Vanden Heuvel")
          if (matchStudentByName(sub, [student])) {
            console.log(`✓ Name fallback match: "${sub.lastName} ${sub.firstName}" → "${student.name}"`);
            return true;
          }
          return false;
        });

        if (submission) {
          matchedCount++;
          return {
            ...student,
            submissionFiles: submission.files,
            submissionDate: submission.submissionDate,
          };
        }

        return student;
      });
      console.log('====== MATCHING COMPLETE ======');

      // Find unmatched submissions (neither email nor name matched)
      unmatchedSubmissions = result.students.filter(sub => {
        return !matchStudentByEmail(sub.email, students) && !matchStudentByName(sub, students);
      });

      setStudents(updatedStudents);

      // Generate status message
      let statusMsg = `Imported ${matchedCount} student submissions`;
      if (unmatchedSubmissions.length > 0) {
        statusMsg += `. ${unmatchedSubmissions.length} submission(s) not found in roster: ${unmatchedSubmissions.map(s => s.email).join(', ')}`;
        console.warn('Unmatched submissions:', unmatchedSubmissions);
      }
      if (result.errors.length > 0) {
        statusMsg += `. ${result.errors.length} error(s) occurred.`;
      }

      setZipStatus(statusMsg);

      // Track the import
      onChangeTracked?.({
        type: 'import',
        studentName: 'System',
        timestamp: new Date().toISOString(),
        message: `ZIP submissions imported: ${matchedCount} matched, ${unmatchedSubmissions.length} unmatched`,
        oldValue: '',
        newValue: ''
      });

      // Clear status after 5 seconds
      setTimeout(() => setZipStatus(""), 5000);

    } catch (error) {
      console.error('Error parsing ZIP:', error);
      setZipError(`Error parsing ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setZipStatus("");
    }

    // Reset the file input
    e.target.value = '';
  };

  return {
    zipError,
    zipStatus,
    handleZipImport
  };
};
