import JSZip from "jszip";

export interface StudentSubmission {
  email: string;
  lastName: string;
  firstName: string;
  submissionDate: string;
  files: {
    name: string;
    content: string;
  }[];
}

export interface ParsedSubmissions {
  students: StudentSubmission[];
  totalStudents: number;
  successfulExtractions: number;
  errors: string[];
}

export function parseStudentInfo(filename: string): {
  lastName: string;
  firstName: string;
  email: string;
  date: string;
} | null {
  console.log("Parsing student info from:", filename);

  // Moodle Canvas format: LASTNAME_FIRSTNAME_USERNAMEcalvin.edu_DATE.zip
  // Example: Segura_Joshua_jgs32calvin.edu_2025-10-10_23-43-22.zip
  const parts = filename.split("_");

  if (parts.length >= 4) {
    // In Moodle format: parts[0]=LastName, parts[1]=FirstName, parts[2]=email (without @), parts[3+]=date
    const lastName = parts[0] || 'Unknown';
    const firstName = parts[1] || 'Student';
    let emailToken = parts[2] || '';
    const date = parts.slice(3).join("_") || 'unknown';

    let email = emailToken;

    // If token doesn't contain '@', it's probably in format: usernamecalvin.edu
    if (!emailToken.includes("@")) {
      // Specifically handle calvin.edu domain (the most common case)
      if (emailToken.includes('calvin.edu')) {
        const username = emailToken.replace('calvin.edu', '');
        email = `${username}@calvin.edu`;
        console.log(`Converted ${emailToken} to ${email}`);
      } else if (emailToken.includes('student.edu')) {
        const username = emailToken.replace('student.edu', '');
        email = `${username}@student.edu`;
        console.log(`Converted ${emailToken} to ${email}`);
      } else {
        // Try general pattern: look for text followed by domain.tld
        // Match username (letters/numbers) followed by domain like "calvin.edu"
        const match = emailToken.match(/^([a-z0-9._%-]+)((?:[a-z]+\.)+[a-z]{2,})$/i);
        if (match) {
          const username = match[1];
          const domain = match[2];
          email = `${username}@${domain}`;
          console.log(`Generic match: Converted ${emailToken} to ${email}`);
        } else {
          // Last resort
          email = `${emailToken}@student.edu`;
          console.log(`Last resort: Using ${email}`);
        }
      }
    }

    return {
      lastName,
      firstName,
      email,
      date,
    };
  }

  // Format 2: ZyBooks format - often includes email in different positions
  // Look for email anywhere in the parts
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].includes("@")) {
      const email = parts[i];
      const lastName = parts[0] || "Unknown";
      const firstName = parts[1] || "Unknown";
      const date = parts[parts.length - 1] || "unknown";

      return {
        lastName,
        firstName,
        email,
        date,
      };
    }
  }

  // Format 3: Try to extract email from any part containing @
  const emailPart = parts.find(part => part.includes("@"));
  if (emailPart) {
    // Use email as identifier if we can't parse name properly
    return {
      lastName: parts[0] || "Unknown",
      firstName: parts[1] || "Student",
      email: emailPart,
      date: parts[parts.length - 1] || "unknown",
    };
  }

  // Format 4: ZyBooks might use different separators or formats
  // Try splitting by different delimiters
  if (filename.includes("-")) {
    const dashParts = filename.split("-");
    const emailPart = dashParts.find(part => part.includes("@"));
    if (emailPart) {
      return {
        lastName: dashParts[0] || "Unknown",
        firstName: dashParts[1] || "Student",
        email: emailPart,
        date: dashParts[dashParts.length - 1] || "unknown",
      };
    }
  }

  // Format 5: If no email found, use the filename as a fallback
  if (parts.length >= 1) {
    // Generate a reasonable email from the filename
    const baseName = parts[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    return {
      lastName: parts[0] || "Unknown",
      firstName: parts[1] || "Student",
      email: `${baseName}@student.edu`,
      date: "unknown",
    };
  }

  console.log("Could not parse student info from:", filename);
  return null;
}

