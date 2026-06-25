import { useState, useEffect } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { Settings } from './components/Settings';
import { Transcriber } from './components/Transcriber';
import { History } from './components/History';
import type { TranscriptionHistoryItem } from './types';

function App() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('models/gemini-3.1-flash-live-preview');
  const [showSettings, setShowSettings] = useState(false);
  const [history, setHistory] = useState<TranscriptionHistoryItem[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<TranscriptionHistoryItem | null>(null);

  useEffect(() => {
    // Load from local storage
    const storedKey = localStorage.getItem('gemini_api_key');
    const storedModel = localStorage.getItem('gemini_model');
    const storedHistory = localStorage.getItem('transcription_history');

    if (storedKey) setApiKey(storedKey);
    else setShowSettings(true); // show settings if no key

    if (storedModel) setModel(storedModel);
    if (storedHistory) {
      try {
        setHistory(JSON.parse(storedHistory));
      } catch (e) {
        console.error('Failed to parse history');
      }
    }
  }, []);

  const handleSaveSettings = (newKey: string, newModel: string) => {
    setApiKey(newKey);
    setModel(newModel);
    localStorage.setItem('gemini_api_key', newKey);
    localStorage.setItem('gemini_model', newModel || 'models/gemini-3.1-flash-live-preview');
    setShowSettings(false);
  };

  const handleSaveHistory = (item: TranscriptionHistoryItem) => {
    const newHistory = [item, ...history];
    setHistory(newHistory);
    localStorage.setItem('transcription_history', JSON.stringify(newHistory));
  };

  const handleDeleteHistoryItem = (id: string) => {
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    localStorage.setItem('transcription_history', JSON.stringify(newHistory));
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('transcription_history');
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>
          <div style={{width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)'}}></div>
          Gemini Live Transcriber
        </h1>
        <button onClick={() => setShowSettings(true)} title="Settings">
          <SettingsIcon size={20} /> Settings
        </button>
      </header>

      <main className="main-content">
        <Transcriber 
          apiKey={apiKey} 
          model={model} 
          onSaveHistory={handleSaveHistory}
          selectedHistoryItem={selectedHistoryItem}
        />
        
        <aside className="sidebar">
          <History 
            items={history} 
            onSelect={setSelectedHistoryItem}
            onDelete={handleDeleteHistoryItem} 
            onClearAll={handleClearHistory} 
          />
        </aside>
      </main>

      {showSettings && (
        <Settings
          initialApiKey={apiKey}
          initialModel={model}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
