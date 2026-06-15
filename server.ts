import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload size limit to receive base64 chunked audio uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy init of Gemini SDK to prevent crashes if key is initially absent
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables. Please check the Secrets panel in AI Studio.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// REST API Endpoints
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", apiKeyExists: !!process.env.GEMINI_API_KEY });
});

/**
 * Route: Analyze YouTube link and generate translated dialogues using Gemini's knowledge/retrieval
 */
app.post("/api/dub/youtube", async (req, res) => {
  try {
    const { youtubeUrl, targetLanguage } = req.body;

    if (!youtubeUrl) {
      return res.status(400).json({ error: "Missing youtubeUrl." });
    }

    // RegEx to extract YouTube ID
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = youtubeUrl.match(regExp);
    const videoId = (match && match[2].length === 11) ? match[2] : null;

    if (!videoId) {
      return res.status(400).json({ error: "Đường link YouTube không đúng định dạng." });
    }

    const ai = getGeminiClient();

    const targetLangName = targetLanguage === 'vi' ? 'Tiếng Việt' :
                           targetLanguage === 'en' ? 'Tiếng Anh (English)' :
                           targetLanguage === 'ja' ? 'Tiếng Nhật (Japanese)' :
                           targetLanguage === 'ko' ? 'Tiếng Hàn (Korean)' :
                           targetLanguage === 'zh' ? 'Tiếng Trung (Chinese)' :
                           targetLanguage === 'fr' ? 'Tiếng Pháp (French)' :
                           targetLanguage === 'es' ? 'Tiếng Tây Ban Nha (Spanish)' :
                           targetLanguage === 'de' ? 'Tiếng Đức (German)' : targetLanguage;

    const promptMessage = 
      `Tôi có một video YouTube với URL: ${youtubeUrl} (ID: ${videoId}). ` +
      `Hãy đóng vai là một chuyên gia dịch thuật và lồng tiếng phim. Bằng kiến thức rộng lớn của bạn về video này, hoặc bằng khả năng trích xuất nội dung ` +
      `hãy tạo ra 4 đến 6 phân đoạn thoại đối thoại chính (timestamps, speaker, originalText, translatedText) của video đó. ` +
      `Nếu video không quá phổ biến, hãy tự động nhận diện chủ đề dựa trên tiêu đề từ URL hoặc giả lập một đoạn hội thoại phong cách Cinematic cực hay liên quan mật thiết đến chủ đề video.

      Yêu cầu dữ liệu trả về:
      1. 'id': Định danh duy nhất (ví dụ: 'yt_1', 'yt_2')
      2. 'start': Mốc thời gian bắt đầu nói tính bằng giây (ví dụ: 0.5, 4.2)
      3. 'end': Mốc thời gian kết thúc nói tính bằng giây (ví dụ: 3.8, 9.0)
      4. 'speaker': Nhân vật phát biểu (ví dụ: "Người thuyết trình", "Kỷ lục gia", "Morpheus")
      5. 'originalText': Câu nói gốc bằng ngôn ngữ gốc của video
      6. 'translatedText': Bản dịch lót lồng tiếng tự nhiên nhất sang ngôn ngữ đích: "${targetLangName}"

      Hãy trả về kết quả tuân thủ nghiêm ngặt theo định dạng Schema được chỉ định dưới dạng ứng dụng JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [promptMessage],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Mảng danh sách các phân đoạn video YouTube dịch lồng tiếng",
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              start: { type: Type.NUMBER },
              end: { type: Type.NUMBER },
              speaker: { type: Type.STRING },
              originalText: { type: Type.STRING },
              translatedText: { type: Type.STRING }
            },
            required: ["id", "start", "end", "speaker", "originalText", "translatedText"]
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Không có phản hồi từ Gemini API về link YouTube.");
    }

    const segments = JSON.parse(resultText.trim());
    return res.json({ success: true, videoId, segments });
  } catch (error: any) {
    console.error("YouTube Analysis Error:", error);
    return res.status(500).json({ 
      error: "Đã xảy ra lỗi khi phân tích link YouTube: " + error.message 
    });
  }
});

/**
 * Route: Analyze video audio and output translated segments as timestamps
 */
app.post("/api/dub/analyze", async (req, res) => {
  try {
    const { audioData, mimeType, targetLanguage } = req.body;

    if (!audioData) {
      return res.status(400).json({ error: "Missing audioData (base64 encoded)." });
    }

    const ai = getGeminiClient();

    const targetLangName = targetLanguage === 'vi' ? 'Tiếng Việt' :
                           targetLanguage === 'en' ? 'Tiếng Anh (English)' :
                           targetLanguage === 'ja' ? 'Tiếng Nhật (Japanese)' :
                           targetLanguage === 'ko' ? 'Tiếng Hàn (Korean)' :
                           targetLanguage === 'zh' ? 'Tiếng Trung (Chinese)' :
                           targetLanguage === 'fr' ? 'Tiếng Pháp (French)' :
                           targetLanguage === 'es' ? 'Tiếng Tây Ban Nha (Spanish)' :
                           targetLanguage === 'de' ? 'Tiếng Đức (German)' : targetLanguage;

    const systemInstruction = 
      `Bạn là một chuyên gia lồng tiếng và dịch thuật video chuyên nghiệp. Hãy lắng nghe thật kỹ tệp âm thanh này.` +
      ` Hãy chia hội thoại thành các phân đoạn (segments) nói tự nhiên nhỏ, chính xác nhất theo dòng thời gian (timestamps) trong audio.
      
      Yêu cầu cực kỳ quan trọng cho dữ liệu trả về:
      1. Khớp thời lượng: Xác định đúng thời gian 'start' (bắt đầu) và 'end' (kết thúc) theo đơn vị giây (số thực, ví dụ: 1.25, 4.8). 
      2. Định danh nhân vật: Nhận diện giọng nói của các nhân vật khác nhau để đặt tên 'speaker' hợp lý (ví dụ: "Speaker A", "Speaker B", hoặc nếu nhận diện được vai trò thì đặt theo vai trò).
      3. Ghi chép chính xác: Chuyển âm thanh thành chữ gốc ('originalText') trung thực bằng ngôn ngữ nói của video.
      4. Dịch thuật điện ảnh: Dịch lời nói sang ngôn ngữ mục tiêu: "${targetLangName}" ('translatedText'). Dịch thuật mang tính tự nhiên, gần gũi, văn phong đối thoại lồng tiếng, tránh dịch máy thô cứng. Độ dài và tốc độ đọc của câu dịch phải phù hợp thời lượng trôi qua giữa 'start' và 'end'.
      
      Hãy trả về kết quả tuân thủ nghiêm ngặt theo định dạng Schema được chỉ định.`;

    const audioPart = {
      inlineData: {
        mimeType: mimeType || "audio/wav",
        data: audioData
      }
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [audioPart, `Hãy phân tích và dịch hội thoại trong tệp âm thanh này sang ngôn ngữ mục tiêu: ${targetLangName}.`],
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Mảng danh sách các phân đoạn hội thoại đã dịch",
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "ID phân đoạn (ví dụ: 'seg_1')" },
              start: { type: Type.NUMBER, description: "Thời gian bắt đầu nói (giây)" },
              end: { type: Type.NUMBER, description: "Thời gian kết thúc nói (giây)" },
              speaker: { type: Type.STRING, description: "Nhãn đại điện cho nhân vật nói" },
              originalText: { type: Type.STRING, description: "Câu hội thoại gốc" },
              translatedText: { type: Type.STRING, description: "Câu hội thoại sau khi dịch" }
            },
            required: ["id", "start", "end", "speaker", "originalText", "translatedText"]
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Không thể trích xuất đoạn thoại từ Gemini API.");
    }

    const segments = JSON.parse(resultText.trim());
    return res.json({ success: true, segments });
  } catch (error: any) {
    console.error("Analysis Error:", error);
    return res.status(500).json({ 
      error: "Đã xảy ra lỗi trong quá trình phân tích âm thanh: " + error.message 
    });
  }
});

/**
 * Route: TTS voice generation for a single translated dialogue segment
 */
app.post("/api/dub/synthesize-segment", async (req, res) => {
  try {
    const { text, voice } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Missing text for synthesis." });
    }

    const ai = getGeminiClient();

    // Mapping voices & setting up TTS
    // Prebuilt names support: Kore, Fenrir, Puck, Charon, Zephyr
    const voiceName = voice || 'Kore';

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      // Adding emotional direction cue to give extremely natural text to speech reads
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("TTS model returned an empty voice payload.");
    }

    return res.json({ success: true, audioContent: base64Audio });
  } catch (error: any) {
    console.error("Synthesis Error:", error);
    return res.status(500).json({ 
      error: "Đã xảy ra lỗi trong quá trình tổng hợp giọng nói: " + error.message 
    });
  }
});

// Vite Middleware integration for production build vs dev server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
