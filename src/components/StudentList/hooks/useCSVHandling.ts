import { useState } from 'react';
import Papa, { ParseResult } from 'papaparse';
import { saveAs } from 'file-saver';
import { Student, ChangeRecord } from '../types';

export const useCSVHandling = (
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>,
  assignmentName: string,
  students: Student[],
  onChangeTracked?: (change: ChangeRecord) => void,
  setMaxPoints?: (maxPoints: number) => void
) => {
  const [error, setError] = useState<string>("");

  const validateCSV = (data: string[][]): boolean => {
    try {
      if (data.length === 0) {
        setError("Empty CSV file");
        return false;
      }

      const headerRow = data[0];
      const requiredHeaders: string[] = [
        "Full name",
        "Email address"
      ];

      const missingHeaders = requiredHeaders.filter((header) => !headerRow.includes(header));
      if (missingHeaders.length > 0) {
        setError(`Missing required columns: ${missingHeaders.join(", ")}`);
        return false;
      }

      return true;
    } catch (err: unknown) {
      console.error('CSV validation error:', err);
      setError("Error validating the CSV file.");
      return false;
    }
  };

  const processCSVData = (csvData: string[][]): Student[] => {
    const headerRow = csvData[0];
    let maxGradeFound = '';

    // Find the index of the Maximum grade column (lowercase 'g' in Moodle exports)
    const maxGradeIndex = headerRow.findIndex(header =>
      header === 'Maximum grade' || header === 'Maximum Grade'
    );
    console.log('Maximum grade column index:', maxGradeIndex);

    // Get the first non-empty maximum grade value from the data rows
    if (maxGradeIndex !== -1) {
      for (let i = 1; i < csvData.length; i++) {
        const row = csvData[i];
        if (row[maxGradeIndex] && row[maxGradeIndex].trim() !== '') {
          const rawValue = row[maxGradeIndex].trim();
          // Try to parse the value, removing any non-numeric characters except decimal point
          const cleanedValue = rawValue.replace(/[^\d.]/g, '');
          if (cleanedValue) {
            maxGradeFound = cleanedValue;
            console.log('Found maximum grade value:', maxGradeFound);
            break;
          }
        }
      }
    }

    const processedStudents = csvData.slice(1).map(row => {
      const student: Student = {
        name: '',
        email: '',
        grade: '',
        feedback: '',
        appliedIds: [],
        maxGrade: '',
      };

      headerRow.forEach((header, index) => {
        const value = row[index] || '';
        switch(header) {
          case 'Identifier': student.identifier = value; break;
          case 'Full name': student.name = value; break;
          case 'ID number': student.idNumber = value; break;
          case 'Email address': student.email = value; break;
          case 'Status': student.status = value; break;
          case 'Grade': student.grade = value; break;
          case 'Grade can be changed': student.gradeCanBeChanged = value; break;
          case 'Last modified (submission)': student.lastModifiedSubmission = value; break;
          case 'Last modified (grade)': student.lastModifiedGrade = value; break;
          case 'Feedback comments': student.feedback = value; break;
          case 'Maximum grade':
          case 'Maximum Grade': {
            // Clean and validate the max grade value
            const cleanedGrade = value.trim().replace(/[^\d.]/g, '');
            student.maxGrade = cleanedGrade || maxGradeFound;
            break;
          }
        }
      });

      return student;
    });

    // Update the max points in the parent component if we found a value
    if (maxGradeFound && setMaxPoints) {
      console.log('Setting max points from CSV:', maxGradeFound);
      const numericValue = parseFloat(maxGradeFound);
      if (!isNaN(numericValue) && numericValue > 0) {
        console.log('Setting valid max points value:', numericValue);
        setMaxPoints(numericValue);
      } else {
        console.warn('Invalid maximum points value:', maxGradeFound);
        setError("Invalid maximum points value in CSV");
      }
    } else {
      console.warn('No valid maximum grade value found in CSV');
    }

    return processedStudents;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('====== CSV IMPORT STARTED ======');
    console.log('File name:', file.name);
    console.log('File size:', file.size);

    try {
      const content = await file.text();
      console.log('CSV content read, length:', content.length);

      Papa.parse(content, {
        header: false,
        skipEmptyLines: true,
        complete: (results: ParseResult<string[]>) => {
          console.log('CSV parsed, rows:', results.data.length);
          console.log('First row (headers):', results.data[0]);

          if (validateCSV(results.data)) {
            console.log('CSV validation passed');
            const students = processCSVData(results.data);
            console.log('Processed students count:', students.length);
            console.log('Student emails:', students.map(s => s.email));
            setStudents(students);
            console.log('setStudents called with', students.length, 'students');
            trackImport();
          } else {
            console.log('CSV validation FAILED');
          }
        },
        error: (error) => {
          console.error('Papa parse error:', error);
          setError(`CSV parsing error: ${error.message}`);
        }
      });
    } catch (error) {
      console.error('Error reading CSV:', error);
      setError("Error reading the CSV file");
    }
  };

  const exportForMoodle = () => {
    try {
      if (students.length === 0) {
        setError("No CSV imported");
        return;
      }

      const csvRows = [
        [
          "Identifier",
          "Full name",
          "ID number",
          "Email address",
          "Status",
          "Grade",
          "Maximum Grade",
          "Grade can be changed",
          "Last modified (submission)",
          "Online text",
          "Last modified (grade)",
          "Feedback comments"
        ],
        ...students.map(student => [
          student.identifier,
          student.name,
          student.idNumber,
          student.email,
          student.status,
          student.grade,
          student.maxGrade,
          student.gradeCanBeChanged,
          student.lastModifiedSubmission,
          student.onlineText,
          student.lastModifiedGrade,
          student.feedback
        ])
      ];
      
      const csvContent = Papa.unparse(csvRows);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const defaultFilename = `${assignmentName.toLowerCase().replace(/\s+/g, '_')}_grades.csv`;
      
      saveAs(blob, defaultFilename);
    } catch (err: unknown) {
      console.error('CSV parsing error:', err);
      setError("Error exporting the CSV file.");
    }
  };

  const trackImport = () => {
    onChangeTracked?.({
      type: 'import',
      studentName: 'System',
      timestamp: new Date().toISOString(),
      message: 'CSV data imported',
      oldValue: '',
      newValue: ''
    });
  };

  return {
    error,
    handleFileChange,
    exportForMoodle
  };
}; 