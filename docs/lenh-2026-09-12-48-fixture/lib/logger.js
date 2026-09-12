/* Logger gọn, có mốc thời gian VN */
const ts = () => new Date().toLocaleString('vi-VN', { hour12: false });
export const log = {
  info:  (...a) => console.log(`[${ts()}]`, ...a),
  warn:  (...a) => console.warn(`[${ts()}] ⚠️ `, ...a),
  error: (...a) => console.error(`[${ts()}] ❌`, ...a),
  ok:    (...a) => console.log(`[${ts()}] ✅`, ...a)
};
