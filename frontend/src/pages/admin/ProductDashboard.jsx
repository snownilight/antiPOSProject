import { NavLink, Outlet } from 'react-router-dom'

const ProductDashboard = () => {
  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <i className="bi bi-shop"></i>
          AntiPOS
        </div>
        <nav className="nav-menu">
          <NavLink 
            to="/admin/products" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <i className="bi bi-box-seam"></i>
            商品管理
          </NavLink>
          <NavLink 
            to="/admin/categories" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <i className="bi bi-tags"></i>
            分類管理
          </NavLink>
        </nav>
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
