/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Spinner, Badge, Modal, Form } from 'react-bootstrap';
import API_BASE_URL from '../../utils/api';
import useWebSocket from '../../hooks/useWebSocket';
import './OrderList.css';

const formatOrderOptions = (options) => {
  if (!options || options.length === 0) return '';

  const parentOptions = options.filter(o => !o.parentId);
  const childOptions = options.filter(o => o.parentId);

  const childMap = {};
  childOptions.forEach(child => {
    const pId = child.parentId;
    if (!childMap[pId]) {
      childMap[pId] = [];
    }
    childMap[pId].push(child);
  });

  const formattedParents = parentOptions.map(parent => {
    const parentChildren = childMap[parent.id] || childMap[parent.optionId] || [];
    const match = parent.optionName.match(/\(([^)]+)\)/);
    
    if (match) {
      const content = match[1];
      const rawItems = content.split('+').map(x => x.trim());
      
      const cleanedParentName = parent.optionName.replace(/\s*\([^)]*\)/g, '').trim();
      let parentText = cleanedParentName;
      if (parent.priceModifier > 0) {
        parentText += ` (+$${parent.priceModifier})`;
      }

      const biTexts = [];
      const isBeverageOrSoup = (name) => {
        const keywords = ["茶", "奶", "水", "汁", "咖啡", "蜜", "汽水", "可樂", "湯", "飲"];
        return keywords.some(kw => name.includes(kw));
      };
      let legacyTargetIdx = rawItems.findIndex(isBeverageOrSoup);
      if (legacyTargetIdx === -1) {
        legacyTargetIdx = rawItems.length - 1;
      }

      rawItems.forEach((subName, idx) => {
        const subOpts = parentChildren.filter(c => c.bundleItemName === subName);
        const legacyOpts = parentChildren.filter(c => !c.bundleItemName);
        
        const allOptsForSub = [...subOpts];
        if (idx === legacyTargetIdx && legacyOpts.length > 0) {
          allOptsForSub.push(...legacyOpts);
        }

        if (allOptsForSub.length > 0) {
          const prodOpt = allOptsForSub.find(c => c.selectedProductId);
          const subOptsWithoutProd = allOptsForSub.filter(c => !c.selectedProductId);

          if (prodOpt) {
            let prodName = prodOpt.optionName;
            if (prodOpt.priceModifier > 0) {
              prodName += `(+$${prodOpt.priceModifier})`;
            }
            if (subOptsWithoutProd.length > 0) {
              const subOptNames = subOptsWithoutProd.map(c => {
                let name = c.optionName;
                if (c.priceModifier > 0) {
                  name += `(+$${c.priceModifier})`;
                }
                return name;
              }).join('、');
              biTexts.push(`${prodName}（${subOptNames}）`);
            } else {
              biTexts.push(prodName);
            }
          } else {
            const subOptNames = allOptsForSub.map(c => {
              let name = c.optionName;
              if (c.priceModifier > 0) {
                name += `(+$${c.priceModifier})`;
              }
              return name;
            }).join('、');
            biTexts.push(`${subName}（${subOptNames}）`);
          }
        } else {
          biTexts.push(subName);
        }
      });

      return `${parentText}：${biTexts.join(' / ')}`;
    }

    let text = parent.optionName;
    if (parent.priceModifier > 0) {
      text += ` (+$${parent.priceModifier})`;
    }
    if (parentChildren.length > 0) {
      const childrenText = parentChildren.map(c => {
        let cText = c.optionName;
        if (c.priceModifier > 0) {
          cText += `(+$${c.priceModifier})`;
        }
        return cText;
      }).join(' / ');
      text += ` (${childrenText})`;
    }
    return text;
  });

  return formattedParents.join(' / ');
};

