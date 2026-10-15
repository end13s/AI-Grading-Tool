import { useState } from 'react';
import { getModel, storeModel, SUGGESTED_MODELS, DEFAULT_MODEL } from '@/lib/aiConfig';
import { testLLMConnection, validateAPIKey } from '@/lib/llm';

interface ApiKeySettingsProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

const inputStyle = { background: '#222831', color: '#DFD0B8', border: '1px solid #948979' };

function maskKey(key: string) {
  return key.length > 8 ? `${key.slice(0, 3)}…${key.slice(-4)}` : '••••';
}

export default function ApiKeySettings({ apiKey, onApiKeyChange }: ApiKeySettingsProps) {
  const [isOpen, setIsOpen] = useState(!apiKey);
  const [draftKey, setDraftKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(getModel);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const saveKey = () => {
    const check = validateAPIKey(draftKey.trim());
    if (!check.valid) {
      setStatus({ ok: false, text: check.error ?? 'Invalid key' });
      return;
    }
    onApiKeyChange(draftKey);
    setDraftKey('');
    setStatus({ ok: true, text: 'Key saved in this browser.' });
  };

  const clearKey = () => {
    onApiKeyChange('');
    setStatus(null);
    setIsOpen(true);
  };

  const saveModel = (value: string) => {
    setModel(value);
    storeModel(value);
  };

  const testConnection = async () => {
    setIsTesting(true);
    setStatus(null);
    const result = await testLLMConnection(apiKey);
    setStatus(result.success ? { ok: true, text: `Connected (${getModel()}).` } : { ok: false, text: result.error ?? 'Connection failed' });
    setIsTesting(false);
  };

  if (!isOpen) {
    return (
      <div className="flex items-center justify-between text-sm" style={{ color: '#948979' }}>
        <span>
          Key {maskKey(apiKey)} · {model}
        </span>
        <button onClick={() => setIsOpen(true)} className="px-2 py-1 text-xs">
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 rounded-lg" style={{ background: '#222831', border: '1px solid #948979' }}>
      <h4 style={{ color: '#DFD0B8' }} className="font-medium">OpenAI API key</h4>

      {apiKey ? (
        <div className="flex items-center justify-between text-sm" style={{ color: '#DFD0B8' }}>
          <span>Saved: {maskKey(apiKey)}</span>
          <div className="flex gap-2">
            <button onClick={testConnection} disabled={isTesting} className="px-2 py-1 text-xs">
              {isTesting ? 'Testing…' : 'Test'}
            </button>
            <button onClick={clearKey} className="px-2 py-1 text-xs">Remove</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={draftKey}
            onChange={e => setDraftKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveKey()}
            placeholder="sk-..."
            autoComplete="off"
            spellCheck={false}
            className="flex-1 px-3 py-2 rounded text-sm focus:outline-none"
            style={inputStyle}
            aria-label="OpenAI API key"
          />
          <button onClick={() => setShowKey(s => !s)} className="px-2 py-1 text-xs" aria-label={showKey ? 'Hide key' : 'Show key'}>
            {showKey ? 'Hide' : 'Show'}
          </button>
          <button onClick={saveKey} disabled={!draftKey.trim()} className="px-3 py-1 text-sm">Save</button>
        </div>
      )}

      <label className="block text-sm" style={{ color: '#948979' }}>
        Model
        <input
          list="ai-model-options"
          value={model}
          onChange={e => saveModel(e.target.value)}
          onBlur={e => !e.target.value.trim() && saveModel(DEFAULT_MODEL)}
          className="mt-1 w-full px-3 py-2 rounded text-sm focus:outline-none"
          style={inputStyle}
        />
        <datalist id="ai-model-options">
          {SUGGESTED_MODELS.map(m => <option key={m} value={m} />)}
        </datalist>
      </label>

      {status && (
        <p className="text-sm" style={{ color: status.ok ? '#9BC59D' : '#E07A5F' }}>{status.text}</p>
      )}

      <p className="text-xs" style={{ color: '#948979' }}>
        Stored only in this browser. Requests go straight from your browser to OpenAI; the key never reaches a server of ours.
      </p>

      {apiKey && (
        <button onClick={() => setIsOpen(false)} className="w-full px-3 py-1 text-xs">Done</button>
      )}
    </div>
  );
}
