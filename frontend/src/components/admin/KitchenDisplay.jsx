import { useCallback, useEffect, useMemo, useState } from 'react';
import API_BASE_URL from '../../utils/api';
import useWebSocket from '../../hooks/useWebSocket';
import './KitchenDisplay.css';

const KitchenDisplay = () => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchKitchenOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/orders/kitchen`);
      const json = await res.json();
      if (json.code === 200) {
        setOrders(json.data || []);
        setErrorMsg('');
      } else {
        setErrorMsg(json.message || '載入廚房訂單失敗');
      }
    } catch (error) {
      console.error('Error loading kitchen orders:', error);
      setErrorMsg('載入廚房訂單失敗，請確認後端服務是否正常。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchKitchenOrders();
  }, [fetchKitchenOrders]);

  useWebSocket('/topic/orders', useCallback((event) => {
    if (event?.event === 'ORDER_CREATED' || event?.event === 'ORDER_STATUS_CHANGED') {
      fetchKitchenOrders();
    }
  }, [fetchKitchenOrders]));

  const updateOrderStatus = async (order, nextStatus) => {
    setUpdatingOrderId(order.id);
    setErrorMsg('');

    try {
      const res = await fetch(`${API_BASE_URL}/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const json = await res.json();
      if (!res.ok || json.code !== 200) {
        throw new Error(json.message || `訂單 ${order.orderNo} 狀態更新失敗`);
      }
      await fetchKitchenOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      setErrorMsg(error.message || '更新訂單狀態失敗，請稍後再試。');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const pendingCount = useMemo(
    () => orders.filter(order => order.status === 'PENDING').length,
    [orders]
  );
  const preparingCount = useMemo(
    () => orders.filter(order => order.status === 'PREPARING').length,
    [orders]
  );

  const getStatusLabel = (status) => {
    switch (status) {
      case 'PENDING': return '待製作';
      case 'PREPARING': return '製作中';
      default: return status;
    }
  };

  const formatTime = (value) => {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="glass-panel">

      <div className="kds-toolbar">
        <div>
          <h2 className="page-title mb-1">廚房看板</h2>
          <div className="text-muted">即時同步外場送單與製作狀態</div>
        </div>
        <div className="kds-metrics">
          <div className="kds-metric">
            <span className="kds-metric-label">待製作</span>
            <span className="kds-metric-value">{pendingCount}</span>
          </div>
          <div className="kds-metric">
            <span className="kds-metric-label">製作中</span>
            <span className="kds-metric-value">{preparingCount}</span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="alert alert-danger d-flex align-items-center gap-2" role="alert">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <span>{errorMsg}</span>
        </div>
      )}

      {isLoading ? (
        <div className="d-flex align-items-center justify-content-center py-5 text-muted">
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          載入廚房訂單中...
        </div>
      ) : (
        <div className="kds-board">
          {orders.map(order => {
            const isUpdating = updatingOrderId === order.id;
            const isPreparing = order.status === 'PREPARING';
            const nextStatus = isPreparing ? 'READY' : 'PREPARING';

            return (
              <article key={order.id} className={`kds-card ${isPreparing ? 'preparing' : 'pending'}`}>
                <div className="kds-card-header">
                  <div>
                    <div className="kds-table-name">{order.tableName || `桌台 ${order.tableId}`}</div>
                    <div className="kds-order-no">{order.orderNo}</div>
                  </div>
                  <span className={`kds-status ${isPreparing ? 'preparing' : 'pending'}`}>
                    {getStatusLabel(order.status)}
                  </span>
                </div>

                <div className="kds-card-body">
                  {(order.items || []).map(item => (
                    <div key={item.id} className="kds-item">
                      <div>
                        <div className="kds-item-name">{item.productName}</div>
                        {item.note && <span className="kds-item-note">{item.note}</span>}
                      </div>
                      <span className="kds-qty">x{item.quantity}</span>
                    </div>
                  ))}
                </div>

                <div className="kds-card-footer">
                  <div className="kds-time">
                    <i className="bi bi-clock me-1"></i>
                    {formatTime(order.createdAt)}
                  </div>
                  <button
                    type="button"
                    className={`modern-btn kds-action ${isPreparing ? '' : 'modern-btn-outline'}`}
                    disabled={isUpdating}
                    onClick={() => updateOrderStatus(order, nextStatus)}
                  >
                    {isUpdating ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        更新中
                      </>
                    ) : isPreparing ? (
                      <>
                        <i className="bi bi-check2-circle"></i> 完成
                      </>
                    ) : (
                      <>
                        <i className="bi bi-play-fill"></i> 開始製作
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}

          {orders.length === 0 && (
            <div className="kds-empty">
              <div className="text-center">
                <i className="bi bi-check2-circle d-block mb-2" style={{ fontSize: '34px' }}></i>
                目前沒有待製作訂單
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KitchenDisplay;
