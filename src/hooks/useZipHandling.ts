import { useState } from 'react';
import { Student, ChangeRecord } from '../types';
import { parseMultiSubmissionZip, StudentSubmission } from '@/lib/zipUtils';

export const useZipHandling = (
  students: Student[],
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>,
  onChangeTracked?: (change: ChangeRecord) => void
) => {
  const [zipError, setZipError] = useState<string>("");
  const [zipStatus, setZipStatus] = useState<string>("");

  const matchStudentByEmail = (email: string, studentList: Student[]): Student | undefined => {
    // Normalize email for comparison
    const normalizedEmail = email.toLowerCase().trim();

    return studentList.find(student => {
      const studentEmail = student.email.toLowerCase().trim();
      return studentEmail === normalizedEmail;
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
          const matched = matchStudentByEmail(sub.email, [student]);
          console.log(`Trying to match ZIP email "${sub.email}" with roster email "${student.email}": ${matched ? 'MATCH' : 'no match'}`);
          return matched !== undefined;
        });

        if (submission) {
          matchedCount++;
          console.log(`✓ Successfully matched ${submission.email} with ${student.email}`);

          return {
            ...student,
            submissionFiles: submission.files,
            submissionDate: submission.submissionDate,
          };
        }

        return student;
      });
      console.log('====== MATCHING COMPLETE ======');

      // Find unmatched submissions
      unmatchedSubmissions = result.students.filter(sub => {
        const matched = matchStudentByEmail(sub.email, students);
        return matched === undefined;
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
