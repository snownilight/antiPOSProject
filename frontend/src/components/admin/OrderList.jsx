/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Spinner, Badge } from 'react-bootstrap';
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

  // Checkout active order
  const handleCheckoutOrder = async (orderId) => {
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/orders/${orderId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const json = await res.json();
      if (json.code === 200) {
        showSuccess('結帳成功！桌台狀態已自動轉為清潔中。');
        fetchOrders();
      } else {
        setErrorMsg(json.message || '結帳失敗');
      }
    } catch (error) {
      console.error('Error checking out order:', error);
      setErrorMsg('結帳過程發生錯誤，請稍候重試。');
    } finally {
      setIsProcessing(false);
    }
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
                        onClick={() => handleCheckoutOrder(order.id)}
                      >
                        <i className="bi bi-credit-card"></i>
                        直接結帳
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
    </div>
  );
};

export default OrderList;
