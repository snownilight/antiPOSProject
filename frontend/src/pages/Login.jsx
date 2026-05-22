import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect back to original route after login or default to /admin/tables
  const from = location.state?.from?.pathname || '/admin/tables';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userData = await login(username, password);
      
      // Determine the target redirect path:
      // If we're redirecting to the default '/admin/tables' or '/', route KITCHEN to '/admin/kitchen'
      let targetPath = from;
      if (from === '/admin/tables' || from === '/') {
        if (userData && userData.role === 'KITCHEN') {
          targetPath = '/admin/kitchen';
        } else {
          targetPath = '/admin/tables';
        }
      }
      
      navigate(targetPath, { replace: true });
    } catch (err) {
      setError(err.message || '登入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <span className="logo-anti">anti</span>
            <span className="logo-pos">POS</span>
          </div>
          <h2 className="login-subtitle">系統管理與點餐控制台</h2>
        </div>

        {error && (
          <div className="login-error">
            <svg className="error-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">使用者帳號</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="請輸入帳號"
              required
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">密碼</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請輸入密碼"
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-submit-btn" disabled={loading}>
            {loading ? (
              <span className="loading-spinner"></span>
            ) : (
              '登入系統'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>© 2026 antiPOS System. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
