import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const ProductDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const hasRole = (roles) => {
    return user && roles.includes(user.role);
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <i className="bi bi-shop"></i>
          AntiPOS
        </div>
        <nav className="nav-menu">
          {hasRole(['ADMIN', 'WAITER']) && (
            <NavLink 
              to="/admin/tables" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <i className="bi bi-grid-3x3-gap"></i>
              桌台管理
            </NavLink>
          )}
          {hasRole(['ADMIN', 'WAITER']) && (
            <NavLink 
              to="/admin/order" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                navigate('/admin/order');
              }}
            >
              <i className="bi bi-cart-plus"></i>
              外場點餐
            </NavLink>
          )}
          {hasRole(['ADMIN', 'WAITER']) && (
            <NavLink 
              to="/admin/orders" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <i className="bi bi-receipt"></i>
              訂單管理
            </NavLink>
          )}
          {hasRole(['ADMIN', 'KITCHEN']) && (
            <NavLink
              to="/admin/kitchen"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <i className="bi bi-display"></i>
              廚房看板
            </NavLink>
          )}
          {hasRole(['ADMIN']) && (
            <NavLink
              to="/admin/products" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <i className="bi bi-box-seam"></i>
              商品管理
            </NavLink>
          )}
          {hasRole(['ADMIN']) && (
            <NavLink 
              to="/admin/categories" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <i className="bi bi-tags"></i>
              分類管理
            </NavLink>
          )}
        </nav>

        {user && (
          <div className="sidebar-user">
            <div className="user-info">
              <span className="user-name">{user.displayName || user.username}</span>
              <span className={`user-role-badge role-${user.role.toLowerCase()}`}>
                {user.role === 'ADMIN' ? '管理員' : user.role === 'WAITER' ? '服務生' : '廚房'}
              </span>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right"></i>
              登出
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        <div className="animate-fade-in">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default ProductDashboard
