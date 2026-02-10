import React from 'react';
import StatusMessage from '@/components/StatusMessage/StatusMessage';
import './FileControls.css';

interface FileControlsProps {
  error: string;
  autoSaveStatus: string;
  showAutoSaveStatus: boolean;
  fileHandle?: FileSystemFileHandle;
}

const FileControls: React.FC<FileControlsProps> = ({
  error,
  autoSaveStatus,
  showAutoSaveStatus,
  fileHandle,
}) => {
  return (
    <>
      <div className="controls-container">
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
