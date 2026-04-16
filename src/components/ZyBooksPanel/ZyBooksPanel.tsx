import React, { useRef } from 'react';
import { ZyBooksSession, ZyBooksLabPart } from '@/components/StudentList/types';

interface ZyBooksPanelProps {
  session: ZyBooksSession;
  onSessionChange: (session: ZyBooksSession) => void;
  onLabSelect: (labId: string) => void;
  onZipImportForLab: (labId: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  onComputeFinalGrades: () => void;
  moodleMaxPoints: number;
}

function getLabStatus(lab: ZyBooksLabPart): { label: string; color: string } {
  if (lab.isAutoGraded) return { label: 'Auto-graded', color: '#4caf83' };
  if (!lab.submissionsLoaded) return { label: 'ZIP not loaded', color: '#948979' };
  const gradedCount = Object.keys(lab.manualGrades).length;
  if (gradedCount === 0) return { label: 'ZIP loaded, not graded', color: '#e8a838' };
  return { label: `${gradedCount} graded`, color: '#4caf83' };
}

function allPartsReady(session: ZyBooksSession): boolean {
  return session.labs.every(lab => {
    if (lab.isAutoGraded) return true;
    return Object.keys(lab.manualGrades).length > 0;
  });
}

const ZyBooksPanel: React.FC<ZyBooksPanelProps> = ({
  session,
  onSessionChange,
  onLabSelect,
  onZipImportForLab,
  onComputeFinalGrades,
  moodleMaxPoints,
}) => {
  const zipInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const toggleAutoGraded = (labId: string) => {
    onSessionChange({
      ...session,
      labs: session.labs.map(lab =>
        lab.id === labId ? { ...lab, isAutoGraded: !lab.isAutoGraded } : lab
      ),
    });
  };

  const ready = allPartsReady(session);

  return (
    <div
      style={{
        background: '#2a2f36',
        border: '1px solid #948979',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '12px',
        color: '#DFD0B8',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#DFD0B8' }}>
            ZyBooks Labs
          </span>
          <span
            style={{
              fontSize: '11px',
              background: '#393E46',
              color: '#948979',
              borderRadius: '4px',
              padding: '1px 7px',
            }}
          >
            Total: {session.totalPoints} pts
          </span>
        </div>
        <span style={{ fontSize: '11px', color: '#948979' }}>
          Moodle max: {moodleMaxPoints} pts
        </span>
      </div>

      {/* Lab parts table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {session.labs.map(lab => {
          const status = getLabStatus(lab);
          const isActive = session.activeLabId === lab.id;

          return (
            <div
              key={lab.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto auto',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 10px',
                borderRadius: '6px',
                background: isActive ? '#393E46' : '#222831',
                border: isActive ? '1px solid #948979' : '1px solid #2e3540',
                cursor: lab.isAutoGraded ? 'default' : 'pointer',
                transition: 'background 0.15s',
              }}
              onClick={() => {
                if (!lab.isAutoGraded) onLabSelect(lab.id);
              }}
            >
              {/* Name + status */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>
                  {lab.name}
                  <span style={{ color: '#948979', fontWeight: 400, marginLeft: '4px', fontSize: '12px' }}>
                    ({lab.maxPoints} pts)
                  </span>
                  {isActive && (
                    <span
                      style={{
                        marginLeft: '8px',
                        fontSize: '10px',
                        background: '#948979',
                        color: '#222831',
                        borderRadius: '3px',
                        padding: '1px 5px',
                        fontWeight: 700,
                      }}
                    >
                      ACTIVE
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: status.color, marginTop: '1px' }}>
                  {status.label}
                </div>
              </div>

              {/* Auto-graded toggle */}
              <label
                style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '12px', color: '#DFD0B8', whiteSpace: 'nowrap' }}
                onClick={e => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={lab.isAutoGraded}
                  onChange={() => toggleAutoGraded(lab.id)}
                  style={{ accentColor: '#4caf83', cursor: 'pointer' }}
                />
                Auto-graded
              </label>

              {/* Load ZIP button */}
              {!lab.isAutoGraded && (
                <>
                  <button
                    style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderRadius: '5px',
                      background: lab.submissionsLoaded ? '#2e4a3c' : '#393E46',
                      color: lab.submissionsLoaded ? '#4caf83' : '#DFD0B8',
                      border: '1px solid #948979',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={e => {
                      e.stopPropagation();
                      zipInputRefs.current[lab.id]?.click();
                    }}
                  >
                    {lab.submissionsLoaded ? '✓ ZIP loaded' : 'Load ZIP'}
                  </button>
                  <input
                    ref={el => { zipInputRefs.current[lab.id] = el; }}
                    type="file"
                    accept=".zip"
                    style={{ display: 'none' }}
                    onChange={e => onZipImportForLab(lab.id, e)}
                  />
                </>
              )}

              {/* Spacer for auto-graded rows (keeps grid alignment) */}
              {lab.isAutoGraded && <div />}
            </div>
          );
        })}
      </div>

      {/* Compute Final Grade button */}
      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={onComputeFinalGrades}
          disabled={!ready}
          style={{
            padding: '7px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
            background: ready ? '#4caf83' : '#393E46',
            color: ready ? '#222831' : '#948979',
            border: 'none',
            cursor: ready ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
          }}
        >
          Compute Final Grades
        </button>
        {!ready && (
          <span style={{ fontSize: '11px', color: '#948979' }}>
            Grade all non-auto parts first
          </span>
        )}
        {ready && (
          <span style={{ fontSize: '11px', color: '#4caf83' }}>
            Ready — will write grades to Moodle roster
          </span>
        )}
      </div>
    </div>
  );
};

export default ZyBooksPanel;
