import { useState } from 'react';

interface CustomPromptModeProps {
  onGenerateFeedback: (customPrompt: string) => void;
  isGenerating: boolean;
  hasSelectedStudent: boolean;
  hasStudentsWithCode: boolean;
}

export default function CustomPromptMode({
  onGenerateFeedback,
  isGenerating,
  hasSelectedStudent,
  hasStudentsWithCode
}: CustomPromptModeProps) {
  const [customPrompt, setCustomPrompt] = useState('');
  const [promptFile, setPromptFile] = useState<File | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      setCustomPrompt(content);
      setPromptFile(file);
    } catch (error) {
      console.error('Error reading prompt file:', error);
      alert('Failed to read the file. Please try again.');
    }
  };

  const handleGenerate = () => {
    if (!customPrompt.trim()) {
      alert('Please enter a custom prompt or upload a file');
      return;
    }
    onGenerateFeedback(customPrompt);
  };

  return (
    <div className="space-y-4 p-4 rounded-lg" style={{ background: '#222831', border: '1px solid #948979' }}>
      <h3 style={{ color: '#DFD0B8' }} className="font-semibold text-lg">Custom Evaluation Criteria</h3>

      <div className="space-y-2">
        <label style={{ color: '#DFD0B8' }} className="text-sm font-medium">
          Enter your evaluation criteria or upload a file:
        </label>

        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="Enter your custom evaluation criteria here...&#10;&#10;Example:&#10;- Check if the code follows PEP 8 style guidelines&#10;- Verify proper error handling&#10;- Assess code modularity and reusability"
          className="w-full h-48 px-3 py-2 rounded text-sm font-mono resize-y"
          style={{
            background: '#393E46',
            color: '#DFD0B8',
            border: '1px solid #948979'
          }}
        />

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 px-4 py-2 rounded cursor-pointer text-sm" style={{ background: '#393E46', color: '#DFD0B8', border: '1px solid #948979' }}>
            <span>Upload Prompt File</span>
            <input
              type="file"
              accept=".txt,.md"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          {promptFile && (
            <span style={{ color: '#948979' }} className="text-sm">
              Loaded: {promptFile.name}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <button
          onClick={handleGenerate}
          disabled={!hasSelectedStudent || isGenerating || !customPrompt.trim()}
          className="w-full px-4 py-2"
        >
          {isGenerating ? 'Generating...' : 'Generate Feedback (Selected Student)'}
        </button>

        <button
          onClick={() => {
            // TODO: Implement batch with custom prompt
            alert('Batch generation with custom prompt will be implemented');
          }}
          disabled={!hasStudentsWithCode || isGenerating || !customPrompt.trim()}
          className="w-full px-4 py-2"
        >
          {isGenerating ? 'Generating...' : 'Generate Batch Feedback (All Students)'}
        </button>
      </div>

      <div style={{ color: '#948979' }} className="text-xs space-y-1">
        <p>Tip: Your custom prompt will be sent to the AI along with the student's code.</p>
        <p>The AI will evaluate the code based on your specific criteria.</p>
      </div>
    </div>
  );
}
