/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Form, Spinner } from 'react-bootstrap';
import API_BASE_URL from '../../utils/api';
import useWebSocket from '../../hooks/useWebSocket';
import './TableList.css';

const ACTIVE_ORDER_STATUSES = 'PENDING,PREPARING,READY';

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
          const subOptNames = allOptsForSub.map(c => {
            let name = c.optionName;
            if (c.priceModifier > 0) {
              name += `(+$${c.priceModifier})`;
            }
            return name;
          }).join('、');
          biTexts.push(`${subName}（${subOptNames}）`);
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

const TableList = () => {
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [formData, setFormData] = useState({ name: '', seats: 2, status: 'EMPTY' });

  // 結帳 Modal 狀態
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutTable, setCheckoutTable] = useState(null);
  const [checkoutOrders, setCheckoutOrders] = useState([]);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // QR Code Modal 狀態
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrcodeTable, setQrcodeTable] = useState(null);

  const fetchTables = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/tables`);
      const json = await res.json();
      if (json.code === 200) {
        setTables(json.data);
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  // WebSocket 即時更新：收到訂單事件時自動刷新桌台狀態 (POS-33)
  useWebSocket('/topic/orders', useCallback((event) => {
    console.log('[TableList] 收到 WebSocket 事件:', event);
    fetchTables();
  }, []));

  const handleClose = () => {
    setShowModal(false);
    setEditingTable(null);
    setFormData({ name: '', seats: 2, status: 'EMPTY' });
  };

  const handleShow = (table = null) => {
    if (table) {
      setEditingTable(table);
      setFormData({ name: table.name, seats: table.seats, status: table.status });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingTable 
      ? `${API_BASE_URL}/tables/${editingTable.id}`
      : `${API_BASE_URL}/tables`;
    const method = editingTable ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        fetchTables();
        handleClose();
      }
    } catch (error) {
      console.error('Error saving table:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('確定要刪除此桌台嗎？')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/tables/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchTables();
      }
    } catch (error) {
      console.error('Error deleting table:', error);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const res = await fetch(`${API_BASE_URL}/tables/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchTables();
      }
    } catch (error) {
      console.error('Error changing table status:', error);
    }
  };

  const handleCloseCheckout = () => {
    setShowCheckout(false);
    setCheckoutTable(null);
    setCheckoutOrders([]);
    setCheckoutError('');
  };

  const handleShowCheckoutModal = async (table) => {
    setCheckoutTable(table);
    setShowCheckout(true);
    setLoadingCheckout(true);
    setCheckoutError('');
    try {
      const res = await fetch(`${API_BASE_URL}/orders?tableId=${table.id}&statuses=${ACTIVE_ORDER_STATUSES}`);
      const json = await res.json();
      if (json.code === 200) {
        setCheckoutOrders(json.data);
      } else {
        setCheckoutError(json.message || '無法取得訂單明細');
      }
    } catch (e) {
      console.error(e);
      setCheckoutError('載入訂單失敗，請確認網路連線。');
    } finally {
      setLoadingCheckout(false);
    }
  };

  const handleCheckoutConfirm = async () => {
    if (!checkoutTable) return;
    setLoadingCheckout(true);
    setCheckoutError('');
    try {
      if (checkoutOrders.length > 0) {
        // 呼叫後端結帳 API (採序列化方式防範資料庫併發鎖衝突)
        for (const order of checkoutOrders) {
          const r = await fetch(`${API_BASE_URL}/orders/${order.id}/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          const json = await r.json();
          if (!r.ok || json.code !== 200) {
            throw new Error(json.message || `訂單 ${order.orderNo} 結帳失敗`);
          }
        }
        setSuccessMessage(`桌台 ${checkoutTable.name} 結帳付款成功！`);
        setShowSuccessModal(true);
        setShowCheckout(false); // 隱藏結帳確認彈窗，避免多個彈窗重疊
      } else {
        // 容錯：若無訂單，詢問是否直接轉為清潔中
        if (window.confirm('此桌台無活動中訂單。是否手動將其設為清潔中？')) {
          await handleStatusChange(checkoutTable.id, 'CLEANING');
        }
        fetchTables();
        handleCloseCheckout();
      }
    } catch (e) {
      console.error(e);
      setCheckoutError(e.message || '結帳失敗，請重試。');
      // 結帳出錯時，重新拉取最新的未結帳訂單，避免後續再次點擊時重複結帳已付款的訂單
      if (checkoutTable) {
        try {
          const r = await fetch(`${API_BASE_URL}/orders?tableId=${checkoutTable.id}&statuses=${ACTIVE_ORDER_STATUSES}`);
          const json = await r.json();
          if (r.ok && json.code === 200) {
            setCheckoutOrders(json.data);
          }
        } catch (err) {
          console.error('Failed to refresh orders after error:', err);
        }
      }
    } finally {
      setLoadingCheckout(false);
    }
  };

  const handleSuccessModalConfirm = () => {
    setShowSuccessModal(false);
    fetchTables();
    handleCloseCheckout();
  };

  const handleShowQRCode = (table) => {
    setQrcodeTable(table);
    setShowQRCode(true);
  };

  const handleCloseQRCode = () => {
    setShowQRCode(false);
    setQrcodeTable(null);
  };

  const handleDownloadQRCode = async () => {
    if (!qrcodeTable) return;
    try {
      const response = await fetch(`${API_BASE_URL}/tables/${qrcodeTable.id}/qrcode`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `table_${qrcodeTable.name}_qrcode.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading QR code:', error);
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'EMPTY': return '空閒';
      case 'OCCUPIED': return '使用中';
      case 'CLEANING': return '清潔中';
      default: return status;
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'EMPTY': return 'badge-empty';
      case 'OCCUPIED': return 'badge-occupied';
      case 'CLEANING': return 'badge-cleaning';
      default: return '';
    }
  };

  const getStatusCardClass = (status) => {
    switch (status) {
      case 'EMPTY': return 'status-empty';
      case 'OCCUPIED': return 'status-occupied';
      case 'CLEANING': return 'status-cleaning';
      default: return '';
    }
  };

  const getOrderStatusLabel = (status) => {
    switch (status) {
      case 'PENDING': return '待製作';
      case 'PREPARING': return '製作中';
      case 'READY': return '已完成';
      default: return status;
    }
  };

  return (
    <>
      <div className="glass-panel">

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="page-title mb-0">桌台管理</h2>
        <button className="modern-btn" onClick={() => handleShow()}>
          <i className="bi bi-plus-lg"></i> 新增桌台
        </button>
      </div>

      {/* Grid of Tables */}
      <div className="table-grid animate-fade-in">
        {tables.map(table => (
          <div key={table.id} className={`table-card ${getStatusCardClass(table.status)}`}>
            {/* Top row with name, icon and action options */}
            <div>
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div className="d-flex align-items-center gap-3">
                  <div className="table-icon-wrapper">
                    <i className="bi bi-grid-3x3-gap-fill"></i>
                  </div>
                  <div>
                    <h4 className="fw-bold mb-0 text-dark">{table.name}</h4>
                    <small className="text-muted d-flex align-items-center gap-1 mt-1">
                      <i className="bi bi-people-fill"></i> {table.seats} 人桌
                    </small>
                  </div>
                </div>
                {/* Edit & Delete Action Buttons */}
                <div className="d-flex gap-2">
                  <button className="btn btn-link text-primary p-0" title="查看 QR Code" onClick={() => handleShowQRCode(table)}>
                    <i className="bi bi-qr-code" style={{fontSize: '15px'}}></i>
                  </button>
                  <button className="btn btn-link text-secondary p-0" title="編輯" onClick={() => handleShow(table)}>
                    <i className="bi bi-pencil" style={{fontSize: '15px'}}></i>
                  </button>
                  <button className="btn btn-link text-danger p-0" title="刪除" onClick={() => handleDelete(table.id)}>
                    <i className="bi bi-trash" style={{fontSize: '15px'}}></i>
                  </button>
                </div>

              </div>

              {/* Status Badge */}
              <div className="mt-2">
                <span className={`status-badge ${getStatusBadgeClass(table.status)}`}>
                  {getStatusLabel(table.status)}
                </span>
              </div>
            </div>

            {/* Quick Status Workflow Action Button */}
            <div className="mt-4">
              {table.status === 'EMPTY' && (
                <button 
                  className="modern-btn w-100 py-2" 
                  onClick={() => navigate(`/admin/order?tableId=${table.id}`)}
                >
                  <i className="bi bi-cart-plus-fill"></i> 開桌點餐
                </button>
              )}
              {table.status === 'OCCUPIED' && (
                <div className="d-flex gap-2 w-100">
                  <button 
                    className="modern-btn modern-btn-outline flex-grow-1 py-2" 
                    onClick={() => navigate(`/admin/order?tableId=${table.id}`)}
                    style={{ fontSize: '14px' }}
                  >
                    <i className="bi bi-cart-plus"></i> 加點
                  </button>
                  <button 
                    className="modern-btn modern-btn-danger flex-grow-1 py-2" 
                    onClick={() => handleShowCheckoutModal(table)}
                    style={{ fontSize: '14px' }}
                  >
                    <i className="bi bi-cash-stack"></i> 結帳
                  </button>
                </div>
              )}
              {table.status === 'CLEANING' && (
                <button 
                  className="modern-btn w-100 py-2" 
                  style={{ background: '#f59e0b' }} 
                  onClick={() => handleStatusChange(table.id, 'EMPTY')}
                >
                  <i className="bi bi-check-circle-fill"></i> 完成清潔
                </button>
              )}
            </div>
          </div>
        ))}
        {tables.length === 0 && (
          <div className="text-center py-5 text-muted w-100" style={{ gridColumn: '1 / -1' }}>
            目前沒有任何桌台
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal show={showModal} onHide={handleClose} centered>
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-bold">{editingTable ? '編輯桌台' : '新增桌台'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>桌台名稱</Form.Label>
              <input 
                type="text" 
                className="modern-input" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="例如: T1, A5"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>容納人數</Form.Label>
              <input 
                type="number" 
                className="modern-input" 
                min="1"
                value={formData.seats}
                onChange={e => setFormData({...formData, seats: parseInt(e.target.value) || 2})}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>桌台狀態</Form.Label>
              <select 
                className="modern-input"
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value})}
                required
              >
                <option value="EMPTY">空閒 (EMPTY)</option>
                <option value="OCCUPIED">使用中 (OCCUPIED)</option>
                <option value="CLEANING">清潔中 (CLEANING)</option>
              </select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <button type="button" className="modern-btn modern-btn-outline" onClick={handleClose}>
              取消
            </button>
            <button type="submit" className="modern-btn">
              儲存
            </button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Checkout Modal */}
      <Modal show={showCheckout} onHide={handleCloseCheckout} centered size="lg">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-bold">桌台結帳確認 - {checkoutTable?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {checkoutError && (
            <div className="alert alert-danger py-2 px-3 mb-3 d-flex justify-content-between align-items-center" style={{borderRadius: '10px'}}>
              <span style={{fontSize: '14px'}}><i className="bi bi-exclamation-triangle-fill me-2"></i>{checkoutError}</span>
              <button className="btn-close" onClick={() => setCheckoutError('')} style={{fontSize: '11px'}}></button>
            </div>
          )}

          {loadingCheckout ? (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 gap-3">
              <Spinner animation="border" variant="primary" />
              <span className="text-muted">正在載入未結帳訂單...</span>
            </div>
          ) : checkoutOrders.length > 0 ? (
            <div className="d-flex flex-column gap-3">
              {checkoutOrders.map(order => (
                <div key={order.id} className="p-3 border rounded-3 bg-light">
                  <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                    <span className="fw-bold text-primary" style={{fontSize: '14px'}}>
                      <i className="bi bi-receipt me-1"></i> {order.orderNo}
                    </span>
                    <span className="badge bg-secondary">
                      {getOrderStatusLabel(order.status)}
                    </span>
                  </div>
                  <div className="d-flex flex-column gap-2 mb-2">
                    {order.items?.map(item => (
                      <div key={item.id} className="d-flex justify-content-between text-secondary align-items-start" style={{fontSize: '14px'}}>
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
                        <span className="align-self-start">${item.subtotal}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-end fw-bold text-dark pt-1 border-top" style={{fontSize: '14px'}}>
                    小計: ${order.totalAmount}
                  </div>
                </div>
              ))}

              {/* 總計結算 */}
              <div className="d-flex justify-content-between align-items-center mt-3 p-3 bg-white border border-primary border-opacity-25 rounded-3">
                <span className="fw-semibold text-secondary">所有訂單總計</span>
                <span className="fs-3 fw-bold text-primary">
                  ${checkoutOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0)}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-info-circle" style={{ fontSize: '32px' }}></i>
              <p className="mt-2 mb-0">此桌台目前沒有任何活動中的未結帳訂單。</p>
              <p className="text-secondary" style={{ fontSize: '13px' }}>若您需要手動將桌台重設為清潔中，請點選下方的「手動設為清潔中」。</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <button type="button" className="modern-btn modern-btn-outline" onClick={handleCloseCheckout} disabled={loadingCheckout}>
            取消
          </button>
          {checkoutOrders.length > 0 ? (
            <button 
              type="button" 
              className="modern-btn" 
              onClick={handleCheckoutConfirm}
              disabled={loadingCheckout}
            >
              {loadingCheckout ? '處理中...' : `確認付款 ($${checkoutOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0)})`}
            </button>
          ) : (
            <button 
              type="button" 
              className="modern-btn modern-btn-danger" 
              onClick={async () => {
                if (window.confirm('確定要直接將此桌台設為清潔中嗎？')) {
                  await handleStatusChange(checkoutTable.id, 'CLEANING');
                  handleCloseCheckout();
                }
              }}
              disabled={loadingCheckout}
            >
              手動設為清潔中
            </button>
          )}
        </Modal.Footer>
      </Modal>
      {/* QR Code Modal */}
      <Modal show={showQRCode} onHide={handleCloseQRCode} centered>
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-bold">{qrcodeTable?.name} 桌台 QR Code</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center py-4">
          {qrcodeTable && (
            <div className="d-flex flex-column align-items-center gap-3">
              <div className="p-3 border rounded-3 bg-white shadow-sm" style={{ maxWidth: '320px' }}>
                <img 
                  src={`${API_BASE_URL}/tables/${qrcodeTable.id}/qrcode`} 
                  alt={`${qrcodeTable.name} QR Code`} 
                  className="img-fluid"
                  style={{ width: '260px', height: '260px' }}
                />
              </div>
              <p className="text-muted mb-0" style={{ fontSize: '14px' }}>
                顧客掃描此 QR Code 即可進行手機自助點餐
              </p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0 justify-content-center">
          <button type="button" className="modern-btn modern-btn-outline me-2" onClick={handleCloseQRCode}>
            關閉
          </button>
          <button type="button" className="modern-btn" onClick={handleDownloadQRCode}>
            <i className="bi bi-download me-1"></i> 下載 PNG
          </button>
        </Modal.Footer>
      </Modal>

      </div>
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content">
            <div className="success-icon-wrapper">
              <i className="bi bi-check-circle-fill"></i>
            </div>
            <h4 className="fw-bold text-dark mb-2">結帳成功！</h4>
            <p className="text-secondary mb-4" style={{ fontSize: '15px' }}>
              {successMessage}
            </p>
            <button className="modern-btn w-100 py-2.5" onClick={handleSuccessModalConfirm}>
              確定
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default TableList;
