import { DialogueSegment, DubbingProject } from "../types";

export interface SampleVideoProject {
  id: string;
  name: string;
  videoUrl: string;
  description: string;
  originalLanguage: string;
  targetLanguage: string;
  segments: DialogueSegment[];
}

export const SAMPLE_PROJECTS: SampleVideoProject[] = [
  {
    id: "sample_jobs",
    name: "Steve Jobs - Stanford Speech (Triết lý sống)",
    description: "Trích đoạn phát biểu nổi tiếng năm 2005 của Steve Jobs tại Đại học Stanford bàn về sự hữu hạn của thời gian.",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-working-late-at-the-office-3096-large.mp4", // generic workspace video
    originalLanguage: "en",
    targetLanguage: "vi",
    segments: [
      {
        id: "jobs_1",
        start: 0.5,
        end: 5.5,
        speaker: "Steve Jobs",
        originalText: "Your time is limited, so don't waste it living someone else's life.",
        translatedText: "Thời gian của bạn là có hạn, vì vậy đừng lãng phí nó để sống cuộc đời của người khác."
      },
      {
        id: "jobs_2",
        start: 6.0,
        end: 11.2,
        speaker: "Steve Jobs",
        originalText: "Don't be trapped by dogma, which is living with the results of other people's thinking.",
        translatedText: "Đừng để bị mắc kẹt bởi giáo điều, thứ bắt bạn phải sống bằng kết quả suy nghĩ của những người khác."
      },
      {
        id: "jobs_3",
        start: 11.8,
        end: 17.5,
        speaker: "Steve Jobs",
        originalText: "And most important, have the courage to follow your heart and intuition.",
        translatedText: "Và điều quan trọng nhất là hãy có đủ can đảm để nghe theo trái tim và trực giác của chính mình."
      }
    ]
  },
  {
    id: "sample_scifi",
    name: "The Matrix Scene - Red Bell or Blue Pill",
    description: "Cuộc đối thoại kinh điển giữa Morpheus và Neo trong phòng đỏ về sự thật phía sau thế giới thực tại.",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-cyberpunk-look-of-a-man-with-futuristic-glasses-32219-large.mp4", // futuristic theme
    originalLanguage: "en",
    targetLanguage: "vi",
    segments: [
      {
        id: "matrix_1",
        start: 0.0,
        end: 4.8,
        speaker: "Morpheus",
        originalText: "You take the blue pill, the story ends, you wake up in your bed.",
        translatedText: "Cậu uống viên thuốc màu xanh, câu chuyện kết thúc, cậu thức dậy trên giường của mình."
      },
      {
        id: "matrix_2",
        start: 5.2,
        end: 9.0,
        speaker: "Morpheus",
        originalText: "You believe whatever you want to believe.",
        translatedText: "Cậu sẽ tin vào bất cứ điều gì mà cậu mong muốn tin tưởng."
      },
      {
        id: "matrix_3",
        start: 9.5,
        end: 14.5,
        speaker: "Morpheus",
        originalText: "You take the red pill, you stay in Wonderland.",
        translatedText: "Còn nếu cậu chọn viên thuốc màu đỏ, cậu sẽ ở lại Xứ sở Thần tiên."
      },
      {
        id: "matrix_4",
        start: 15.0,
        end: 19.8,
        speaker: "Morpheus",
        originalText: "And I show you how deep the rabbit hole goes. Remember: all I'm offering is the truth.",
        translatedText: "Và tôi sẽ cho cậu thấy hang thỏ này sâu thẳm đến dường nào. Hãy nhớ: tôi chỉ đem đến sự thật."
      }
    ]
  },
  {
    id: "sample_vietnam",
    name: "Giới thiệu Du lịch Việt Nam",
    description: "Video tài liệu phong cảnh thiên nhiên vịnh Hạ Long với giọng đọc truyền cảm về vẻ đẹp đất nước.",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-beautiful-landscape-of-green-mountains-in-fog-42217-large.mp4", // gorgeous nature scenery
    originalLanguage: "vi",
    targetLanguage: "en",
    segments: [
      {
        id: "vn_1",
        start: 0.8,
        end: 6.2,
        speaker: "Người dẫn chuyện",
        originalText: "Chào mừng bạn đến với Việt Nam, một đất nước có vẻ đẹp kỳ vĩ và lòng mến khách tuyệt vời.",
        translatedText: "Welcome to Vietnam, a country of remarkable beauty and exceptional hospitality."
      },
      {
        id: "vn_2",
        start: 6.8,
        end: 12.0,
        speaker: "Người dẫn chuyện",
        originalText: "Nơi những dãy núi đá vôi hùng vĩ hòa quyện cùng làn nước trong xanh như ngọc của Vịnh Hạ Long.",
        translatedText: "Where majestic limestone mountains blend seamlessly into the turquoise waters of Ha Long Bay."
      },
      {
        id: "vn_3",
        start: 12.5,
        end: 18.0,
        speaker: "Người dẫn chuyện",
        originalText: "Hãy cùng chúng tôi khám phá những nét văn hóa ẩm thực truyền thống vô cùng đặc sắc.",
        translatedText: "Join us in exploring the incredibly unique and traditional culinary cultures."
      }
    ]
  }
];
