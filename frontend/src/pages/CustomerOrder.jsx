/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Spinner, Modal } from 'react-bootstrap';
import API_BASE_URL from '../utils/api';
import useWebSocket from '../hooks/useWebSocket';

const CustomerOrder = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // Table Info State
  const [table, setTable] = useState(null);
  const [loadingTable, setLoadingTable] = useState(true);
  const [tableError, setTableError] = useState('');

  // Menu Data State
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loadingMenu, setLoadingMenu] = useState(true);

  // Cart State
  const [cart, setCart] = useState([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [itemNote, setItemNote] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);

  // Order Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState(null);

  // WebSocket Live Updates
  useWebSocket('/topic/orders', useCallback((event) => {
    if (submittedOrder && event.orderId === submittedOrder.id) {
      console.log('[CustomerOrder] 收到即時訂單狀態更新:', event);
      setSubmittedOrder(prev => ({
        ...prev,
        status: event.status
      }));
    }
  }, [submittedOrder]));

  // 1. Fetch Table Info on Mount
  useEffect(() => {
    if (!token) {
      setTableError('無效的點餐連結，網址缺少桌台 Token。請掃描桌上專屬條碼。');
      setLoadingTable(false);
      return;
    }

    const fetchTable = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/tables/token/${token}`);
        const json = await res.json();
        if (json.code === 200) {
          setTable(json.data);
        } else {
          setTableError(json.message || '無效的桌台 Token，請重試或聯絡服務人員。');
        }
      } catch (error) {
        console.error('Error validation token:', error);
        setTableError('載入桌台失敗，請確認網路連線。');
      } finally {
        setLoadingTable(false);
      }
    };

    fetchTable();
  }, [token]);

  // 2. Fetch Categories & Products once Table is verified
  useEffect(() => {
    if (!table) return;

    const fetchMenu = async () => {
      try {
        const [catRes, prodRes] = await Promise.all([
          fetch(`${API_BASE_URL}/categories`),
          fetch(`${API_BASE_URL}/products`)
        ]);
        const catJson = await catRes.json();
        const prodJson = await prodRes.json();

        if (catJson.code === 200 && prodJson.code === 200) {
          const activeCats = catJson.data.filter(c => !c.isDeleted);
          const activeProds = prodJson.data.filter(p => !p.isDeleted && p.status === 'AVAILABLE');
          
          setCategories(activeCats);
          setProducts(activeProds);
          
          if (activeCats.length > 0) {
            setActiveCategory(activeCats[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching menu:', error);
      } finally {
        setLoadingMenu(false);
      }
    };

    fetchMenu();
  }, [table]);

  // Cart Operations
  const addToCart = (product) => {
    setCart(prevCart => {
      const existingIdx = prevCart.findIndex(item => item.product.id === product.id && !item.note);
      if (existingIdx > -1) {
        const newCart = [...prevCart];
        newCart[existingIdx].quantity += 1;
        return newCart;
      }
      return [...prevCart, { product, quantity: 1, note: '' }];
    });
  };

  const updateQuantity = (index, delta) => {
    setCart(prevCart => {
      const newCart = [...prevCart];
      const newQty = newCart[index].quantity + delta;
      if (newQty <= 0) {
        newCart.splice(index, 1);
        if (newCart.length === 0) {
          setShowCartDrawer(false);
        }
      } else {
        newCart[index].quantity = newQty;
      }
      return newCart;
    });
  };

  const openNoteModal = (index) => {
    setEditingItemIndex(index);
    setItemNote(cart[index].note || '');
    setShowNoteModal(true);
  };

  const saveNote = () => {
    if (editingItemIndex !== null) {
      setCart(prevCart => {
        const newCart = [...prevCart];
        newCart[editingItemIndex].note = itemNote;
        return newCart;
      });
    }
    setShowNoteModal(false);
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  };

  const calculateTotalItems = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const submitOrder = async () => {
    if (cart.length === 0 || !token) return;
    setSubmitting(true);
    
    const requestBody = {
      tableToken: token,
      items: cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        note: item.note || null
      }))
    };

    try {
      const res = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const json = await res.json();
      if (json.code === 200) {
        setSubmittedOrder(json.data);
        setCart([]);
        setShowCartDrawer(false);
      } else {
        alert(json.message || '送出訂單失敗，請重試。');
      }
    } catch (error) {
      console.error('Error submitting order:', error);
      alert('送單失敗，請確認網路狀態。');
    } finally {
      setSubmitting(false);
    }
  };

  const getOrderStatusLabel = (status) => {
    switch (status) {
      case 'PENDING_CONFIRM': return '待確認';
      case 'PENDING': return '已確認/待製作';
      case 'PREPARING': return '製作中';
      case 'READY': return '已完成（可取餐/送達）';
      case 'PAID': return '已付清';
      case 'CANCELLED': return '已取消';
      default: return status;
    }
  };

  const getOrderStatusAlertClass = (status) => {
    switch (status) {
      case 'PENDING_CONFIRM': return 'alert-warning';
      case 'PENDING': return 'alert-primary';
      case 'PREPARING': return 'alert-info';
      case 'READY': return 'alert-success';
      case 'CANCELLED': return 'alert-danger';
      default: return 'alert-secondary';
    }
  };

  // Loading Screen
  if (loadingTable) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 bg-light">
        <Spinner animation="border" variant="primary" className="mb-3" />
        <p className="text-secondary fw-semibold">正在驗證桌台資訊...</p>
      </div>
    );
  }

  // Error Screen
  if (tableError) {
    return (
      <div className="container py-5 min-vh-100 d-flex align-items-center justify-content-center">
        <div className="card border-0 shadow-lg p-4 text-center glass-card" style={{ maxWidth: '400px' }}>
          <div className="text-danger mb-4" style={{ fontSize: '48px' }}>
            <i className="bi bi-exclamation-octagon-fill"></i>
          </div>
          <h4 className="fw-bold text-dark mb-3">存取錯誤</h4>
          <p className="text-secondary mb-4" style={{ fontSize: '15px', lineHeight: '1.6' }}>
            {tableError}
          </p>
          <button 
            className="btn btn-secondary w-100 py-2.5 rounded-3 fw-semibold"
            onClick={() => window.location.reload()}
          >
            重新載入
          </button>
        </div>
      </div>
    );
  }

  // Success Screen after order submission
  if (submittedOrder) {
    return (
      <>
        <style>{`
          .success-page {
            max-width: 500px;
            margin: 0 auto;
            min-vh: 100vh;
            padding: 24px 16px;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .success-card {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.5);
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
            padding: 32px 24px;
            text-align: center;
          }
          .success-icon {
            width: 70px;
            height: 70px;
            border-radius: 50%;
            background: rgba(16, 185, 129, 0.1);
            color: #10b981;
            font-size: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
          }
          .status-indicator {
            padding: 12px;
            border-radius: 12px;
            font-size: 15px;
            font-weight: 600;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px dashed rgba(0,0,0,0.06);
            font-size: 14px;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
        `}</style>
        <div className="success-page">
          <div className="success-card animate-fade-in">
            <div className="success-icon">
              <i className="bi bi-check-lg"></i>
            </div>
            <h3 className="fw-bold text-dark mb-2">點餐已送出！</h3>
            <p className="text-secondary mb-4" style={{ fontSize: '14px' }}>
              桌號：<strong className="text-dark">{table.name}</strong> 桌
            </p>

            <div className={`status-indicator ${getOrderStatusAlertClass(submittedOrder.status)} mb-4`}>
              目前狀態：{getOrderStatusLabel(submittedOrder.status)}
              {submittedOrder.status === 'PENDING_CONFIRM' && (
                <div className="small fw-normal text-secondary mt-1">
                  請稍候，服務員確認後即會開始製作
                </div>
              )}
              {submittedOrder.status === 'PENDING' && (
                <div className="small fw-normal text-secondary mt-1">
                  訂單已進入廚房，請耐心等候餐點
                </div>
              )}
            </div>

            <div className="bg-light p-3 rounded-3 mb-4 text-start">
              <div className="detail-row">
                <span className="text-muted">訂單編號</span>
                <span className="fw-bold text-dark">{submittedOrder.orderNo}</span>
              </div>
              <div className="detail-row">
                <span className="text-muted">餐點份數</span>
                <span className="fw-semibold text-dark">
                  {submittedOrder.items?.reduce((sum, item) => sum + item.quantity, 0)} 份
                </span>
              </div>
              <div className="detail-row">
                <span className="text-muted">訂單總額</span>
                <span className="fw-bold text-primary">${submittedOrder.totalAmount}</span>
              </div>
            </div>

            <button 
              className="modern-btn w-100 py-3 mb-2"
              onClick={() => setSubmittedOrder(null)}
            >
              繼續加點
            </button>
          </div>
        </div>
      </>
    );
  }

  // Active Menu Products filtered by Category
  const filteredProducts = products.filter(p => p.categoryId === activeCategory);

  return (
    <>
      <style>{`
        body {
          background-color: #f8fafc;
        }
        .customer-layout {
          max-width: 600px;
          margin: 0 auto;
          min-height: 100vh;
          background: #ffffff;
          box-shadow: 0 0 30px rgba(0, 0, 0, 0.03);
          display: flex;
          flex-direction: column;
          position: relative;
          padding-bottom: 80px; /* offset for bottom cart drawer */
        }
        /* Mobile Header */
        .mobile-header {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          color: white;
          padding: 20px 16px;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 4px 15px rgba(0,0,0,0.08);
        }
        
        /* Category Tabs */
        .category-scroll {
          display: flex;
          overflow-x: auto;
          white-space: nowrap;
          padding: 12px 16px;
          background: #ffffff;
          border-bottom: 1px solid #f1f5f9;
          position: sticky;
          top: 80px;
          z-index: 99;
          gap: 10px;
        }
        .category-scroll::-webkit-scrollbar {
          display: none;
        }
        .category-tab {
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
          background: #f1f5f9;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }
        .category-tab.active {
          color: #ffffff;
          background: #3b82f6;
          box-shadow: 0 4px 10px rgba(59, 130, 246, 0.25);
        }

        /* Products Grid */
        .menu-list {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .product-item {
          display: flex;
          gap: 14px;
          padding: 12px;
          border-radius: 16px;
          background: #ffffff;
          border: 1px solid #f1f5f9;
          transition: all 0.2s;
        }
        .product-item:active {
          transform: scale(0.98);
        }
        .product-img {
          width: 90px;
          height: 90px;
          border-radius: 12px;
          object-fit: cover;
          background-color: #f1f5f9;
        }
        .product-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .product-title {
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 4px;
        }
        .product-desc {
          font-size: 12px;
          color: #64748b;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-bottom: 8px;
        }
        .product-price {
          font-size: 16px;
          font-weight: 700;
          color: #3b82f6;
        }
        .add-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #3b82f6;
          color: white;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          cursor: pointer;
          box-shadow: 0 4px 10px rgba(59, 130, 246, 0.2);
        }

        /* Bottom Cart Drawer */
        .cart-drawer-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          margin: 0 auto;
          width: 100%;
          max-width: 600px;
          height: calc(72px + env(safe-area-inset-bottom));
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px env(safe-area-inset-bottom);
          border-top-left-radius: 18px;
          border-top-right-radius: 18px;
          box-shadow: 0 -8px 25px rgba(0,0,0,0.15);
          z-index: 1000;
          color: white;
        }
        .cart-badge-container {
          position: relative;
          font-size: 24px;
          cursor: pointer;
        }
        .cart-qty-badge {
          position: absolute;
          top: -8px;
          right: -10px;
          background: #ef4444;
          color: white;
          font-size: 11px;
          font-weight: 700;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cart-total-text {
          font-size: 17px;
          font-weight: 700;
        }
        .cart-submit-btn {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(59,130,246,0.3);
        }
        
        /* Drawer Sheet */
        .drawer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.5);
          z-index: 998;
          backdrop-filter: blur(4px);
        }
        .drawer-sheet {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          margin: 0 auto;
          width: 100%;
          max-width: 600px;
          background: white;
          border-top-left-radius: 24px;
          border-top-right-radius: 24px;
          z-index: 999;
          padding: 24px 20px calc(96px + env(safe-area-inset-bottom)); /* extra bottom padding to clear the cart bar */
          box-shadow: 0 -10px 30px rgba(0,0,0,0.15);
          max-height: 75vh;
          overflow-y: auto;
        }
        .drawer-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 0;
          border-bottom: 1px solid #f1f5f9;
        }
        .qty-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .qty-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-weight: bold;
        }
        
        /* Custom styles */
        .glass-card {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.4);
        }
      `}</style>

      <div className="customer-layout">
        {/* Header */}
        <div className="mobile-header d-flex justify-content-between align-items-center">
          <div>
            <h4 className="fw-bold mb-0" style={{ fontSize: '20px' }}>{table.name} 桌</h4>
            <small className="text-white-50"><i className="bi bi-people-fill"></i> {table.seats} 人席</small>
          </div>
          <div className="text-white bg-white bg-opacity-10 py-1.5 px-3 rounded-pill" style={{ fontSize: '13px' }}>
            自助點餐系統
          </div>
        </div>

        {/* Category horizontal scrolling tabs */}
        <div className="category-scroll">
          {categories.map(c => (
            <button
              key={c.id}
              className={`category-tab ${activeCategory === c.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Menu list */}
        {loadingMenu ? (
          <div className="d-flex justify-content-center align-items-center py-5">
            <Spinner animation="border" variant="primary" />
          </div>
        ) : (
          <div className="menu-list animate-fade-in">
            {filteredProducts.map(product => (
              <div key={product.id} className="product-item">
                {product.imageUrl && (
                  <img src={product.imageUrl} alt={product.name} className="product-img" />
                )}
                <div className="product-info">
                  <div>
                    <h5 className="product-title">{product.name}</h5>
                    <p className="product-desc">{product.description || '美味現點現做。'}</p>
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="product-price">${product.price}</span>
                    <button className="add-btn" onClick={() => addToCart(product)}>
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div className="text-center py-5 text-muted">
                該分類目前沒有供應的商品
              </div>
            )}
          </div>
        )}

        {/* Bottom Cart Drawer Bar */}
        {cart.length > 0 && (
          <div className="cart-drawer-bar animate-fade-in">
            <div className="d-flex align-items-center gap-3" onClick={() => setShowCartDrawer(true)}>
              <div className="cart-badge-container">
                <i className="bi bi-cart3"></i>
                <span className="cart-qty-badge">{calculateTotalItems()}</span>
              </div>
              <span className="cart-total-text">總計 ${calculateTotal()}</span>
            </div>
            <button className="cart-submit-btn" onClick={submitOrder} disabled={submitting}>
              {submitting ? '送單中...' : '確認送單'}
            </button>
          </div>
        )}

        {/* Cart Drawer Details Sheet */}
        {showCartDrawer && (
          <>
            <div className="drawer-overlay" onClick={() => setShowCartDrawer(false)}></div>
            <div className="drawer-sheet animate-fade-in">
              <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
                <h5 className="fw-bold text-dark mb-0"><i className="bi bi-cart3 me-2 text-primary"></i>購物車明細</h5>
                <button className="btn-close" onClick={() => setShowCartDrawer(false)}></button>
              </div>

              <div className="d-flex flex-column">
                {cart.map((item, idx) => (
                  <div key={idx} className="drawer-item">
                    <div style={{ flex: 1, marginRight: '16px' }}>
                      <h6 className="fw-bold text-dark mb-1">{item.product.name}</h6>
                      <div className="d-flex gap-2 align-items-center">
                        <span className="text-primary fw-semibold" style={{ fontSize: '14px' }}>
                          ${item.product.price}
                        </span>
                        <button 
                          className="btn btn-link text-muted p-0" 
                          style={{ fontSize: '12px', textDecoration: 'none' }}
                          onClick={() => openNoteModal(idx)}
                        >
                          <i className="bi bi-pencil-square me-0.5"></i> 
                          {item.note ? `備註: ${item.note}` : '加備註'}
                        </button>
                      </div>
                    </div>
                    <div className="qty-controls">
                      <button className="qty-btn" onClick={() => updateQuantity(idx, -1)}>-</button>
                      <span className="fw-bold text-dark">{item.quantity}</span>
                      <button className="qty-btn" onClick={() => updateQuantity(idx, 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Edit Note Modal */}
        <Modal show={showNoteModal} onHide={() => setShowNoteModal(false)} centered size="sm">
          <Modal.Header closeButton className="border-0 pb-0">
            <Modal.Title className="fw-bold" style={{ fontSize: '16px' }}>編輯備註</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <input 
              type="text" 
              className="modern-input" 
              value={itemNote} 
              onChange={e => setItemNote(e.target.value)}
              placeholder="例如：去冰、少油、不要蔥"
              maxLength="50"
            />
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <button className="modern-btn modern-btn-outline py-1.5" onClick={() => setShowNoteModal(false)}>
              取消
            </button>
            <button className="modern-btn py-1.5" onClick={saveNote}>
              確認
            </button>
          </Modal.Footer>
        </Modal>
      </div>
    </>
  );
};

export default CustomerOrder;
