import { useCallback, useEffect, useMemo, useState } from 'react';
import API_BASE_URL from '../../utils/api';
import useWebSocket from '../../hooks/useWebSocket';

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
      <style>{`
        .kds-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
        }

        .kds-metrics {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .kds-metric {
          min-width: 116px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.72);
          padding: 10px 12px;
        }

        .kds-metric-label {
          display: block;
          color: #64748b;
          font-size: 12px;
          margin-bottom: 2px;
        }

        .kds-metric-value {
          color: #0f172a;
          font-size: 24px;
          font-weight: 800;
          line-height: 1;
        }

        .kds-board {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
        }

        .kds-card {
          display: flex;
          flex-direction: column;
          min-height: 360px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-left: 6px solid #f59e0b;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.86);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
          overflow: hidden;
        }

        .kds-card.preparing {
          border-left-color: #2563eb;
        }

        .kds-card-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 16px 12px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        }

        .kds-table-name {
          font-size: 28px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.05;
        }

        .kds-order-no {
          color: #64748b;
          font-size: 13px;
          margin-top: 4px;
        }

        .kds-status {
          align-self: flex-start;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
        }

        .kds-status.pending {
          background: rgba(245, 158, 11, 0.14);
          color: #b45309;
        }

        .kds-status.preparing {
          background: rgba(37, 99, 235, 0.12);
          color: #1d4ed8;
        }

        .kds-card-body {
          flex: 1;
          padding: 14px 16px;
        }

        .kds-item {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          padding: 10px 0;
          border-bottom: 1px solid rgba(15, 23, 42, 0.07);
        }

        .kds-item:last-child {
          border-bottom: 0;
        }

        .kds-item-name {
          color: #111827;
          font-size: 16px;
          font-weight: 700;
        }

        .kds-item-note {
          display: inline-flex;
          margin-top: 6px;
          border: 1px solid rgba(245, 158, 11, 0.28);
          border-radius: 8px;
          background: rgba(255, 251, 235, 0.9);
          color: #92400e;
          padding: 4px 8px;
          font-size: 12px;
        }

        .kds-qty {
          min-width: 42px;
          height: 34px;
          border-radius: 8px;
          background: #0f172a;
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
        }

        .kds-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 14px 16px 16px;
          border-top: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(248, 250, 252, 0.74);
        }

        .kds-time {
          color: #475569;
          font-size: 13px;
        }

        .kds-action {
          min-width: 128px;
        }

        .kds-empty {
          grid-column: 1 / -1;
          min-height: 320px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px dashed rgba(100, 116, 139, 0.35);
          border-radius: 8px;
          color: #64748b;
          background: rgba(255, 255, 255, 0.56);
        }

        @media (max-width: 768px) {
          .kds-toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .kds-board {
            grid-template-columns: 1fr;
          }

          .kds-card-footer {
            align-items: stretch;
            flex-direction: column;
          }

          .kds-action {
            width: 100%;
          }
        }
      `}</style>

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
