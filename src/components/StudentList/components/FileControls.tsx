import React, { useState, useRef, useEffect } from 'react';
import StatusMessage from '@/components/StatusMessage/StatusMessage';
import './FileControls.css';

interface FileControlsProps {
  onFileImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onZipImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onSaveProgress: () => Promise<boolean | void>;
  onLoadProgress: (e: React.ChangeEvent<HTMLInputElement>, options?: { loadStudents: boolean; loadFeedback: boolean }) => void;
  onSubmit?: () => void;
  error: string;
  autoSaveStatus: string;
  showAutoSaveStatus: boolean;
  hasData: boolean;
  isGradingComplete: boolean;
  isSaving: boolean;
  lastAutoSaveTime?: string;
  fileHandle?: FileSystemFileHandle;
  isNewImport: boolean;
  fileLoadedNoAutoSave?: boolean;
  onEnableAutoSave?: () => void;
}

const FileControls: React.FC<FileControlsProps> = ({
  onFileImport,
  onZipImport,
  onExport,
  onSaveProgress,
  onLoadProgress,
  onSubmit,
  error,
  autoSaveStatus,
  showAutoSaveStatus,
  hasData,
  isGradingComplete,
  isSaving,
  fileHandle,
  fileLoadedNoAutoSave,
  onEnableAutoSave
}) => {
  const [showLoadOptions, setShowLoadOptions] = useState(false);
  const [loadStudents, setLoadStudents] = useState(true);
  const [loadFeedback, setLoadFeedback] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtension, setIsExtension] = useState(false);

  useEffect(() => {
    // Check if we're running from the extension by looking for the data parameter in the URL
    const urlParams = new URLSearchParams(window.location.search);
    setIsExtension(urlParams.has('data'));
  }, []);

  const handleSaveProgress = async () => {
    console.log('Manual save triggered');
    
    // Show a saving indicator
    const result = await onSaveProgress();
    
    console.log(`Manual save completed with result: ${result ? 'SUCCESS' : 'FAILED'}`);
    
    // If save failed, show an error
    if (!result) {
      alert('Save failed. Check the console for details.');
    } else {
      // If save succeeded, verify the file was updated
      console.log('Verifying file was updated...');
      // Additional verification could be added here
    }
  };

  const handleLoadClick = () => {
    setShowLoadOptions(!showLoadOptions);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    onLoadProgress(e, { loadStudents, loadFeedback });
    setShowLoadOptions(false);
  };

  return (
    <>
      <div className="controls-container">
        <div className="buttons">
          <form>
            <label htmlFor="csvFileInput" className="import-file-label">
              Import Roster (CSV from Moodle)
            </label>
            <input
              type="file"
              id="csvFileInput"
              accept=".csv"
              onChange={onFileImport}
              className="import-file-input"
            />
          </form>
          <form>
            <label htmlFor="zipFileInput" className="import-file-label">
              Import Student Submissions (ZIP)
            </label>
            <input
              type="file"
              id="zipFileInput"
              accept=".zip"
              onChange={onZipImport}
              className="import-file-input"
            />
          </form>
          <button 
            className="studentBtn" 
            onClick={onExport}
            disabled={!hasData}
            style={{ opacity: hasData ? 1 : 0.5, cursor: hasData ? 'pointer' : 'not-allowed' }}
            aria-label="Export for Moodle"
          >
            Export for Moodle
          </button>
          <button 
            className="studentBtn" 
            onClick={handleSaveProgress}
            disabled={!hasData || isSaving}
            style={{ 
              opacity: hasData && !isSaving ? 1 : 0.5, 
              cursor: hasData && !isSaving ? 'pointer' : 'not-allowed',
              position: 'relative'
            }}
          >
            {isSaving ? (
              <>
                <span className="saving-spinner"></span>
                Saving...
              </>
            ) : (
              'Save Progress'
            )}
          </button>
          <div className="load-progress-container">
            <button 
              className="studentBtn" 
              onClick={handleLoadClick}
              style={{ cursor: 'pointer' }}
            >
              Load Progress
            </button>
            {isExtension && (
              <button
                className="studentBtn"
                onClick={onSubmit}
                disabled={!hasData || !isGradingComplete}
                style={{ 
                  cursor: (hasData && isGradingComplete) ? 'pointer' : 'not-allowed',
                  opacity: (hasData && isGradingComplete) ? 1 : 0.5,
                  marginLeft: '10px'
                }}
                title={!isGradingComplete ? 'Please complete all grades and feedback before submitting' : ''}
              >
                Submit
              </button>
            )}
            {showLoadOptions && (
              <div className="load-options">
                <div className="checkbox-container">
                  <label>
                    <input
                      type="checkbox"
                      checked={loadStudents}
                      onChange={(e) => setLoadStudents(e.target.checked)}
                    />
                    Load Students
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={loadFeedback}
                      onChange={(e) => setLoadFeedback(e.target.checked)}
                    />
                    Load Feedback
                  </label>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <button 
                  className="studentBtn confirm-load"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!loadStudents && !loadFeedback}
                >
                  Confirm Load
                </button>
              </div>
            )}
          </div>
          {fileLoadedNoAutoSave && (
            <button 
              className="studentBtn highlight-btn" 
              onClick={onEnableAutoSave}
            >
              Enable Auto-Save
            </button>
          )}
        </div>
        
        {/* Show different messages based on whether this is a new import or loaded file */}
        {!fileHandle && (
          <div className="import-status">
            <span className="import-dot"></span>
            Click "Save Progress" to enable auto-save.
          </div>
        )}
        
        {fileHandle && (
          <div className="auto-save-enabled">
            <span className="auto-save-dot"></span>
            Auto-save enabled
          </div>
        )}
      </div>
      
      {/* Keep the status messages */}
      {error && (
        <StatusMessage
          message={error}
          type="error"
          icon="!"
        />
      )}
      {autoSaveStatus && showAutoSaveStatus && (
        <StatusMessage
          message={autoSaveStatus}
          type="success"
          icon=""
        />
      )}
      {autoSaveStatus === 'Please select a location to enable auto-save...' && (
        <StatusMessage
          message="Please select where to save this file to enable auto-save"
          type="success"
          icon=""
        />
      )}
    </>
  );
};

export default FileControls; 