const OrderList = () => {
  const [activeTab, setActiveTab] = useState('pending_confirm');
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [searchOrderNo, setSearchOrderNo] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Cancellation state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState(null);

  // Success Notification state
  const [successToast, setSuccessToast] = useState('');

  // 結帳 Modal 狀態
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutOrder, setCheckoutOrder] = useState(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [paymentRows, setPaymentRows] = useState([{ method: 'CASH', amount: '' }]);
  const [carrierNo, setCarrierNo] = useState('');
  const [loveCode, setLoveCode] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [splitPeople, setSplitPeople] = useState('');

  const totalAmountVal = Number(checkoutOrder?.totalAmount || 0);
  const paymentSumVal = paymentRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const unallocatedAmount = totalAmountVal - paymentSumVal;

  // Counts for each tab
  const [counts, setCounts] = useState({ pendingConfirm: 0, active: 0 });

  // Fetch tables for filtering
  const fetchTables = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/tables`);
      const json = await res.json();
      if (json.code === 200) {
        setTables(json.data || []);
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  };

  // Fetch orders based on active tab
  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    let statuses = '';
    if (activeTab === 'pending_confirm') {
      statuses = 'PENDING_CONFIRM';
    } else if (activeTab === 'active') {
      statuses = 'PENDING,PREPARING,READY';
    } else if (activeTab === 'history') {
      statuses = 'PAID,CANCELLED';
    }

    try {
      const res = await fetch(`${API_BASE_URL}/orders?statuses=${statuses}`);
      const json = await res.json();
      if (json.code === 200) {
        setOrders(json.data || []);
        setErrorMsg('');
      } else {
        setErrorMsg(json.message || '載入訂單失敗');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setErrorMsg('載入訂單失敗，請確認後端連線。');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  // Fetch counts of pending and active orders
  const fetchCounts = async () => {
    try {
      const [pcRes, actRes] = await Promise.all([
        fetch(`${API_BASE_URL}/orders?statuses=PENDING_CONFIRM`),
        fetch(`${API_BASE_URL}/orders?statuses=PENDING,PREPARING,READY`)
      ]);
      const pcJson = await pcRes.json();
      const actJson = await actRes.json();
      if (pcJson.code === 200 && actJson.code === 200) {
        setCounts({
          pendingConfirm: pcJson.data?.length || 0,
          active: actJson.data?.length || 0
        });
      }
    } catch (err) {
      console.error('Error fetching counts:', err);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchCounts();
  }, [orders]);

  // WebSocket Live Updates subscription
  useWebSocket('/topic/orders', useCallback((event) => {
    console.log('[OrderList] 收到 WebSocket 訂單即時更新:', event);
    fetchOrders();
    fetchCounts();
  }, [fetchOrders]));

  const showSuccess = (message) => {
    setSuccessToast(message);
    setTimeout(() => {
      setSuccessToast('');
    }, 4500);
  };

  // Confirm / Approve Pending Order
  const handleApproveOrder = async (orderId) => {
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PENDING' })
      });
      const json = await res.json();
      if (json.code === 200) {
        showSuccess('訂單已確認，已即時送往廚房製作。');
        fetchOrders();
      } else {
        setErrorMsg(json.message || '確認訂單失敗');
      }
    } catch (error) {
      console.error('Error approving order:', error);
      setErrorMsg('確認訂單發生錯誤，請稍候重試。');
    } finally {
      setIsProcessing(false);
    }
  };

  // Cancel order click
  const handleCancelClick = (order) => {
    setOrderToCancel(order);
    setShowCancelModal(true);
  };

  // Confirm Cancel Order
  const handleCancelConfirm = async () => {
    if (!orderToCancel) return;
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/orders/${orderToCancel.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' })
      });
      const json = await res.json();
      if (json.code === 200) {
        showSuccess(`訂單 ${orderToCancel.orderNo} 已成功取消。`);
        setShowCancelModal(false);
        setOrderToCancel(null);
        fetchOrders();
      } else {
        setErrorMsg(json.message || '取消訂單失敗');
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      setErrorMsg('取消訂單發生錯誤，請稍候重試。');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseCheckout = () => {
    setShowCheckout(false);
    setCheckoutOrder(null);
    setCheckoutError('');
    setPaymentRows([{ method: 'CASH', amount: '' }]);
    setCarrierNo('');
    setLoveCode('');
    setInvoiceNo('');
    setSplitPeople('');
  };

  const handleShowCheckoutModal = (order) => {
    setCheckoutOrder(order);
    setShowCheckout(true);
    setCheckoutError('');
    setCarrierNo('');
    setLoveCode('');
    setInvoiceNo('');
    setSplitPeople('');
    setPaymentRows([{ method: 'CASH', amount: order.totalAmount.toString() }]);
  };

  const handleCheckoutConfirm = async () => {
    if (!checkoutOrder) return;
    setLoadingCheckout(true);
    setCheckoutError('');

    const totalAmount = Number(checkoutOrder.totalAmount || 0);

    // 1. 驗證支付明細
    let paymentSum = 0;
    for (const row of paymentRows) {
      const amt = Number(row.amount);
      if (isNaN(amt) || amt <= 0) {
        setCheckoutError('支付金額必須大於 0');
        setLoadingCheckout(false);
        return;
      }
      paymentSum += amt;
    }

    if (Math.abs(paymentSum - totalAmount) > 0.01) {
      setCheckoutError(`支付金額總和 ($${paymentSum}) 必須等於訂單總金額 ($${totalAmount})`);
      setLoadingCheckout(false);
      return;
    }

    // 2. 驗證手機載具與愛心碼
    if (carrierNo.trim() && loveCode.trim()) {
      setCheckoutError('手機載具與愛心碼不可同時使用');
      setLoadingCheckout(false);
      return;
    }

    if (carrierNo.trim()) {
      const carrierRegex = /^\/[A-Z0-9.+-]{7}$/;
      if (!carrierRegex.test(carrierNo.trim())) {
        setCheckoutError('手機載具格式錯誤 (必須以 / 開頭，後接 7 碼大寫英數字或 .+- 符號)');
        setLoadingCheckout(false);
        return;
      }
    }

    if (loveCode.trim()) {
      const loveRegex = /^[0-9]{3,7}$/;
      if (!loveRegex.test(loveCode.trim())) {
        setCheckoutError('愛心碼格式錯誤 (必須為 3 到 7 碼純數字)');
        setLoadingCheckout(false);
        return;
      }
    }

    try {
      const payload = {
        payments: paymentRows.map(row => ({
          paymentMethod: row.method,
          amount: Number(row.amount)
        })),
        carrierNo: carrierNo.trim() || null,
        loveCode: loveCode.trim() || null
      };

      const res = await fetch(`${API_BASE_URL}/orders/${checkoutOrder.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.code === 200) {
        setInvoiceNo(json.data?.invoiceNo || '');
        setSuccessMessage(`訂單 ${checkoutOrder.orderNo} 結帳付款成功！`);
        setShowSuccessModal(true);
        setShowCheckout(false);
      } else {
        setCheckoutError(json.message || '結帳失敗');
      }
    } catch (error) {
      console.error('Error checking out order:', error);
      setCheckoutError('結帳過程發生錯誤，請稍候重試。');
    } finally {
      setLoadingCheckout(false);
    }
  };

  const handleSuccessModalConfirm = () => {
    setShowSuccessModal(false);
    fetchOrders();
    fetchCounts();
    handleCloseCheckout();
  };

  // Format dates
  const formatTime = (value) => {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit'
    }) + ` (${date.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })})`;
  };

  // Filter logic
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesTable = selectedTableId ? String(order.tableId) === String(selectedTableId) : true;
      const matchesOrderNo = searchOrderNo ? order.orderNo.toLowerCase().includes(searchOrderNo.toLowerCase()) : true;
      return matchesTable && matchesOrderNo;
    });
  }, [orders, selectedTableId, searchOrderNo]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING_CONFIRM':
        return <span className="status-badge status-soldout">待確認</span>;
      case 'PENDING':
        return <span className="status-badge status-hidden">待製作</span>;
      case 'PREPARING':
        return <span className="status-badge status-available" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#1d4ed8' }}>製作中</span>;
      case 'READY':
        return <span className="status-badge status-available">可出餐</span>;
      case 'PAID':
        return <span className="status-badge status-hidden" style={{ background: 'rgba(100, 116, 139, 0.08)', color: '#475569' }}>已付清</span>;
      case 'CANCELLED':
        return <span className="status-badge status-soldout">已取消</span>;
      default:
        return <span className="status-badge status-hidden">{status}</span>;
    }
  };

  const getCardBorderColor = (status) => {
    switch (status) {
      case 'PENDING_CONFIRM': return '#f59e0b';
      case 'PENDING': return '#64748b';
      case 'PREPARING': return '#2563eb';
      case 'READY': return '#10b981';
      case 'CANCELLED': return '#ef4444';
      default: return 'rgba(15, 23, 42, 0.08)';
    }
  };

  return (
    <div className="glass-panel">

      {/* Header */}
      <div className="order-list-header">
        <h2 className="page-title mb-1">訂單管理</h2>
        <div className="text-muted">監控並處理全店顧客自助點餐與外場送單</div>
      </div>

      {/* Tabs */}
      <div className="order-tabs">
        <button
          className={`order-tab ${activeTab === 'pending_confirm' ? 'active' : ''}`}
          onClick={() => { setActiveTab('pending_confirm'); setSelectedTableId(''); setSearchOrderNo(''); }}
        >
          <i className="bi bi-bell-fill"></i>
          待確認
          {counts.pendingConfirm > 0 && (
            <Badge bg="danger" pill style={{ fontSize: '11px' }}>
              {counts.pendingConfirm}
            </Badge>
          )}
        </button>
        <button
          className={`order-tab ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => { setActiveTab('active'); setSelectedTableId(''); setSearchOrderNo(''); }}
        >
          <i className="bi bi-clock-history"></i>
          活動中訂單
          {counts.active > 0 && (
            <Badge bg="primary" pill style={{ fontSize: '11px' }}>
              {counts.active}
            </Badge>
          )}
        </button>
        <button
          className={`order-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => { setActiveTab('history'); setSelectedTableId(''); setSearchOrderNo(''); }}
        >
          <i className="bi bi-archive-fill"></i>
          歷史紀錄
        </button>
      </div>

      {/* Filters */}
      <div className="order-filters">
        <input
          type="text"
          className="modern-input"
          style={{ maxWidth: '280px' }}
          value={searchOrderNo}
          onChange={(e) => setSearchOrderNo(e.target.value)}
          placeholder="搜尋訂單編號..."
        />

        <select
          className="modern-input"
          style={{ maxWidth: '200px' }}
          value={selectedTableId}
          onChange={(e) => setSelectedTableId(e.target.value)}
        >
          <option value="">所有桌台</option>
          {tables.map(table => (
            <option key={table.id} value={table.id}>{table.name} 桌</option>
          ))}
        </select>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="alert alert-danger d-flex align-items-center gap-2 mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Orders Grid */}
      {isLoading ? (
        <div className="d-flex align-items-center justify-content-center py-5 text-muted">
          <Spinner animation="border" size="sm" className="me-2" />
          載入訂單資料中...
        </div>
      ) : (
        <div className="order-grid">
          {filteredOrders.map(order => {
            const borderCol = getCardBorderColor(order.status);
            return (
              <div 
                key={order.id} 
                className="order-card"
                style={{ borderLeft: `6px solid ${borderCol}` }}
              >
                {/* Card Header */}
                <div className="order-card-header">
                  <div>
                    <span className="order-table-title">{order.tableName || `桌台 ${order.tableId}`} 桌</span>
                    <div className="order-no-sub">{order.orderNo}</div>
                  </div>
                  <div>
                    {getStatusBadge(order.status)}
                  </div>
                </div>

                {/* Card Body (Items) */}
                <div className="order-card-body">
                  {(order.items || []).map((item, idx) => (
                    <div key={item.id || idx} className="order-item-row">
                      <div className="item-details">
                        <span className="item-name">{item.productName}</span>
                        {item.options && item.options.length > 0 && (
                          <div className="item-options-list">
                            {formatOrderOptions(item.options)}
                          </div>
                        )}
                        {item.note && <span className="item-note"><i className="bi bi-chat-right-text-fill me-1"></i>{item.note}</span>}
                      </div>
                      <div className="item-qty-price">
                        x{item.quantity} · <span className="fw-semibold text-dark">${item.price * item.quantity}</span>
                      </div>
                    </div>
                  ))}
                  {(!order.items || order.items.length === 0) && (
                    <div className="text-center text-muted small py-3">無餐點明細</div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="order-card-footer">
                  <div className="footer-summary">
                    <span className="time-label">
                      <i className="bi bi-clock"></i>
                      {formatTime(order.createdAt)}
                    </span>
                    <div>
                      <span className="total-amount-label me-1">總額</span>
                      <span className="total-amount-val">${order.totalAmount}</span>
                    </div>
                  </div>

                  {/* Actions based on tab */}
                  {activeTab === 'pending_confirm' && (
                    <div className="action-buttons">
                      <button
                        type="button"
                        className="action-btn modern-btn-outline"
                        disabled={isProcessing}
                        onClick={() => handleCancelClick(order)}
                      >
                        <i className="bi bi-x-lg"></i>
                        拒絕
                      </button>
                      <button
                        type="button"
                        className="action-btn modern-btn"
                        style={{ background: '#10b981' }}
                        disabled={isProcessing}
                        onClick={() => handleApproveOrder(order.id)}
                      >
                        <i className="bi bi-check-lg"></i>
                        接單確認
                      </button>
                    </div>
                  )}

                  {activeTab === 'active' && (
                    <div className="action-buttons">
                      <button
                        type="button"
                        className="action-btn modern-btn-outline text-danger border-danger border-opacity-20"
                        style={{ hover: { background: 'rgba(239,68,68,0.05)' } }}
                        disabled={isProcessing}
                        onClick={() => handleCancelClick(order)}
                      >
                        <i className="bi bi-trash"></i>
                        取消訂單
                      </button>
                      <button
                        type="button"
                        className="action-btn modern-btn"
                        style={{ background: '#10b981' }}
                        disabled={isProcessing}
                        onClick={() => handleShowCheckoutModal(order)}
                      >
                        <i className="bi bi-credit-card"></i>
                        結帳
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filteredOrders.length === 0 && (
            <div className="order-empty">
              <div className="text-center">
                <i className="bi bi-inbox d-block mb-2" style={{ fontSize: '32px' }}></i>
                {searchOrderNo || selectedTableId ? '沒有符合篩選條件的訂單' : '目前沒有此類別的訂單'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success Notification Toast */}
      {successToast && (
        <div className="toast-container">
          <i className="bi bi-check-circle-fill" style={{ fontSize: '20px' }}></i>
          <span>{successToast}</span>
        </div>
      )}

      {/* Order Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content">
            <div className="success-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
              <i className="bi bi-exclamation-triangle"></i>
            </div>
            <h4 className="fw-bold text-dark mb-3">取消訂單確認</h4>
            <p className="text-secondary mb-4" style={{ fontSize: '14px', lineHeight: '1.6' }}>
              您確定要取消桌台 <strong className="text-dark">{(orderToCancel?.tableName) || `桌台 ${orderToCancel?.tableId}`}</strong> 的訂單嗎？
              <br />
              此動作將無法復原，且會釋放桌台相關的活動中訂單。
            </p>
            <div className="d-flex gap-3">
              <button 
                type="button"
                className="modern-btn modern-btn-outline w-100 py-2.5 rounded-3 fw-semibold"
                disabled={isProcessing}
                onClick={() => { setShowCancelModal(false); setOrderToCancel(null); }}
              >
                暫時保留
              </button>
              <button 
                type="button"
                className="modern-btn modern-btn-danger w-100 py-2.5 rounded-3 fw-semibold"
                disabled={isProcessing}
                onClick={handleCancelConfirm}
              >
                確認取消
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Checkout Modal */}
      <Modal show={showCheckout} onHide={handleCloseCheckout} centered size="lg">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-bold">訂單結帳確認 - {checkoutOrder?.orderNo}</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {checkoutError && (
            <div className="alert alert-danger py-2 px-3 mb-3 d-flex justify-content-between align-items-center" style={{borderRadius: '10px'}}>
              <span style={{fontSize: '14px'}}><i className="bi bi-exclamation-triangle-fill me-2"></i>{checkoutError}</span>
              <button className="btn-close" onClick={() => setCheckoutError('')} style={{fontSize: '11px'}}></button>
            </div>
          )}

          {checkoutOrder && (
            <div className="d-flex flex-column gap-3">
              <div className="p-3 border rounded-3 bg-light">
                <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                  <span className="fw-bold text-primary" style={{fontSize: '14px'}}>
                    <i className="bi bi-receipt me-1"></i> {checkoutOrder.tableName || `桌台 ${checkoutOrder.tableId}`} 桌
                  </span>
                  <span className="badge bg-secondary">
                    {checkoutOrder.status}
                  </span>
                </div>
                <div className="d-flex flex-column gap-2 mb-2">
                  {checkoutOrder.items?.map((item, idx) => (
                    <div key={item.id || idx} className="d-flex justify-content-between text-secondary align-items-start" style={{fontSize: '14px'}}>
                      <div style={{ flex: 1, marginRight: '16px' }}>
                        <div>
                          {item.productName} <span className="text-dark fw-semibold">x{item.quantity}</span>
                          {item.note && <span className="ms-2 badge bg-light text-muted border" style={{fontSize: '10px'}}>{item.note}</span>}
                        </div>
                        {item.options && item.options.length > 0 && (
                          <div className="text-muted" style={{ fontSize: '12px', paddingLeft: '8px', marginTop: '2px' }}>
                            {formatOrderOptions(item.options)}
                          </div>
                        )}
                      </div>
                      <span className="align-self-start">${item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="text-end fw-bold text-dark pt-1 border-top" style={{fontSize: '14px'}}>
                  小計: ${checkoutOrder.totalAmount}
                </div>
              </div>

              {/* 總計結算 */}
              <div className="d-flex justify-content-between align-items-center mt-3 p-3 bg-white border border-primary border-opacity-25 rounded-3">
                <span className="fw-semibold text-secondary">訂單總計</span>
                <span className="fs-3 fw-bold text-primary">
                  ${checkoutOrder.totalAmount}
                </span>
              </div>

              {/* 複合式支付設定 */}
              <div className="mt-4 p-3 bg-white border border-opacity-10 rounded-3">
                <h5 className="fw-bold text-dark mb-3" style={{ fontSize: '15px' }}>
                  <i className="bi bi-credit-card-2-back me-2 text-primary"></i>付款方式設定
                </h5>

                {/* 平分人數設定 */}
                <div className="d-flex align-items-center gap-2 mb-3 p-2 bg-light rounded-3">
                  <span style={{ fontSize: '13px', color: '#475569', whiteSpace: 'nowrap' }}>
                    <i className="bi bi-people me-1"></i>平分人數:
                  </span>
                  <Form.Control
                    type="number"
                    min="1"
                    placeholder="輸入平分人數"
                    value={splitPeople}
                    onChange={(e) => setSplitPeople(e.target.value)}
                    className="modern-input py-1"
                    style={{ maxWidth: '120px', fontSize: '13px' }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm px-3"
                    style={{ fontSize: '12px', borderRadius: '8px' }}
                    onClick={() => {
                      const N = parseInt(splitPeople) || 0;
                      if (N <= 0) return;
                      const baseAmount = Math.floor(totalAmountVal / N);
                      const remainder = Number((totalAmountVal - baseAmount * N).toFixed(2));
                      const newRows = [];
                      for (let i = 0; i < N; i++) {
                        let amt = baseAmount;
                        if (i === 0) {
                          amt += remainder;
                        }
                        const amtStr = Number(amt.toFixed(2)).toString();
                        newRows.push({ method: 'CASH', amount: amtStr });
                      }
                      setPaymentRows(newRows);
                    }}
                  >
                    平分
                  </button>
                </div>

                {paymentRows.map((row, index) => (
                  <div key={index} className="d-flex gap-2 mb-2 align-items-center">
                    <Form.Select
                      value={row.method}
                      onChange={(e) => {
                        const newRows = [...paymentRows];
                        newRows[index].method = e.target.value;
                        setPaymentRows(newRows);
                      }}
                      className="modern-input py-1.5"
                      style={{ flex: 1 }}
                    >
                      <option value="CASH">現金 (CASH)</option>
                      <option value="LINE_PAY">LINE Pay</option>
                      <option value="CREDIT_CARD">信用卡 (Credit Card)</option>
                      <option value="EASY_CARD">悠遊卡 (Easy Card)</option>
                    </Form.Select>
                    <Form.Control
                      type="number"
                      placeholder="金額"
                      value={row.amount}
                      onChange={(e) => {
                        const newRows = [...paymentRows];
                        newRows[index].amount = e.target.value;
                        setPaymentRows(newRows);
                      }}
                      className="modern-input py-1.5"
                      style={{ flex: 1 }}
                    />
                    {paymentRows.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm border-0"
                        onClick={() => {
                          setPaymentRows(paymentRows.filter((_, i) => i !== index));
                        }}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    )}
                  </div>
                ))}

                {/* 尚未歸屬金額提示 */}
                <div className="d-flex justify-content-between align-items-center mt-2 mb-2 px-1 py-1" style={{ fontSize: '13px' }}>
                  <span>付款明細加總: <strong>${Number(paymentSumVal.toFixed(2))}</strong></span>
                  {Math.abs(unallocatedAmount) < 0.01 ? (
                    <span className="text-success fw-semibold"><i className="bi bi-check-circle-fill me-1"></i>金額已完全分配</span>
                  ) : unallocatedAmount > 0 ? (
                    <span className="text-warning fw-semibold"><i className="bi bi-exclamation-circle-fill me-1"></i>尚未歸屬金額: ${Number(unallocatedAmount.toFixed(2))}</span>
                  ) : (
                    <span className="text-danger fw-semibold"><i className="bi bi-x-circle-fill me-1"></i>超出分配金額: ${Number(Math.abs(unallocatedAmount).toFixed(2))}</span>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-link btn-sm text-primary p-0 mt-1"
                  onClick={() => setPaymentRows([...paymentRows, { method: 'CASH', amount: '' }])}
                >
                  <i className="bi bi-plus-lg me-1"></i>新增付款方式
                </button>
              </div>

              {/* 電子發票設定 */}
              <div className="mt-3 p-3 bg-white border border-opacity-10 rounded-3">
                <h5 className="fw-bold text-dark mb-3" style={{ fontSize: '15px' }}>
                  <i className="bi bi-receipt-cutoff me-2 text-primary"></i>發票設定 (手機載具 / 愛心碼二擇一)
                </h5>
                <div className="row g-3">
                  <div className="col-md-6">
                    <Form.Label style={{ fontSize: '13px', color: '#64748b' }}>手機載具</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="例如: /AB12345"
                      value={carrierNo}
                      onChange={(e) => {
                        setCarrierNo(e.target.value);
                        if (e.target.value.trim()) {
                          setLoveCode('');
                        }
                      }}
                      disabled={!!loveCode.trim()}
                      className="modern-input"
                    />
                  </div>
                  <div className="col-md-6">
                    <Form.Label style={{ fontSize: '13px', color: '#64748b' }}>愛心碼</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="例如: 888"
                      value={loveCode}
                      onChange={(e) => {
                        setLoveCode(e.target.value);
                        if (e.target.value.trim()) {
                          setCarrierNo('');
                        }
                      }}
                      disabled={!!carrierNo.trim()}
                      className="modern-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <button type="button" className="modern-btn modern-btn-outline" onClick={handleCloseCheckout} disabled={loadingCheckout}>
            取消
          </button>
          <button 
            type="button" 
            className="modern-btn" 
            onClick={handleCheckoutConfirm}
            disabled={loadingCheckout}
          >
            {loadingCheckout ? '處理中...' : `確認付款 ($${checkoutOrder?.totalAmount})`}
          </button>
        </Modal.Footer>
      </Modal>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content">
            <div className="success-icon-wrapper">
              <i className="bi bi-check-circle-fill"></i>
            </div>
            <h4 className="fw-bold text-dark mb-2">結帳成功！</h4>
            <p className="text-secondary mb-3" style={{ fontSize: '15px' }}>
              {successMessage}
            </p>
            {invoiceNo && (
              <div className="mb-4 p-3 bg-light rounded-3 text-center border">
                <div className="text-muted small mb-1">電子發票號碼</div>
                <div className="fw-bold text-primary fs-5" style={{ letterSpacing: '1px' }}>{invoiceNo}</div>
              </div>
            )}
            <button className="modern-btn w-100 py-2.5" onClick={handleSuccessModalConfirm}>
              確定
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderList;
