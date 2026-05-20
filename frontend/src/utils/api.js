/**
 * 後端 API 連線設定
 *
 * 透過 Vite 環境變數統一管理後端 API 的基礎 URL。
 * 如需切換環境（開發 / 測試 / 生產），只需修改 .env 檔案中的 VITE_API_BASE_URL，
 * 而無需逐一修改各個元件的程式碼。
 *
 * 開發環境：.env → VITE_API_BASE_URL=http://localhost:8081/api
 * 生產環境：.env.production → VITE_API_BASE_URL=https://api.your-domain.com/api
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api';

export default API_BASE_URL;
