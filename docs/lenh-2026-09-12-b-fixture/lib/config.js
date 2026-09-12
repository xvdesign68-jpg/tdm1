/* Cấu hình tập trung — đọc từ biến môi trường (.env) */
const env = process.env;
const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
const bool = (v, d = false) => (v === undefined ? d : /^(1|true|yes|on)$/i.test(String(v)));

export const CFG = {
  // Chế độ chạy
  MOCK_MODE: bool(env.MOCK_MODE, false),     // true = dùng dữ liệu giả để chạy thử (không cần token)
  PORT:      num(env.PORT, 8787),
  POLL_MINUTES: num(env.POLL_MINUTES, 3),
  POSTS_PER_GROUP: num(env.POSTS_PER_GROUP, 20),
  // v-sow 05/09/2026: quét theo lịch GIEO snapshot (không chờ trong lượt); nhịp gieo mỗi nguồn (phút) — config/app.scanIntervalMin ghi đè
  BD_SOW_MODE: bool(env.BD_SOW_MODE, true),
  SCAN_SOURCE_INTERVAL_MIN: num(env.SCAN_SOURCE_INTERVAL_MIN, 10),
  PROBE_POSTS: num(env.PROBE_POSTS, 5),          // số bài dò mỗi nhịp (mặc định cũ trong code = 5)
  FULLSWEEP_HOURS: num(env.FULLSWEEP_HOURS, 2),  // nhịp quét đủ POSTS_PER_GROUP (mặc định cũ = 2h)
  // v-ttl-vps 05/09/2026: TTL 'Bài đã quét' KHÔNG thành lead (ngày) — .env có sẵn nhưng config.js quên đọc → trước đây luôn 1 ngày
  SCANNED_TTL_DAYS: num(env.SCANNED_TTL_DAYS, 3),
  // LENH #32 (06/09/2026): quét bằng nick qua browser service (scraper.fetchPostsAuth đọc CFG.BROWSER_SVC_URL/SECRET nhưng config.js chưa map → luôn "Chưa cấu hình"). Địa chỉ CHỈ ở .env.
  BROWSER_SVC_URL: env.BROWSER_SVC_URL || '',
  BROWSER_SVC_SECRET: env.BROWSER_SVC_SECRET || '',
  HOT_THRESHOLD: num(env.HOT_THRESHOLD, 80),
  MIN_KEEP_SCORE: num(env.MIN_KEEP_SCORE, 40), // dưới mức này không lưu làm lead

  // Scraper API (Bright Data — Facebook Posts by group URL)
  BRIGHTDATA_TOKEN: env.BRIGHTDATA_TOKEN || '',
  BRIGHTDATA_DATASET_ID: env.BRIGHTDATA_DATASET_ID || 'gd_<che>',
  // v17: danh thuc Pha 1b — 3 bien nay co trong .env tu dau nhung config.js quen doc (cung lo voi vu $NaN)
  BRIGHTDATA_COMMENTS_DATASET_ID: env.BRIGHTDATA_COMMENTS_DATASET_ID || 'gd_<che>',
  SCAN_COMMENTS: bool(env.SCAN_COMMENTS, false),
  COMMENTS_PER_POST: num(env.COMMENTS_PER_POST, 30), // tran chong bai viral no records


  // LLM chấm điểm (tương thích OpenAI; đổi sang Claude/Gemini tuỳ ý)
  LLM_API_KEY: env.LLM_API_KEY || '',
  LLM_BASE_URL: env.LLM_BASE_URL || 'https://api.openai.com/v1',
  LLM_MODEL: env.LLM_MODEL || 'gpt-4o-mini',
  LLM_PREFILTER_MODEL: env.LLM_PREFILTER_MODEL || 'gpt-5-nano',
  // Đơn giá để ước tính chi phí (USD / 1 TRIỆU token). Chỉnh theo model thực tế trong .env.
  LLM_PRICE_IN:  num(env.LLM_PRICE_IN, 0.15),
  LLM_PRICE_OUT: num(env.LLM_PRICE_OUT, 0.60),
  LLM_PREFILTER_PRICE_IN: num(env.LLM_PREFILTER_PRICE_IN, 0.05),
  LLM_PREFILTER_PRICE_OUT: num(env.LLM_PREFILTER_PRICE_OUT, 0.40),
  // Số bài chấm điểm AI song song cùng lúc (tăng tốc; chỉnh nếu gặp rate limit của OpenAI)
  SCORE_CONCURRENCY: num(env.SCORE_CONCURRENCY, 6),
  // LENH #48 (12/09/2026): gọi LLM bền + trần mềm lượt quét + eKYC (chỉnh trong .env; giá trị mặc định = khuyến nghị)
  LLM_TRIES: num(env.LLM_TRIES, 4),                       // số lần thử 1 bài (429/5xx/mạng/JSON hỏng)
  LLM_TIMEOUT_MS: num(env.LLM_TIMEOUT_MS, 45000),         // mỗi lượt gọi (trước 60 s)
  LLM_POST_BUDGET_MS: num(env.LLM_POST_BUDGET_MS, 90000), // tổng chờ tối đa cho 1 bài (kể cả giãn cách)
  LLM_REASONING: env.LLM_REASONING || 'low',              // reasoning_effort cho gpt-5/o-series (content.js LỆNH #29 đã dùng)
  LLM_MAX_TOKENS: num(env.LLM_MAX_TOKENS, 2000),          // max_completion_tokens (token suy nghĩ tính vào đây)
  SCAN_SOFT_DEADLINE_S: num(env.SCAN_SOFT_DEADLINE_S, 1200), // quá mốc này lượt quét ngừng chấm bài mới (giữ lease, lượt sau chấm)
  ZALO_CHECK_COLD: bool(env.ZALO_CHECK_COLD, false),      // true = kiểm eKYC cả lead lạnh như cũ

  // Kênh cảnh báo
  TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID:   env.TELEGRAM_CHAT_ID || '',

  RESEND_API_KEY: env.RESEND_API_KEY || '',     // gửi email qua HTTP API (không cần SMTP)
  EMAIL_FROM: env.EMAIL_FROM || 'SmartLead <onboarding@resend.dev>',
  EMAIL_TO:   env.EMAIL_TO || '',

  SHEET_WEBHOOK_URL: env.SHEET_WEBHOOK_URL || '', // Google Apps Script web app (append row)
  CUSTOM_WEBHOOK_URL: env.CUSTOM_WEBHOOK_URL || '', // n8n / CRM / cầu nối tuỳ ý

  ZALO_OA_TOKEN: env.ZALO_OA_TOKEN || '',
  ZALO_USER_ID:  env.ZALO_USER_ID || '',          // user đã follow OA (chỉ gửi được cho người đã tương tác)

  // VPS (browser automation server)
  VPS_URL: env.VPS_URL || '',  // v-ttl-vps 05/09/2026: địa chỉ VPS CHỈ ở .env (không để trong code)
  VPS_SECRET: env.VPS_SECRET || '',

  // Bảo mật API (token đơn giản để dashboard gọi — tuỳ chọn)
  API_TOKEN: env.API_TOKEN || ''
};

/** Danh sách kênh đang bật (để hiển thị trên dashboard) */
export function activeChannels() {
  return {
    telegram: !!(CFG.TELEGRAM_BOT_TOKEN && CFG.TELEGRAM_CHAT_ID),
    email:    !!(CFG.RESEND_API_KEY && CFG.EMAIL_TO),
    sheet:    !!CFG.SHEET_WEBHOOK_URL,
    webhook:  !!CFG.CUSTOM_WEBHOOK_URL,
    zalo:     !!(CFG.ZALO_OA_TOKEN && CFG.ZALO_USER_ID)
  };
}
