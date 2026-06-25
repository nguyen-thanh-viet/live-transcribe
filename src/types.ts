export interface TranscriptionHistoryItem {
  id: string;
  timestamp: number;
  content: string;
  sourceType: 'microphone' | 'tab';
}
