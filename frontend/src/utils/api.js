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

// Intercept window.fetch to automatically add Authorization header
const originalFetch = window.fetch;
window.fetch = async (url, options = {}) => {
  // If the request is to our API base URL
  if (typeof url === 'string' && url.startsWith(API_BASE_URL)) {
    const token = localStorage.getItem('authToken');
    if (token) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      };
    }
  }

  const response = await originalFetch(url, options);
  
  // If we get a 401 Unauthorized from the backend, redirect to login or clear auth
  if (response.status === 401) {
    const token = localStorage.getItem('authToken');
    if (token) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      // Redirect to login if not already on login or customer pages
      if (!window.location.pathname.startsWith('/order') && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  }
  return response;
};

export default API_BASE_URL;
