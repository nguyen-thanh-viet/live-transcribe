import React, { useState } from 'react';

interface SettingsProps {
  onClose: () => void;
  onSave: (apiKey: string, model: string) => void;
  initialApiKey: string;
  initialModel: string;
}

export const Settings: React.FC<SettingsProps> = ({ onClose, onSave, initialApiKey, initialModel }) => {
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [model, setModel] = useState(initialModel);

  const handleSave = () => {
    onSave(apiKey, model);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel">
        <h2>Settings</h2>
        
        <div className="form-group">
          <label htmlFor="apiKey">Gemini API Key</label>
          <input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza..."
          />
        </div>

        <div className="form-group">
          <label htmlFor="model">Model Name</label>
          <input
            id="model"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="models/gemini-3.1-flash-live-preview"
          />
          <small style={{color: 'var(--text-secondary)', marginTop: '4px'}}>
            Default: models/gemini-3.1-flash-live-preview. Ensure you specify "models/" prefix.
          </small>
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
};
