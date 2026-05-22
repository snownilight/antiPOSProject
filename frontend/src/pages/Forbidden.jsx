import { useNavigate } from 'react-router-dom';
import './Forbidden.css';

const Forbidden = () => {
  const navigate = useNavigate();

  return (
    <div className="forbidden-container">
      <div className="forbidden-card">
        <div className="forbidden-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="forbidden-title">403</h1>
        <h2 className="forbidden-subtitle">存取被拒絕</h2>
        <p className="forbidden-text">您沒有權限存取此頁面。請聯繫管理員或切換至正確的角色帳號。</p>
        <div className="forbidden-actions">
          <button className="forbidden-btn btn-primary" onClick={() => navigate(-1)}>
            返回上一頁
          </button>
          <button className="forbidden-btn btn-secondary" onClick={() => navigate('/login')}>
            前往登入頁
          </button>
        </div>
      </div>
    </div>
  );
};

export default Forbidden;
