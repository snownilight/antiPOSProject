import { useState, useEffect } from 'react';
import { Modal, Form, Spinner } from 'react-bootstrap';
import API_BASE_URL from '../../utils/api';
import { formatOrderOptions } from '../../utils/formatters';

/**
 * 統一的結帳收銀彈窗元件 (Jira POS-72)
 * 
 * 支援：
 * 1. 單筆訂單結帳 (不傳入 table 屬性，此時隱藏多單勾選框)
 * 2. 桌台合併/分訂單結帳 (傳入 table 屬性，顯示多個訂單並支援複選)
 * 3. 複合式支付方法增減與加總校驗
 * 4. 平分人數自動計算與餘數自動分配
 * 5. 手機載具與愛心碼格式 Regex 校驗與互斥限制
 * 6. 成功付款後於 Modal 內切換至 Success 畫面顯示發票號碼
 */
const CheckoutModal = ({ show, onHide, title, table = null, orders = [], onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // 結帳狀態控制與發票資料
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');

  // 結帳明細與選取狀態
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [paymentRows, setPaymentRows] = useState([{ method: 'CASH', amount: '' }]);
  const [carrierNo, setCarrierNo] = useState('');
  const [loveCode, setLoveCode] = useState('');
  const [splitPeople, setSplitPeople] = useState('');

  // 當傳入的 orders 改變時，進行初始化
  useEffect(() => {
    if (orders && orders.length > 0) {
      if (table) {
        // 桌台合併結帳情境下，預設勾選桌台所有活動中訂單
        const ids = orders.map(o => o.id);
        setSelectedOrderIds(ids);
        const total = orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
        setPaymentRows([{ method: 'CASH', amount: total.toString() }]);
      } else {
        // 單筆訂單結帳情境下，固定選擇該筆訂單，且隱藏核取方塊
        setSelectedOrderIds([orders[0].id]);
        setPaymentRows([{ method: 'CASH', amount: Number(orders[0].totalAmount || 0).toString() }]);
      }
    } else {
      setSelectedOrderIds([]);
      setPaymentRows([{ method: 'CASH', amount: '' }]);
    }
    setErrorMsg('');
    setCarrierNo('');
    setLoveCode('');
    setSplitPeople('');
    setShowSuccess(false);
    setSuccessMsg('');
    setInvoiceNo('');
  }, [orders, table, show]);

  // 選擇變更時，自動更新預設付款金額
  const handleOrderSelectionChange = (orderId, checked) => {
    let newSelected;
    if (checked) {
      newSelected = [...selectedOrderIds, orderId];
    } else {
      newSelected = selectedOrderIds.filter(id => id !== orderId);
    }
    setSelectedOrderIds(newSelected);

    // 計算新總額並重置為單筆現金支付
    const selectedOrders = orders.filter(o => newSelected.includes(o.id));
    const total = selectedOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    setPaymentRows([{ method: 'CASH', amount: total.toString() }]);
  };

  const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id));
  const selectedTotal = selectedOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const paymentSum = paymentRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const unallocatedAmount = selectedTotal - paymentSum;

  const handleCheckoutConfirm = async () => {
    if (selectedOrders.length === 0) {
      setErrorMsg('請至少選擇一筆訂單進行結帳');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    // 1. 驗證支付明細
    let currentPaymentSum = 0;
    for (const row of paymentRows) {
      const amt = Number(row.amount);
      if (isNaN(amt) || amt <= 0) {
        setErrorMsg('支付金額必須大於 0');
        setLoading(false);
        return;
      }
      currentPaymentSum += amt;
    }

    if (Math.abs(currentPaymentSum - selectedTotal) > 0.01) {
      setErrorMsg(`支付金額總和 ($${currentPaymentSum}) 必須等於選取訂單總金額 ($${selectedTotal})`);
      setLoading(false);
      return;
    }

    // 2. 驗證手機載具與愛心碼
    if (carrierNo.trim() && loveCode.trim()) {
      setErrorMsg('手機載具與愛心碼不可同時使用');
      setLoading(false);
      return;
    }

    if (carrierNo.trim()) {
      const carrierRegex = /^\/[A-Z0-9.+-]{7}$/;
      if (!carrierRegex.test(carrierNo.trim())) {
        setErrorMsg('手機載具格式錯誤 (必須以 / 開頭，後接 7 碼大寫英數字或 .+- 符號)');
        setLoading(false);
        return;
      }
    }

    if (loveCode.trim()) {
      const loveRegex = /^[0-9]{3,7}$/;
      if (!loveRegex.test(loveCode.trim())) {
        setErrorMsg('愛心碼格式錯誤 (必須為 3 到 7 碼純數字)');
        setLoading(false);
        return;
      }
    }

    try {
      // 3. 分配支付金額至各個被選取的訂單
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

      // 4. 依序呼叫後端結帳 API
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

      // 5. 結帳成功，切換至成功頁面顯示
      const invoiceMsg = generatedInvoices.length > 0 
        ? `\n發票號碼: ${generatedInvoices.join(', ')}` 
        : '';
      const displayTitle = table ? `桌台 ${table.name}` : `訂單 ${orders[0]?.orderNo}`;
      setSuccessMsg(`${displayTitle} 結帳付款成功！${invoiceMsg}`);
      setInvoiceNo(generatedInvoices.join(', '));
      setShowSuccess(true);
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message || '結帳失敗，請重試。');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessConfirm = () => {
    setShowSuccess(false);
    onHide();
    if (onSuccess) onSuccess();
  };

  // 平分人數金額分配邏輯
  const handleSplitPayments = () => {
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
  };

  // 渲染結帳明細清單
  const renderOrdersList = () => {
    if (orders.length === 0) {
      return <div className="text-center py-3 text-muted">無待結帳品項</div>;
    }

    return (
      <div className="d-flex flex-column gap-3">
        {orders.map(order => {
          const isSelected = selectedOrderIds.includes(order.id);
          return (
            <div 
              key={order.id} 
              className={`p-3 border rounded-3 ${
                isSelected 
                  ? 'bg-light border-primary border-opacity-50' 
                  : 'bg-white text-muted border-opacity-50'
              }`} 
              style={{ opacity: isSelected ? 1 : 0.65 }}
            >
              <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                <div className="d-flex align-items-center gap-2">
                  {table && (
                    <Form.Check 
                      type="checkbox"
                      id={`check-order-${order.id}`}
                      checked={isSelected}
                      onChange={(e) => handleOrderSelectionChange(order.id, e.target.checked)}
                    />
                  )}
                  <span className="fw-bold text-primary" style={{ fontSize: '14px' }}>
                    <i className="bi bi-receipt me-1"></i> {order.orderNo}
                  </span>
                </div>
                <span className="badge bg-secondary">
                  {order.status === 'PENDING' ? '待製作' : 
                   order.status === 'PREPARING' ? '製作中' : 
                   order.status === 'READY' ? '已完成' : order.status}
                </span>
              </div>
              
              <div className="d-flex flex-column gap-2 mb-2">
                {(order.items || []).map((item, idx) => (
                  <div key={item.id || idx} className="d-flex justify-content-between text-secondary align-items-start" style={{ fontSize: '13px' }}>
                    <div style={{ flex: 1, marginRight: '16px' }}>
                      <div>
                        {item.productName} <span className="text-dark fw-semibold">x{item.quantity}</span>
                        {item.note && <span className="ms-2 badge bg-light text-muted border" style={{ fontSize: '10px' }}>{item.note}</span>}
                      </div>
                      {item.options && item.options.length > 0 && (
                        <div className="text-muted" style={{ fontSize: '11px', paddingLeft: '8px', marginTop: '2px' }}>
                          {formatOrderOptions(item.options)}
                        </div>
                      )}
                    </div>
                    <span className="align-self-start">${item.subtotal || (item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="text-end fw-bold text-dark pt-1 border-top" style={{ fontSize: '13px' }}>
                小計: ${order.totalAmount}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* 結帳主視窗 */}
      <Modal show={show && !showSuccess} onHide={onHide} centered size="lg">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-bold">{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {errorMsg && (
            <div className="alert alert-danger py-2 px-3 mb-3 d-flex justify-content-between align-items-center" style={{ borderRadius: '10px' }}>
              <span style={{ fontSize: '14px' }}>
                <i className="bi bi-exclamation-triangle-fill me-2"></i>{errorMsg}
              </span>
              <button className="btn-close" onClick={() => setErrorMsg('')} style={{ fontSize: '11px' }}></button>
            </div>
          )}

          {loading ? (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 gap-3">
              <Spinner animation="border" variant="primary" />
              <span className="text-muted">正在處理結帳中...</span>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {renderOrdersList()}

              {/* 總計結算 */}
              <div className="d-flex justify-content-between align-items-center mt-2 p-3 bg-white border border-primary border-opacity-25 rounded-3">
                <span className="fw-semibold text-secondary">選取結帳金額總計</span>
                <span className="fs-3 fw-bold text-primary">
                  ${selectedTotal}
                </span>
              </div>

              {/* 複合式支付設定 */}
              <div className="mt-2 p-3 bg-white border border-opacity-10 rounded-3">
                <h5 className="fw-bold text-dark mb-3" style={{ fontSize: '14px' }}>
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
                    placeholder="輸入人數"
                    value={splitPeople}
                    onChange={(e) => setSplitPeople(e.target.value)}
                    className="modern-input py-1"
                    style={{ maxWidth: '120px', fontSize: '13px' }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm px-3"
                    style={{ fontSize: '12px', borderRadius: '8px' }}
                    onClick={handleSplitPayments}
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
                <div className="d-flex justify-content-between align-items-center mt-2 mb-2 px-1 py-1" style={{ fontSize: '12px' }}>
                  <span>付款已分流加總: <strong>${Number(paymentSum.toFixed(2))}</strong></span>
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
                  <i className="bi bi-plus-lg me-1"></i>新增付款項目
                </button>
              </div>

              {/* 電子發票設定 */}
              <div className="mt-1 p-3 bg-white border border-opacity-10 rounded-3">
                <h5 className="fw-bold text-dark mb-3" style={{ fontSize: '14px' }}>
                  <i className="bi bi-receipt-cutoff me-2 text-primary"></i>發票載具設定 (載具 / 愛心碼二擇一)
                </h5>
                <div className="row g-3">
                  <div className="col-md-6">
                    <Form.Label style={{ fontSize: '12px', color: '#64748b' }}>手機載具</Form.Label>
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
                    <Form.Label style={{ fontSize: '12px', color: '#64748b' }}>愛心碼</Form.Label>
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
          <button type="button" className="modern-btn modern-btn-outline" onClick={onHide} disabled={loading}>
            取消
          </button>
          <button 
            type="button" 
            className="modern-btn" 
            onClick={handleCheckoutConfirm}
            disabled={loading || selectedOrders.length === 0}
          >
            {loading ? '處理中...' : `確認付款 ($${selectedTotal})`}
          </button>
        </Modal.Footer>
      </Modal>

      {/* 結帳成功畫面 (當 showSuccess 為真時獨立渲染) */}
      <Modal show={show && showSuccess} onHide={handleSuccessConfirm} centered>
        <Modal.Body className="text-center p-4">
          <div className="success-icon-wrapper mb-3" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'inline-flex', width: '56px', height: '56px', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
            <i className="bi bi-check-lg"></i>
          </div>
          <h4 className="fw-bold text-dark mb-2">結帳成功！</h4>
          <p className="text-secondary mb-4 style={{ fontSize: '14px' }}">
            {successMsg}
          </p>
          {invoiceNo && (
            <div className="mb-4 p-3 bg-light rounded-3 text-center border">
              <div className="text-muted small mb-1">電子發票號碼</div>
              <div className="fw-bold text-primary fs-5" style={{ letterSpacing: '1px' }}>{invoiceNo}</div>
            </div>
          )}
          <button className="modern-btn w-100 py-2.5" onClick={handleSuccessConfirm}>
            確定
          </button>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default CheckoutModal;