export async function parseMultiSubmissionZip(
  file: File,
): Promise<ParsedSubmissions> {
  const result: ParsedSubmissions = {
    students: [],
    totalStudents: 0,
    successfulExtractions: 0,
    errors: [],
  };

  try {
    const zip = await JSZip.loadAsync(file);

    // Debug: Log all files in the ZIP to understand structure
    const allFiles = Object.keys(zip.files);
    console.log("ZIP contents:", allFiles);

    // Look for nested ZIP files (Canvas format) or direct student folders
    let studentFolders = allFiles.filter(
      (name) => name.endsWith(".zip") && !name.includes("/"),
    );

    // If no root-level ZIPs, look for ZIPs in subdirectories (Canvas format)
    if (studentFolders.length === 0) {
      studentFolders = allFiles.filter(name => name.endsWith(".zip"));
      console.log("Found nested ZIP files:", studentFolders);
    }

    // If still no ZIPs, look for student directories with Python files (ZyBooks format)
    if (studentFolders.length === 0) {
      const studentDirs = allFiles
        .filter(name => name.includes("/") && !name.endsWith("/"))
        .map(name => name.split("/")[0])
        .filter((dir, index, arr) => arr.indexOf(dir) === index); // unique directories

      console.log("Found student directories:", studentDirs);

      // If no obvious directories, try looking for any Python files directly
      if (studentDirs.length === 0) {
        const pythonFiles = allFiles.filter(name => name.endsWith(".py"));
        console.log("Found direct Python files:", pythonFiles);

        if (pythonFiles.length > 0) {
          // Group files by potential student identifier
          const filesByStudent: Record<string, string[]> = {};

          for (const filePath of pythonFiles) {
            // Try to extract student identifier from filename
            const fileName = filePath.split("/").pop() || filePath;
            let studentKey = "unknown_student";

            // Look for email or name patterns in filename
            if (fileName.includes("@")) {
              const emailMatch = fileName.match(/([^@]+@[^@\s]+)/);
              if (emailMatch) {
                studentKey = emailMatch[1];
              }
            } else {
              // Use the base filename without extension as student key
              studentKey = fileName.replace(/\.(py|txt)$/, "");
            }

            if (!filesByStudent[studentKey]) {
              filesByStudent[studentKey] = [];
            }
            filesByStudent[studentKey].push(filePath);
          }

          // Process each student group
          for (const [studentKey, files] of Object.entries(filesByStudent)) {
            const studentInfo = parseStudentInfo(studentKey);
            if (studentInfo) {
              const pythonFiles: { name: string; content: string }[] = [];

              for (const filePath of files) {
                try {
                  const zipEntry = zip.files[filePath];
                  const content = await zipEntry.async("text");
                  pythonFiles.push({
                    name: filePath.split("/").pop() || filePath,
                    content,
                  });
                } catch (error) {
                  result.errors.push(`Failed to read ${filePath}: ${error}`);
                }
              }

              if (pythonFiles.length > 0) {
                result.students.push({
                  email: studentInfo.email,
                  lastName: studentInfo.lastName,
                  firstName: studentInfo.firstName,
                  submissionDate: studentInfo.date,
                  files: pythonFiles,
                });
                result.successfulExtractions++;
              }
            }
          }

          result.totalStudents = Object.keys(filesByStudent).length;
          return result;
        }
      }

      // Process directories directly
      for (const dirName of studentDirs) {
        const pythonFilesInDir = allFiles.filter(
          name => name.startsWith(`${dirName}/`) && name.endsWith(".py")
        );

        if (pythonFilesInDir.length > 0) {
          const studentInfo = parseStudentInfo(dirName);
          if (studentInfo) {
            const pythonFiles: { name: string; content: string }[] = [];

            for (const filePath of pythonFilesInDir) {
              try {
                const zipEntry = zip.files[filePath];
                const content = await zipEntry.async("text");
                pythonFiles.push({
                  name: filePath.split("/").pop() || filePath,
                  content,
                });
              } catch (error) {
                result.errors.push(`Failed to read ${filePath}: ${error}`);
              }
            }

            if (pythonFiles.length > 0) {
              result.students.push({
                email: studentInfo.email,
                lastName: studentInfo.lastName,
                firstName: studentInfo.firstName,
                submissionDate: studentInfo.date,
                files: pythonFiles,
              });
              result.successfulExtractions++;
            }
          } else {
            result.errors.push(`Could not parse student info from directory: ${dirName}`);
          }
        }
      }

      result.totalStudents = studentDirs.length;
      return result;
    }

    result.totalStudents = studentFolders.length;

    for (const studentZipPath of studentFolders) {
      try {
        const studentZipFile = zip.files[studentZipPath];
        const studentZipContent = await studentZipFile.async("arraybuffer");
        const studentZip = await JSZip.loadAsync(studentZipContent);

        // Parse student info from filename
        const filename = studentZipPath.replace(".zip", "");
        const studentInfo = parseStudentInfo(filename);

        if (!studentInfo) {
          result.errors.push(`Could not parse student info from: ${filename}`);
          continue;
        }

        // Extract Python files from student's zip
        const pythonFiles: { name: string; content: string }[] = [];

        for (const [filePath, zipEntry] of Object.entries(studentZip.files)) {
          if (!zipEntry.dir && filePath.endsWith(".py")) {
            try {
              const content = await zipEntry.async("text");
              pythonFiles.push({
                name: filePath,
                content,
              });
            } catch (error) {
              result.errors.push(
                `Failed to read ${filePath} for ${studentInfo.email}: ${error}`,
              );
            }
          }
        }

        if (pythonFiles.length === 0) {
          result.errors.push(`No Python files found for ${studentInfo.email}`);
          continue;
        }

        const student: StudentSubmission = {
          email: studentInfo.email,
          lastName: studentInfo.lastName,
          firstName: studentInfo.firstName,
          submissionDate: studentInfo.date,
          files: pythonFiles,
        };

        result.students.push(student);
        result.successfulExtractions++;
      } catch (error) {
        result.errors.push(`Failed to process ${studentZipPath}: ${error}`);
      }
    }
  } catch (error) {
    result.errors.push(`Failed to parse main ZIP file: ${error}`);
  }

  return result;
}

export function getStudentDisplayName(student: StudentSubmission): string {
  return `${student.firstName} ${student.lastName} (${student.email})`;
}

export function getMainPythonFile(
  student: StudentSubmission,
): { name: string; content: string } | null {
  // Try to find main.py first, then the first .py file
  const mainFile = student.files.find((f) =>
    f.name.toLowerCase().includes("main.py"),
  );
  if (mainFile) return mainFile;

  return student.files[0] || null;
}
