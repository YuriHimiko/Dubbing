export interface DialogueSegment {
  id: string;
  start: number; // in seconds
  end: number;   // in seconds
  speaker: string;
  originalText: string;
  translatedText: string;
  audioUrl?: string; // Client-side local object URL or base64 audio
  isGenerating?: boolean;
}

export interface DubbingProject {
  id: string;
  name: string;
  videoUrl?: string; // local or example video url
  videoName?: string;
  audioDuration?: number;
  originalLanguage: string;
  targetLanguage: string;
  segments: DialogueSegment[];
  createdAt: string;
}

export type VoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export interface VoiceOption {
  id: VoiceName;
  name: string;
  gender: 'Nam' | 'Nữ' | 'Male' | 'Female';
  description: string;
}

export const AVAILABLE_VOICES: VoiceOption[] = [
  { id: 'Kore', name: 'Kore (Nữ)', gender: 'Nữ', description: 'Trầm ấm, diễn cảm, tự nhiên' },
  { id: 'Puck', name: 'Puck (Nam)', gender: 'Nam', description: 'Vui vẻ, hoạt bát, tràn đầy năng lượng' },
  { id: 'Charon', name: 'Charon (Nam)', gender: 'Nam', description: 'Chững chạc, nghiêm túc, chuyên nghiệp' },
  { id: 'Fenrir', name: 'Fenrir (Nam)', gender: 'Nam', description: 'Mạnh mẽ, trầm tính, lôi cuốn' },
  { id: 'Zephyr', name: 'Zephyr (Nữ)', gender: 'Nữ', description: 'Nhẹ nhàng, trong trẻo, dễ chịu' }
];

export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

export const TARGET_LANGUAGES: LanguageOption[] = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', name: 'Tiếng Anh (English)', flag: '🇺🇸' },
  { code: 'ja', name: 'Tiếng Nhật (Japanese)', flag: '🇯🇵' },
  { code: 'ko', name: 'Tiếng Hàn (Korean)', flag: '🇰🇷' },
  { code: 'zh', name: 'Tiếng Trung (Chinese)', flag: '🇨🇳' },
  { code: 'fr', name: 'Tiếng Pháp (French)', flag: '🇫🇷' },
  { code: 'es', name: 'Tiếng Tây Ban Nha (Spanish)', flag: '🇪🇸' },
  { code: 'de', name: 'Tiếng Đức (German)', flag: '🇩🇪' }
];
