import { Mic, StopCircle, MonitorUp, FileText, Download, Save } from 'lucide-react';
import { AudioRecorder } from '../lib/audioUtils';
import { GeminiLiveClient } from '../lib/geminiLiveClient';
import type { TranscriptionHistoryItem } from '../types';
import { useState, useEffect, useRef } from 'react';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

interface TranscriberProps {
  apiKey: string;
  model: string;
  onSaveHistory: (item: TranscriptionHistoryItem) => void;
  selectedHistoryItem?: TranscriptionHistoryItem | null;
}

export const Transcriber: React.FC<TranscriberProps> = ({ apiKey, model, onSaveHistory, selectedHistoryItem }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [sourceType, setSourceType] = useState<'microphone' | 'tab'>('microphone');
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);

  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const geminiClientRef = useRef<GeminiLiveClient | null>(null);
  const transcriptAreaRef = useRef<HTMLElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (transcriptAreaRef.current) {
      transcriptAreaRef.current.scrollTop = transcriptAreaRef.current.scrollHeight;
    }
  }, [transcript, interimText]);

  const [viewingHistory, setViewingHistory] = useState(false);

  // Load selected history item
  useEffect(() => {
    if (selectedHistoryItem) {
      if (isRecording) {
        stopRecording();
      }
      setTranscript(selectedHistoryItem.content);
      setInterimText('');
      setError('');
      setSummary('');
      setSourceType(selectedHistoryItem.sourceType);
      setViewingHistory(true);
    }
  }, [selectedHistoryItem]);

  const startRecording = async (type: 'microphone' | 'tab') => {
    if (!apiKey) {
      setError('Please set your Gemini API key in settings first.');
      return;
    }
    
    setError('');
    setTranscript('');
    setInterimText('');
    setSummary('');
    setSourceType(type);
    setIsRecording(true);
    setViewingHistory(false);

    try {
      // 1. Initialize Gemini Client
      geminiClientRef.current = new GeminiLiveClient({
        apiKey,
        model,
        onMessage: (text, isFinal) => {
           if (isFinal) {
               // In this simple implementation, we might just append all text
               // as it comes. But if we receive a clear turn complete, we can
               // handle it. Usually, BidiGenerateContent streams text incrementally.
               setTranscript(prev => prev + ' ' + text);
               setInterimText('');
           } else {
               // Append incoming text chunks
               setTranscript(prev => prev + text);
           }
        },
        onError: (err) => {
          setError(err);
          stopRecording();
        },
        onClose: () => {
          stopRecording();
        }
      });

      geminiClientRef.current.connect();

      // 2. Initialize Audio Recorder
      audioRecorderRef.current = new AudioRecorder((base64Data) => {
        if (geminiClientRef.current) {
          geminiClientRef.current.sendAudioChunk(base64Data);
        }
      });

      // Give WebSocket a tiny bit of time to connect before streaming
      setTimeout(async () => {
         try {
           await audioRecorderRef.current?.start(type);
         } catch(e: any) {
           setError(e.message || 'Failed to access audio source. Please check permissions.');
           stopRecording();
         }
      }, 500);

    } catch (e: any) {
      setError(e.message || 'Failed to start transcription');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (audioRecorderRef.current) {
      audioRecorderRef.current.stop();
      audioRecorderRef.current = null;
    }
    
    if (geminiClientRef.current) {
      geminiClientRef.current.endTurn();
      setTimeout(() => {
         geminiClientRef.current?.disconnect();
         geminiClientRef.current = null;
      }, 1000); // give time for final text
    }

    setIsRecording(false);
  };

  const handleSaveToHistory = () => {
    if (transcript.trim()) {
      onSaveHistory({
        id: Date.now().toString(),
        timestamp: Date.now(),
        content: transcript + (summary ? `\n\n--- TÓM TẮT ---\n${summary}` : ''),
        sourceType
      });
    }
  };

  const generateSummary = async () => {
    if (!transcript.trim()) return;
    setIsSummarizing(true);
    setError('');
    
    const promptText = `Bạn là người ghi biên bản cuộc họp chuyên nghiệp, dựa trên nội dung text ở dưới đây hãy tóm tắt thành các ý chính, trong đó có kết luận và phân công công việc cụ thể.\n\nNội dung hội thoại:\n${transcript}`;
    
    let success = false;
    let lastError = '';

    try {
      // Step 1: Fetch all available models for this API key
      const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const listData = await listResponse.json();

      if (listData.error) {
        throw new Error(listData.error.message);
      }

      // Step 2: Filter models that support generateContent
      const validModels = (listData.models || []).filter((m: any) => 
        m.supportedGenerationMethods?.includes('generateContent')
      );

      if (validModels.length === 0) {
        throw new Error("Không tìm thấy model nào hỗ trợ tính năng tóm tắt (generateContent) cho API Key này.");
      }

      // Step 3: Sort models by preference (flash > pro)
      const sortedModels = validModels.sort((a: any, b: any) => {
        const scoreA = (a.name.includes('flash') ? 2 : 0) + (a.name.includes('1.5') ? 1 : 0) + (a.name.includes('2.5') ? 1 : 0);
        const scoreB = (b.name.includes('flash') ? 2 : 0) + (b.name.includes('1.5') ? 1 : 0) + (b.name.includes('2.5') ? 1 : 0);
        return scoreB - scoreA;
      });

      // Step 4: Call generateContent, if it fails (e.g. 503 High Demand), fallback to the next model in the list!
      for (const model of sortedModels) {
        if (success) break;
        try {
          const generateResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                role: 'user',
                parts: [{ text: promptText }]
              }]
            })
          });

          const generateData = await generateResponse.json();
            
          if (!generateData.error && generateData.candidates?.[0]?.content?.parts?.[0]?.text) {
            setSummary(generateData.candidates[0].content.parts[0].text);
            success = true;
          } else if (generateData.error) {
            lastError = generateData.error.message;
            // If the error is high demand (503) or quota, we just let it loop to the next model
          }
        } catch (err: any) {
          lastError = err.message;
        }
      }
    } catch (err: any) {
      lastError = err.message;
    }

    if (!success) {
      setError(lastError || "Không thể tạo tóm tắt với bất kỳ mô hình nào, vui lòng kiểm tra API Key.");
    }
    
    setIsSummarizing(false);
  };

  const exportSummaryMarkdown = () => {
    const blob = new Blob([summary], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, `tom_tat_${Date.now()}.md`);
  };

  const exportDocx = async () => {
    const doc = new Document({
        sections: [
            {
                properties: {},
                children: transcript.split('\n').map(line => 
                   new Paragraph({
                       children: [new TextRun(line)],
                   })
                ),
            },
        ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `transcription_${Date.now()}.docx`);
  };

  return (
    <div className="transcriber-box glass-panel">
      <div className="controls">
        {!isRecording ? (
          <>
            <button className="primary" onClick={() => startRecording('microphone')}>
              <Mic size={18} /> Start Mic
            </button>
            <button onClick={() => startRecording('tab')}>
              <MonitorUp size={18} /> Capture Tab Audio
            </button>
          </>
        ) : (
          <button className="danger" onClick={stopRecording}>
            <StopCircle size={18} /> Stop Transcription
          </button>
        )}
        
        {isRecording && (
           <div className="recording-indicator" title="Recording in progress..."></div>
        )}
        {viewingHistory && !isRecording && (
           <div style={{background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 500}}>
             👀 Đang xem bản ghi lịch sử
           </div>
        )}
      </div>
      
      {error && <div className="text-danger" style={{fontSize: '0.9rem'}}>{error}</div>}

      {isRecording ? (
        <div className="transcript-area" ref={transcriptAreaRef}>
          {transcript || interimText ? (
             <>
               {transcript}
               <span className="interim">{interimText}</span>
             </>
          ) : (
             <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                Listening...
             </div>
          )}
        </div>
      ) : (
        <textarea
          className="transcript-area"
          ref={transcriptAreaRef as React.RefObject<HTMLTextAreaElement>}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Văn bản gốc sẽ hiển thị ở đây. Bạn có thể nhấp vào đây để chỉnh sửa..."
        />
      )}

      <div className="controls" style={{justifyContent: 'space-between', borderTop: '1px solid var(--panel-border)', paddingTop: '1rem', marginTop: '1rem'}}>
        <div style={{display: 'flex', gap: '1rem'}}>
           <button onClick={exportDocx} disabled={!transcript} title="Lưu DOCX (Bản ghi)">
             <Download size={18} /> DOCX (Bản ghi)
           </button>
           <button className="primary" onClick={generateSummary} disabled={!transcript || isRecording || isSummarizing} style={{ background: '#10b981', borderColor: '#059669' }}>
             {isSummarizing ? "Đang tóm tắt..." : "Tóm tắt Biên bản"}
           </button>
        </div>
        <button className="primary" onClick={handleSaveToHistory} disabled={!transcript || isRecording} title="Save to History">
           <Save size={18} /> Save
        </button>
      </div>

      {summary && (
        <div style={{ marginTop: '1.5rem', animation: 'fadeIn 0.5s ease' }}>
          <div className="transcript-area" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={16} /> Bản Tóm Tắt Cuộc Họp
            </h4>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>
              {summary}
            </div>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-start' }}>
            <button className="primary" onClick={exportSummaryMarkdown} style={{ background: '#10b981', borderColor: '#059669' }}>
              <Download size={18} /> Tải Tóm Tắt (Markdown)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
