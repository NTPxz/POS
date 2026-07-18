/**
 * @supabase/ssr ไม่ตั้ง maxAge ให้ cookie เซสชันโดยดีฟอลต์ (เป็น session cookie
 * หายทันทีที่เบราว์เซอร์/แอปถูกปิดจริง — บน iOS เกิดบ่อยเพราะระบบ kill
 * WebKit process เวลาความจำตึง) ทำให้ต้อง login ใหม่บ่อยทั้งที่ refresh token
 * ยังไม่หมดอายุ ตั้งให้ยาว 400 วัน (เพดานสูงสุดที่เบราว์เซอร์ส่วนใหญ่ยอมรับ)
 */
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;
