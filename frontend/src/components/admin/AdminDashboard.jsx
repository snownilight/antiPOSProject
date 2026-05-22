import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import API_BASE_URL from '../../utils/api';
import useWebSocket from '../../hooks/useWebSocket';
import './AdminDashboard.css';

const COLORS = [
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#3b82f6'  // Blue
];

const AdminDashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    todayRevenue: 0.00,
    paidOrderCount: 0,
    averageOrderAmount: 0.00,
    topProducts: [],
    stockAlerts: []
  });
  
  const [toasts, setToasts] = useState([]);
  const [hoveredSlice, setHoveredSlice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState('ALL');

  // Fetch initial dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/dashboard/today`);
      const json = await res.json();
      if (json.code === 200) {
        setDashboardData(json.data);
      }
    } catch (e) {
      console.error('Failed to fetch dashboard data:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((payload) => {
    console.log('[Dashboard WS] Received event:', payload.event);
    if (payload.event === 'DASHBOARD_UPDATE') {
      if (payload.data) {
        setDashboardData(payload.data);
      }
    } else if (payload.event === 'STOCK_ALERT') {
      const alertData = payload.data;
      if (alertData) {
        const isSoldOut = alertData.status === 'SOLD_OUT' || alertData.stock === 0;
        const message = isSoldOut
          ? `商品「${alertData.productName}」已售罄！`
          : `商品「${alertData.productName}」庫存不足 (剩餘 ${alertData.stock})！`;
        
        const type = isSoldOut ? 'danger' : 'warning';
        const id = Date.now() + Math.random().toString(36).substr(2, 9);
        
        // Add toast
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto remove toast after 6 seconds
        setTimeout(() => {
          setToasts((prev) => prev.filter(t => t.id !== id));
        }, 6000);
      }
    }
  }, []);

  // Subscribe to /topic/dashboard
  useWebSocket('/topic/dashboard', handleWebSocketMessage);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter(t => t.id !== id));
  };

  // SVG Donut Chart parameters
  const radius = 35;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius; // ~219.91
  
  // Get unique categories dynamically from top products
  const uniqueCategories = [
    { id: 'ALL', name: '全部' },
    ...Array.from(
      new Map(
        (dashboardData.topProducts || [])
          .filter(p => p.categoryId && p.categoryName)
          .map(p => [p.categoryId, { id: p.categoryId, name: p.categoryName }])
      ).values()
    )
  ];

  // Filter products by selected category
  const filteredProducts = selectedCategoryId === 'ALL'
    ? (dashboardData.topProducts || [])
    : (dashboardData.topProducts || []).filter(p => p.categoryId === selectedCategoryId);

  // Take Top 5 for display
  const topFilteredProducts = filteredProducts.slice(0, 5);
  const totalSales = topFilteredProducts.reduce((sum, p) => sum + p.quantitySold, 0);

  // Compute SVG slices
  let accumulatedLength = 0;
  const slices = topFilteredProducts.map((p, index) => {
    const percentage = totalSales > 0 ? p.quantitySold / totalSales : 0;
    const strokeLength = percentage * circumference;
    const strokeOffset = -accumulatedLength;
    accumulatedLength += strokeLength;
    
    return {
      ...p,
      percentage,
      strokeLength,
      strokeOffset,
      color: COLORS[index % COLORS.length]
    };
  });

  // Helper to format currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="page-title mb-1">即時營收與庫存看板</h2>
          <p className="text-muted mb-0">即時監控今日營業指標與庫存預警</p>
        </div>
        <div className="connection-status">
          <span className="pulse-dot"></span>
          即時連線中
        </div>
      </div>

      {isLoading && dashboardData.todayRevenue === 0 ? (
        <div className="d-flex justify-content-center align-items-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">載入中...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Metrics Row */}
          <div className="row g-4 mb-4">
            <div className="col-md-4">
              <div className="metric-card glass-panel h-100">
                <div className="metric-icon bg-indigo-light text-indigo">
                  <i className="bi bi-cash-stack"></i>
                </div>
                <div className="metric-details">
                  <span className="metric-label">今日累積營業額</span>
                  <h3 className="metric-value text-indigo">
                    {formatCurrency(dashboardData.todayRevenue)}
                  </h3>
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="metric-card glass-panel h-100">
                <div className="metric-icon bg-teal-light text-teal">
                  <i className="bi bi-cart-check"></i>
                </div>
                <div className="metric-details">
                  <span className="metric-label">今日已付款訂單數</span>
                  <h3 className="metric-value text-teal">
                    {dashboardData.paidOrderCount} 筆
                  </h3>
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="metric-card glass-panel h-100">
                <div className="metric-icon bg-amber-light text-amber">
                  <i className="bi bi-people"></i>
                </div>
                <div className="metric-details">
                  <span className="metric-label">當日客單價 (平均)</span>
                  <h3 className="metric-value text-amber">
                    {formatCurrency(dashboardData.averageOrderAmount)}
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* Core Content Grid */}
          <div className="row g-4">
            {/* Sales Chart Section */}
            <div className="col-lg-5">
              <div className="glass-panel h-100 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                  <h4 className="panel-title mb-0">Top 5 熱銷品項</h4>
                  {uniqueCategories.length > 1 && (
                    <div className="category-filter-pills d-flex gap-1 bg-black-alpha-05 p-1 rounded-pill">
                      {uniqueCategories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategoryId(cat.id);
                            setHoveredSlice(null);
                          }}
                          className={`category-pill-btn rounded-pill border-0 px-3 py-1 ${selectedCategoryId === cat.id ? 'active' : ''}`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {topFilteredProducts.length === 0 ? (
                  <div className="d-flex flex-column align-items-center justify-content-center flex-grow-1 py-5 text-muted">
                    <i className="bi bi-pie-chart mb-3" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                    <span>該分類今日尚無銷售數據</span>
                  </div>
                ) : (
                  <div className="chart-layout flex-grow-1">
                    {/* SVG Donut */}
                    <div className="donut-chart-container">
                      <svg viewBox="0 0 100 100" width="100%" height="100%">
                        {/* Background track */}
                        <circle
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="transparent"
                          stroke="rgba(0, 0, 0, 0.05)"
                          strokeWidth={strokeWidth}
                        />
                        {/* Segments */}
                        {slices.map((slice, index) => (
                          <circle
                            key={slice.productId}
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="transparent"
                            stroke={slice.color}
                            strokeWidth={strokeWidth + (hoveredSlice === index ? 1.5 : 0)}
                            strokeDasharray={`${slice.strokeLength} ${circumference - slice.strokeLength}`}
                            strokeDashoffset={slice.strokeOffset}
                            transform="rotate(-90 50 50)"
                            style={{
                              transition: 'stroke-width 0.3s ease, stroke 0.3s ease, opacity 0.3s ease',
                              opacity: hoveredSlice !== null && hoveredSlice !== index ? 0.6 : 1,
                              cursor: 'pointer'
                            }}
                            onMouseEnter={() => setHoveredSlice(index)}
                            onMouseLeave={() => setHoveredSlice(null)}
                          />
                        ))}
                      </svg>
                      
                      {/* Center Content */}
                      <div className="donut-center">
                        {hoveredSlice !== null ? (
                          <>
                            <span className="donut-center-title text-truncate" style={{ maxWidth: '90px' }}>
                              {slices[hoveredSlice].productName}
                            </span>
                            <span className="donut-center-value" style={{ fontSize: '16px' }}>
                              {slices[hoveredSlice].quantitySold} 份 ({(slices[hoveredSlice].percentage * 100).toFixed(0)}%)
                            </span>
                            <span className="donut-center-subtitle text-muted mt-1" style={{ fontSize: '10px' }}>
                              單 {slices[hoveredSlice].singleSold || 0} / 套 {slices[hoveredSlice].comboSold || 0}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="donut-center-title">總銷售量</span>
                            <span className="donut-center-value">{totalSales} 份</span>
                            <span className="donut-center-subtitle">今日前五名</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Chart Legend */}
                    <div className="chart-legend mt-4">
                      {slices.map((slice, index) => (
                        <div 
                          key={slice.productId} 
                          className={`legend-item d-flex align-items-center justify-content-between py-2 px-3 rounded ${hoveredSlice === index ? 'active-row' : ''}`}
                          onMouseEnter={() => setHoveredSlice(index)}
                          onMouseLeave={() => setHoveredSlice(null)}
                        >
                          <div className="d-flex align-items-center gap-2 text-truncate">
                            <span className="legend-badge" style={{ backgroundColor: slice.color }}></span>
                            <div className="d-flex flex-column text-truncate">
                              <span className="legend-name text-truncate fw-semibold">{slice.productName}</span>
                              <span className="legend-split-info text-muted">
                                (單點 {slice.singleSold || 0} / 套餐 {slice.comboSold || 0})
                              </span>
                            </div>
                          </div>
                          <div className="d-flex align-items-center gap-3">
                            <span className="legend-value fw-semibold">{slice.quantitySold} 份</span>
                            <span className="legend-percent text-muted">
                              ({(slice.percentage * 100).toFixed(0)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stock Alerts Section */}
            <div className="col-lg-7">
              <div className="glass-panel h-100 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h4 className="panel-title mb-0">庫存與售罄警報</h4>
                  <Link to="/admin/products" className="modern-btn py-1 px-3" style={{ fontSize: '13px' }}>
                    <i className="bi bi-pencil-square me-1"></i> 商品管理
                  </Link>
                </div>

                <div className="table-responsive flex-grow-1">
                  <table className="modern-table mb-0">
                    <thead>
                      <tr>
                        <th>商品名稱</th>
                        <th>目前庫存</th>
                        <th>預警門檻</th>
                        <th>警報類型</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dashboardData.stockAlerts || []).map((alert) => {
                        const isSoldOut = alert.status === 'SOLD_OUT' || alert.stock === 0;
                        return (
                          <tr key={alert.productId}>
                            <td className="fw-semibold">{alert.productName}</td>
                            <td>
                              <span className={isSoldOut ? 'text-danger fw-bold' : 'text-warning fw-semibold'}>
                                {alert.stock}
                              </span>
                            </td>
                            <td className="text-muted">{alert.stockAlertThreshold}</td>
                            <td>
                              {isSoldOut ? (
                                <span className="alert-badge badge-soldout">
                                  <i className="bi bi-x-circle-fill me-1"></i> 已售罄
                                </span>
                              ) : (
                                <span className="alert-badge badge-lowstock">
                                  <i className="bi bi-exclamation-triangle-fill me-1"></i> 低庫存
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {(!dashboardData.stockAlerts || dashboardData.stockAlerts.length === 0) && (
                        <tr>
                          <td colSpan="4" className="text-center py-5 text-muted">
                            <i className="bi bi-shield-check-fill text-success d-block mb-2" style={{ fontSize: '2rem' }}></i>
                            目前所有商品庫存皆充足
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Floating Notifications (Toast list) */}
      <div className="toast-container-fixed">
        {toasts.map((toast) => (
          <div key={toast.id} className={`custom-toast slide-in toast-${toast.type}`}>
            <div className="toast-content d-flex align-items-start gap-2">
              <span className="toast-icon">
                {toast.type === 'danger' ? (
                  <i className="bi bi-x-circle-fill"></i>
                ) : (
                  <i className="bi bi-exclamation-triangle-fill"></i>
                )}
              </span>
              <div className="toast-message flex-grow-1">
                <span className="toast-title fw-bold">
                  {toast.type === 'danger' ? '商品已售罄' : '商品庫存不足'}
                </span>
                <p className="mb-0 mt-1">{toast.message}</p>
              </div>
              <button className="toast-close" onClick={() => removeToast(toast.id)}>
                <i className="bi bi-x"></i>
              </button>
            </div>
            <div className="toast-progress"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
