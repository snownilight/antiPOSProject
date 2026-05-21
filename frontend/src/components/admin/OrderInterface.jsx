/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import API_BASE_URL from '../../utils/api';
import useWebSocket from '../../hooks/useWebSocket';

const OrderInterface = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tableIdFromQuery = searchParams.get('tableId');
  const prevTableIdRef = useRef(tableIdFromQuery);

  const [tables, setTables] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  
  const [selectedTableId, setSelectedTableId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('ALL');
  const [cart, setCart] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successInfo, setSuccessInfo] = useState({ tableName: '', orderNo: '' });



  const fetchTables = async () => {
    try {
      const resTables = await fetch(`${API_BASE_URL}/tables`);
      const jsonTables = await resTables.json();
      if (jsonTables.code === 200) {
        setTables(jsonTables.data);
      } else {
        setErrorMsg(jsonTables.message || '載入桌台資料失敗');
      }
    } catch (e) {
      console.error('Error loading tables:', e);
    }
  };

  // 1. 取得桌台、分類與商品資訊
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 桌台
        await fetchTables();

        // 分類
        const resCategories = await fetch(`${API_BASE_URL}/categories`);
        const jsonCategories = await resCategories.json();
        if (jsonCategories.code === 200) {
          setCategories(jsonCategories.data);
        } else {
          setErrorMsg(jsonCategories.message || '載入分類資料失敗');
        }

        // 商品
        const resProducts = await fetch(`${API_BASE_URL}/products`);
        const jsonProducts = await resProducts.json();
        if (jsonProducts.code === 200) {
          // 只保留 AVAILABLE 的商品
          const availableProducts = jsonProducts.data.filter(p => p.status === 'AVAILABLE');
          setProducts(availableProducts);
        } else {
          setErrorMsg(jsonProducts.message || '載入商品資料失敗');
        }
      } catch (e) {
        console.error('Error loading data:', e);
        setErrorMsg('載入資料失敗，請確認後端服務是否正常。');
      }
    };

    fetchData();
  }, []);

  // WebSocket 即時更新：收到訂單事件時自動刷新桌台狀態 (POS-33)
  useWebSocket('/topic/orders', useCallback((event) => {
    console.log('[OrderInterface] 收到 WebSocket 事件:', event);
    fetchTables();
  }, []));

  // 自動清理任何可能殘留的 Modal Backdrop，保障 SPA 路由切換事件穿透安全
  useEffect(() => {
    const backdrops = document.querySelectorAll('.modal-backdrop');
    const hasBackdrop = backdrops.length > 0;
    const isBodyModalOpen = document.body.classList.contains('modal-open');

    if (hasBackdrop || isBodyModalOpen) {
      backdrops.forEach(el => el.remove());
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
  }, []);

  // 2. 當 URL 中的 tableId 參數變更時，同步更新 selectedTableId 狀態 (防意外覆蓋防護)
  useEffect(() => {
    if (tableIdFromQuery) {
      setSelectedTableId(tableIdFromQuery);
    } else if (prevTableIdRef.current && !tableIdFromQuery) {
      // 只有當 tableId 從有變為無時，才重設為空，避免手動切換下拉選單時被無條件蓋回空字串
      setSelectedTableId('');
    }
    prevTableIdRef.current = tableIdFromQuery;
  }, [tableIdFromQuery]);

  // 取得目前選定的桌台名稱
  const getSelectedTableName = () => {
    const t = tables.find(x => String(x.id) === String(selectedTableId));
    return t ? t.name : '';
  };

  // 購物車操作
  const addToCart = (product) => {
    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    if (existingIndex > -1) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([...cart, { product, quantity: 1, note: '' }]);
    }
  };

  const updateQuantity = (productId, delta) => {
    const newCart = cart.map(item => {
      if (item.product.id === productId) {
        const nextQty = item.quantity + delta;
        return { ...item, quantity: nextQty < 1 ? 1 : nextQty };
      }
      return item;
    });
    setCart(newCart);
  };

  const updateNote = (productId, note) => {
    const newCart = cart.map(item => {
      if (item.product.id === productId) {
        return { ...item, note };
      }
      return item;
    });
    setCart(newCart);
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  // 計算購物車總金額
  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  };

  // 送出訂單
  const handleSubmitOrder = async () => {
    if (!selectedTableId) {
      setErrorMsg('請先選擇點餐桌台！');
      return;
    }
    if (cart.length === 0) {
      setErrorMsg('購物車為空，請先加入商品！');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const payload = {
      tableId: parseInt(selectedTableId),
      items: cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        note: item.note
      }))
    };

    try {
      const res = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (res.ok && json.code === 200) {
        setSuccessInfo({
          tableName: getSelectedTableName(),
          orderNo: json.data.orderNo
        });
        setShowSuccessModal(true);
      } else {
        setErrorMsg(json.message || '送出訂單失敗。');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('系統錯誤，無法與後端伺服器連線。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessModalConfirm = () => {
    setShowSuccessModal(false);
    navigate('/admin/tables');
  };

  // 篩選商品
  const filteredProducts = selectedCategoryId === 'ALL'
    ? products
    : products.filter(p => String(p.categoryId) === String(selectedCategoryId));

  return (
    <div className="container-fluid p-0 animate-fade-in">


      {/* Styles */}
      <style>{`
        .order-layout {
          display: flex;
          height: calc(100vh - 120px);
          gap: 24px;
        }
        .menu-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }
        .cart-section {
          width: 380px;
          display: flex;
          flex-direction: column;
          height: 100%;
          border-left: 1px solid rgba(255, 255, 255, 0.4);
          position: relative;
          z-index: 10;
        }
        .category-scroll {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding-bottom: 8px;
          margin-bottom: 20px;
          scrollbar-width: thin;
        }
        .category-tab {
          background: rgba(255, 255, 255, 0.5);
          border: 1px solid rgba(0, 0, 0, 0.05);
          color: var(--text-secondary);
          padding: 8px 18px;
          border-radius: 20px;
          font-weight: 500;
          font-size: 14px;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.2s;
        }
        .category-tab:hover, .category-tab.active {
          background: var(--accent-color);
          color: white;
          border-color: var(--accent-color);
          transform: translateY(-1px);
        }
        .product-grid-container {
          flex: 1;
          overflow-y: auto;
          padding-right: 4px;
        }
        .product-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 20px;
        }
        .product-card {
          background: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.6);
          border-radius: 16px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .product-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
          border-color: rgba(59, 130, 246, 0.3);
        }
        .product-img-wrapper {
          height: 140px;
          background: linear-gradient(135deg, rgba(96, 165, 250, 0.1), rgba(192, 132, 252, 0.1));
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .product-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .product-placeholder-icon {
          font-size: 36px;
          color: rgba(100, 116, 139, 0.4);
        }
        .product-info {
          padding: 16px;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .product-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 6px;
        }
        .product-desc {
          font-size: 12px;
          color: var(--text-secondary);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-bottom: 12px;
          height: 36px;
        }
        .product-price {
          font-size: 18px;
          font-weight: 700;
          color: var(--accent-color);
        }
        .cart-container {
          background: rgba(255, 255, 255, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.6);
          border-radius: var(--border-radius);
          box-shadow: var(--shadow-md);
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          position: relative;
          z-index: 1;
        }
        .cart-container::before {
          content: "";
          position: absolute;
          top: 0; right: 0; bottom: 0; left: 0;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-radius: inherit;
          z-index: -1;
          pointer-events: none;
        }
        .cart-header {
          padding: 18px 20px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
          background: rgba(255, 255, 255, 0.3);
        }
        .cart-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .cart-item {
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(0, 0, 0, 0.04);
          border-radius: 12px;
          padding: 12px;
          box-shadow: var(--shadow-sm);
        }
        .cart-item-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }
        .cart-item-title {
          font-weight: 600;
          font-size: 14px;
          color: var(--text-primary);
        }
        .cart-item-price {
          font-weight: 600;
          font-size: 14px;
          color: var(--accent-color);
        }
        .cart-item-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .qty-btn {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          border: 1px solid rgba(0,0,0,0.1);
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.2s;
        }
        .qty-btn:hover {
          background: rgba(0, 0, 0, 0.05);
        }
        .cart-item-note {
          border: none;
          background: rgba(0,0,0,0.03);
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 11px;
          width: 140px;
        }
        .cart-item-note:focus {
          outline: none;
          background: rgba(59, 130, 246, 0.05);
        }
        .cart-summary {
          padding: 20px;
          border-top: 1px solid rgba(0, 0, 0, 0.05);
          background: rgba(255, 255, 255, 0.5);
        }
        .locked-table-badge {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          color: var(--accent-color);
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
      `}</style>

      {/* Main Layout */}
      <div className="order-layout">
        {/* Left Side: Product Menu */}
        <div className="menu-section">
          {/* Header */}
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h2 className="page-title mb-0">外場點餐服務</h2>
            <button className="modern-btn modern-btn-outline py-2" onClick={() => navigate('/admin/tables')}>
              <i className="bi bi-arrow-left"></i> 返回桌台
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="alert alert-danger py-2 px-3 mb-3 d-flex justify-content-between align-items-center" style={{borderRadius: '10px'}}>
              <span style={{fontSize: '14px'}}><i className="bi bi-exclamation-triangle-fill me-2"></i>{errorMsg}</span>
              <button className="btn-close" onClick={() => setErrorMsg('')} style={{fontSize: '11px'}}></button>
            </div>
          )}

          {/* Categories Tab Bar */}
          <div className="category-scroll">
            <div 
              className={`category-tab ${selectedCategoryId === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedCategoryId('ALL')}
            >
              全部商品
            </div>
            {categories.map(c => (
              <div 
                key={c.id} 
                className={`category-tab ${String(selectedCategoryId) === String(c.id) ? 'active' : ''}`}
                onClick={() => setSelectedCategoryId(c.id)}
              >
                {c.name}
              </div>
            ))}
          </div>

          {/* Products Grid */}
          <div className="product-grid-container">
            <div className="product-grid">
              {filteredProducts.map(p => (
                <div key={p.id} className="product-card">
                  <div className="product-img-wrapper">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="product-img" />
                    ) : (
                      <i className="bi bi-cup-hot product-placeholder-icon"></i>
                    )}
                  </div>
                  <div className="product-info">
                    <div>
                      <div className="product-title">{p.name}</div>
                      <div className="product-desc" title={p.description}>{p.description || '無商品描述'}</div>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mt-2">
                      <span className="product-price">${p.price}</span>
                      <button className="modern-btn py-1 px-3" style={{fontSize: '13px'}} onClick={() => addToCart(p)}>
                        <i className="bi bi-plus-lg"></i> 加入
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <div className="text-center py-5 text-muted w-100" style={{ gridColumn: '1 / -1' }}>
                  此分類目前沒有販售中的商品
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Cart Panel */}
        <div className="cart-section">
          <div className="cart-container">
            {/* Cart Header: Table Selector */}
            <div className="cart-header">
              <h5 className="fw-bold text-dark mb-3"><i className="bi bi-receipt-cutoff me-2"></i>點餐清單</h5>
              
              {tableIdFromQuery && (
                <div className="locked-table-badge w-100 justify-content-center mb-2">
                  <i className="bi bi-lock-fill"></i> 桌台: {getSelectedTableName()}
                </div>
              )}
              
              <div style={{ display: tableIdFromQuery ? 'none' : 'block' }}>
                <label className="form-label text-muted mb-1" style={{fontSize: '12px'}}>選擇桌台</label>
                <select 
                  className="modern-input" 
                  value={selectedTableId}
                  onChange={e => setSelectedTableId(e.target.value)}
                >
                  <option value="">
                    {tables.length === 0 ? '資料載入中...' : '-- 請選擇桌台 --'}
                  </option>
                  {tables.map(t => (
                    <option key={t.id} value={String(t.id)}>
                      {t.name} ({t.seats}人桌 - {t.status === 'EMPTY' ? '空閒' : t.status === 'OCCUPIED' ? '用餐中' : '清潔中'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="cart-list">
              {cart.map(item => (
                <div key={item.product.id} className="cart-item">
                  <div className="cart-item-header">
                    <span className="cart-item-title">{item.product.name}</span>
                    <span className="cart-item-price">${item.product.price * item.quantity}</span>
                  </div>
                  <div className="cart-item-controls">
                    {/* Quantity Selector */}
                    <div className="d-flex align-items-center gap-2">
                      <button className="qty-btn" onClick={() => updateQuantity(item.product.id, -1)}>-</button>
                      <span className="fw-bold" style={{fontSize: '14px', minWidth: '20px', textAlign: 'center'}}>{item.quantity}</span>
                      <button className="qty-btn" onClick={() => updateQuantity(item.product.id, 1)}>+</button>
                    </div>

                    {/* Note Input */}
                    <input 
                      type="text" 
                      className="cart-item-note" 
                      placeholder="備註 (如: 少冰)"
                      value={item.note}
                      onChange={e => updateNote(item.product.id, e.target.value)}
                    />

                    {/* Remove Button */}
                    <button className="btn btn-link text-danger p-0" title="移除" onClick={() => removeFromCart(item.product.id)}>
                      <i className="bi bi-trash-fill" style={{fontSize: '16px'}}></i>
                    </button>
                  </div>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted gap-2 py-5">
                  <i className="bi bi-cart3" style={{fontSize: '48px', opacity: 0.3}}></i>
                  <span>購物車是空的</span>
                  <small style={{fontSize: '12px'}}>點選左側商品加入</small>
                </div>
              )}
            </div>

            {/* Cart Summary & Order Submit */}
            <div className="cart-summary">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span className="text-secondary fw-semibold">總計金額</span>
                <span className="fs-3 fw-bold text-dark">${calculateTotal()}</span>
              </div>
              <div className="d-flex gap-2">
                <button 
                  className="modern-btn modern-btn-outline flex-grow-1" 
                  onClick={clearCart} 
                  disabled={cart.length === 0}
                >
                  清空
                </button>
                <button 
                  className="modern-btn flex-grow-1 py-2" 
                  onClick={handleSubmitOrder} 
                  disabled={isSubmitting || cart.length === 0 || !selectedTableId}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      <span>送單中...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send-fill"></i> 送出訂單
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content">
            <div className="success-icon-wrapper">
              <i className="bi bi-check-circle-fill"></i>
            </div>
            <h4 className="fw-bold text-dark mb-2">點餐成功！</h4>
            <p className="text-secondary mb-4" style={{ fontSize: '15px' }}>
              桌台 <strong className="text-dark">{successInfo.tableName}</strong> 的訂單已成功送出。
            </p>
            <div className="p-3 bg-light rounded-3 mb-4 text-start" style={{ fontSize: '13px', border: '1px solid rgba(0,0,0,0.05)' }}>
              <div className="d-flex justify-content-between mb-1">
                <span className="text-muted">訂單編號:</span>
                <span className="fw-mono text-dark fw-bold">{successInfo.orderNo}</span>
              </div>
            </div>
            <button className="modern-btn w-100 py-2.5" onClick={handleSuccessModalConfirm}>
              確定並返回桌台
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderInterface;
