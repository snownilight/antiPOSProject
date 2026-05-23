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
  const [paymentRows, setPaymentRows] = useState([{ method: 'CASH', amount: '' }]);
  const [carrierNo, setCarrierNo] = useState('');
  const [loveCode, setLoveCode] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [splitPeople, setSplitPeople] = useState('');

  const selectedTotal = checkoutOrders.filter(o => selectedOrderIds.includes(o.id)).reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const paymentSum = paymentRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const unallocatedAmount = selectedTotal - paymentSum;

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
    setPaymentRows([{ method: 'CASH', amount: '' }]);
    setCarrierNo('');
    setLoveCode('');
    setInvoiceNo('');
    setSelectedOrderIds([]);
    setSplitPeople('');
  };

  const handleShowCheckoutModal = async (table) => {
    setCheckoutTable(table);
    setShowCheckout(true);
    setLoadingCheckout(true);
    setCheckoutError('');
    setCarrierNo('');
    setLoveCode('');
    setInvoiceNo('');
    setSplitPeople('');
    try {
      const res = await fetch(`${API_BASE_URL}/orders?tableId=${table.id}&statuses=${ACTIVE_ORDER_STATUSES}`);
      const json = await res.json();
      if (json.code === 200) {
        setCheckoutOrders(json.data);
        const activeIds = json.data.map(order => order.id);
        setSelectedOrderIds(activeIds);
        const total = json.data.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
        setPaymentRows([{ method: 'CASH', amount: total.toString() }]);
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

    const selectedOrders = checkoutOrders.filter(order => selectedOrderIds.includes(order.id));
    if (selectedOrders.length === 0) {
      setCheckoutError('請至少勾選一筆訂單進行結帳');
      setLoadingCheckout(false);
      return;
    }

    const totalAmount = selectedOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

    // 1. 驗證支付明細
    let currentPaymentSum = 0;
    for (const row of paymentRows) {
      const amt = Number(row.amount);
      if (isNaN(amt) || amt <= 0) {
        setCheckoutError('支付金額必須大於 0');
        setLoadingCheckout(false);
        return;
      }
      currentPaymentSum += amt;
    }

    if (Math.abs(currentPaymentSum - totalAmount) > 0.01) {
      setCheckoutError(`支付金額總和 ($${currentPaymentSum}) 必須等於選取訂單總金額 ($${totalAmount})`);
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
      if (selectedOrders.length > 0) {
        // 分配支付金額
        const remainingPayments = paymentRows.map(row => ({
          method: row.method,
          amount: Number(row.amount)
        })).filter(row => row.amount > 0);

        const orderPaymentsMap = {};
        for (const order of selectedOrders) {
          let needed = Number(order.totalAmount || 0);
          const paymentsForOrder = [];
          
          for (const p of remainingPayments) {
            if (needed <= 0) break;
            if (p.amount <= 0) continue;
            
            const allocated = Math.min(needed, p.amount);
            paymentsForOrder.push({
              paymentMethod: p.method,
              amount: allocated
            });
            
            p.amount -= allocated;
            needed -= allocated;
          }
          
          if (needed > 0) {
            paymentsForOrder.push({
              paymentMethod: 'CASH',
              amount: needed
            });
          }
          orderPaymentsMap[order.id] = paymentsForOrder;
        }

        // 呼叫後端結帳 API
        const generatedInvoices = [];
        for (const order of selectedOrders) {
          const payload = {
            payments: orderPaymentsMap[order.id],
            carrierNo: carrierNo.trim() || null,
            loveCode: loveCode.trim() || null
          };

          const r = await fetch(`${API_BASE_URL}/orders/${order.id}/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const json = await r.json();
          if (!r.ok || json.code !== 200) {
            throw new Error(json.message || `訂單 ${order.orderNo} 結帳失敗`);
          }
          if (json.data?.invoiceNo) {
            generatedInvoices.push(json.data.invoiceNo);
          }
        }
        
        const invoiceMsg = generatedInvoices.length > 0 
          ? `\n發票號碼: ${generatedInvoices.join(', ')}` 
          : '';
        setSuccessMessage(`桌台 ${checkoutTable.name} 結帳付款成功！${invoiceMsg}`);
        setInvoiceNo(generatedInvoices.join(', '));
        setShowSuccessModal(true);
        setShowCheckout(false);
      } else {
        if (window.confirm('此桌台無活動中訂單。是否手動將其設為清潔中？')) {
          await handleStatusChange(checkoutTable.id, 'CLEANING');
        }
        fetchTables();
        handleCloseCheckout();
      }
    } catch (e) {
      console.error(e);
      setCheckoutError(e.message || '結帳失敗，請重試。');
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
              {checkoutOrders.map(order => {
                const isSelected = selectedOrderIds.includes(order.id);
                return (
                  <div key={order.id} className={`p-3 border rounded-3 ${isSelected ? 'bg-light border-primary border-opacity-50' : 'bg-white text-muted border-opacity-50'}`} style={{ opacity: isSelected ? 1 : 0.65 }}>
                    <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                      <div className="d-flex align-items-center gap-2">
                        <Form.Check 
                          type="checkbox"
                          id={`check-order-${order.id}`}
                          checked={isSelected}
                          onChange={() => {
                            let newSelected;
                            if (isSelected) {
                              newSelected = selectedOrderIds.filter(id => id !== order.id);
                            } else {
                              newSelected = [...selectedOrderIds, order.id];
                            }
                            setSelectedOrderIds(newSelected);
                            // 重置付款明細為新選取的總額
                            const selectedOrders = checkoutOrders.filter(o => newSelected.includes(o.id));
                            const total = selectedOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
                            setPaymentRows([{ method: 'CASH', amount: total.toString() }]);
                          }}
                        />
                        <span className="fw-bold text-primary" style={{fontSize: '14px'}}>
                          <i className="bi bi-receipt me-1"></i> {order.orderNo}
                        </span>
                      </div>
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
                );
              })}

              {/* 總計結算 */}
              <div className="d-flex justify-content-between align-items-center mt-3 p-3 bg-white border border-primary border-opacity-25 rounded-3">
                <span className="fw-semibold text-secondary">選取訂單總計</span>
                <span className="fs-3 fw-bold text-primary">
                  ${selectedTotal}
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
                      const baseAmount = Math.floor(selectedTotal / N);
                      const remainder = Number((selectedTotal - baseAmount * N).toFixed(2));
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
                  <span>付款明細加總: <strong>${Number(paymentSum.toFixed(2))}</strong></span>
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
              disabled={loadingCheckout || selectedOrderIds.length === 0}
            >
              {loadingCheckout ? '處理中...' : `確認付款 ($${selectedTotal})`}
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
            <p className="text-secondary mb-3" style={{ fontSize: '15px' }}>
              桌台 {checkoutTable?.name} 結帳付款成功！
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
    </>
  );
};

export default TableList;
