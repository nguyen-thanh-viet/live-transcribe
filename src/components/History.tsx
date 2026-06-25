import { Clock, Trash2, Mic, MonitorUp } from 'lucide-react';
import type { TranscriptionHistoryItem } from '../types';

interface HistoryProps {
  items: TranscriptionHistoryItem[];
  onSelect: (item: TranscriptionHistoryItem) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export const History: React.FC<HistoryProps> = ({ items, onSelect, onDelete, onClearAll }) => {
  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '500px' }}>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={20} /> History
        </h3>
        {items.length > 0 && (
          <button className="danger" onClick={onClearAll} style={{ padding: '0.4em 0.8em', fontSize: '0.85rem' }}>
            Clear All
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>
          No transcriptions saved yet.
        </div>
      ) : (
        <ul className="history-list">
          {items.map(item => (
            <li key={item.id} className="history-item" onClick={() => onSelect({ ...item, _trigger: Date.now() } as any)} style={{ cursor: 'pointer' }}>
              <div className="history-item-header">
                <span style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                  {item.sourceType === 'microphone' ? <Mic size={14}/> : <MonitorUp size={14}/>}
                  {new Date(item.timestamp).toLocaleString()}
                </span>
                <div style={{display: 'flex', gap: '4px'}}>
                  <button 
                    className="primary" 
                    style={{padding: '4px 8px', border: 'none', fontSize: '0.8rem'}}
                    onClick={(e) => { e.stopPropagation(); onSelect({ ...item, _trigger: Date.now() } as any); }}
                    title="Load Transcript"
                  >
                    View
                  </button>
                  <button 
                    className="danger" 
                    style={{padding: '4px', border: 'none', background: 'transparent'}}
                    onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="history-item-preview" onClick={() => onSelect({ ...item, _trigger: Date.now() } as any)}>
                {item.content}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
