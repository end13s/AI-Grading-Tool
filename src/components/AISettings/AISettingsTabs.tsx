import { useState } from 'react';

export type AIMode = 'predefined' | 'ai-suggested' | 'custom-prompt';

interface AISettingsTabsProps {
  currentMode: AIMode;
  onModeChange: (mode: AIMode) => void;
}

export default function AISettingsTabs({ currentMode, onModeChange }: AISettingsTabsProps) {
  const tabs: { id: AIMode; label: string; description: string }[] = [
    {
      id: 'predefined',
      label: 'Predefined Feedback',
      description: 'Use existing feedback criteria'
    },
    {
      id: 'ai-suggested',
      label: 'AI-Suggested',
      description: 'AI recommends new feedback'
    },
    {
      id: 'custom-prompt',
      label: 'Custom Prompt',
      description: 'Use your own evaluation criteria'
    }
  ];

  return (
    <div className="w-full rounded-lg overflow-hidden" style={{ background: '#222831', border: '1px solid #948979' }}>
      <div className="flex" style={{ borderBottom: '1px solid #393E46' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onModeChange(tab.id)}
            className="flex-1 px-4 py-3 text-sm font-medium transition-colors"
            style={{
              background: currentMode === tab.id ? '#393E46' : '#222831',
              color: currentMode === tab.id ? '#DFD0B8' : '#948979',
              borderBottom: currentMode === tab.id ? '2px solid #DFD0B8' : 'none'
            }}
          >
            <div className="flex flex-col items-center">
              <span>{tab.label}</span>
              <span className="text-xs mt-1 opacity-75">{tab.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
