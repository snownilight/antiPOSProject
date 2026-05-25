/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Form } from 'react-bootstrap';
import API_BASE_URL from '../../utils/api';
import useWebSocket from '../../hooks/useWebSocket';
import CheckoutModal from './CheckoutModal';
import { formatOrderOptions } from '../../utils/formatters';
import './TableList.css';

const ACTIVE_ORDER_STATUSES = 'PENDING,PREPARING,READY';

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

  // QR Code Modal 狀態
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrcodeTable, setQrcodeTable] = useState(null);
  const [qrcodeImageUrl, setQrcodeImageUrl] = useState(null);

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
  };

  const handleShowCheckoutModal = async (table) => {
    setCheckoutTable(table);
    setShowCheckout(true);
    try {
      const res = await fetch(`${API_BASE_URL}/orders?tableId=${table.id}&statuses=${ACTIVE_ORDER_STATUSES}`);
      const json = await res.json();
      if (json.code === 200) {
        setCheckoutOrders(json.data);
      } else {
        alert(json.message || '無法取得訂單明細');
      }
    } catch (e) {
      console.error(e);
      alert('載入訂單失敗，請確認網路連線。');
    }
  };

  const handleSuccessModalConfirm = () => {
    fetchTables();
    handleCloseCheckout();
  };

  const handleShowQRCode = async (table) => {
    setQrcodeTable(table);
    setShowQRCode(true);
    setQrcodeImageUrl(null);
    try {
      const response = await fetch(`${API_BASE_URL}/tables/${table.id}/qrcode`);
      if (response.ok) {
        const blob = await response.blob();
        setQrcodeImageUrl(window.URL.createObjectURL(blob));
      }
    } catch (e) {
      console.error('Error loading QR code:', e);
    }
  };

  const handleCloseQRCode = () => {
    setShowQRCode(false);
    setQrcodeTable(null);
    if (qrcodeImageUrl) {
      window.URL.revokeObjectURL(qrcodeImageUrl);
      setQrcodeImageUrl(null);
    }
  };

  const handleDownloadQRCode = () => {
    if (!qrcodeTable || !qrcodeImageUrl) return;
    try {
      const link = document.createElement('a');
      link.href = qrcodeImageUrl;
      link.download = `table_${qrcodeTable.name}_qrcode.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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

      <CheckoutModal 
        show={showCheckout}
        onHide={handleCloseCheckout}
        title={checkoutTable ? `桌台結帳確認 - ${checkoutTable.name}` : ''}
        table={checkoutTable}
        orders={checkoutOrders}
        onSuccess={handleSuccessModalConfirm}
      />

      {/* QR Code Modal */}
      <Modal show={showQRCode} onHide={handleCloseQRCode} centered>
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-bold">桌台 QR Code - {qrcodeTable?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center pb-4">
          <div className="p-3 bg-light rounded mb-3 d-inline-block" style={{ minWidth: '200px', minHeight: '200px' }}>
            {qrcodeImageUrl ? (
              <img src={qrcodeImageUrl} alt="QR Code" style={{ width: '200px', height: '200px', objectFit: 'contain' }} />
            ) : (
              <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                載入中...
              </div>
            )}
          </div>
          <p className="text-muted small mb-0">請顧客使用手機掃描上方 QR Code 進行自助點餐</p>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0 justify-content-center">
          <button type="button" className="modern-btn" onClick={handleDownloadQRCode} disabled={!qrcodeImageUrl}>
            <i className="bi bi-download"></i> 下載圖片
          </button>
        </Modal.Footer>
      </Modal>

      </div>
    </>
  );
};

export default TableList;
