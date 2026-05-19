/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { Modal, Form } from 'react-bootstrap';

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filterCategoryId, setFilterCategoryId] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    price: '',
    description: '',
    imageUrl: '',
    status: 'AVAILABLE'
  });

  const fetchCategories = async () => {
    try {
      const res = await fetch('http://localhost:8081/api/categories');
      const json = await res.json();
      if (json.code === 200) setCategories(json.data);
    } catch (e) { console.error(e); }
  };

  const fetchProducts = async () => {
    try {
      const url = filterCategoryId 
        ? `http://localhost:8081/api/products?categoryId=${filterCategoryId}`
        : 'http://localhost:8081/api/products';
      const res = await fetch(url);
      const json = await res.json();
      if (json.code === 200) setProducts(json.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [filterCategoryId]);

  const handleClose = () => {
    setShowModal(false);
    setEditingProduct(null);
    setFormData({ name: '', categoryId: '', price: '', description: '', imageUrl: '', status: 'AVAILABLE' });
  };

  const handleShow = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        categoryId: product.categoryId,
        price: product.price,
        description: product.description || '',
        imageUrl: product.imageUrl || '',
        status: product.status
      });
    } else {
      setFormData({ ...formData, categoryId: categories.length > 0 ? categories[0].id : '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingProduct 
      ? `http://localhost:8081/api/products/${editingProduct.id}`
      : 'http://localhost:8081/api/products';
    const method = editingProduct ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        fetchProducts();
        handleClose();
      }
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('確定要刪除此商品嗎？')) return;
    try {
      const res = await fetch(`http://localhost:8081/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) fetchProducts();
    } catch (e) { console.error(e); }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const res = await fetch(`http://localhost:8081/api/products/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) fetchProducts();
    } catch (e) { console.error(e); }
  };

  const getCategoryName = (id) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.name : '未知';
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'AVAILABLE': return <span className="status-badge status-available">販售中</span>;
      case 'SOLD_OUT': return <span className="status-badge status-soldout">已售完</span>;
      case 'HIDDEN': return <span className="status-badge status-hidden">隱藏</span>;
      default: return <span className="status-badge">{status}</span>;
    }
  };

  return (
    <div className="glass-panel">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="page-title mb-0">商品管理</h2>
        <div className="d-flex gap-3">
          <select 
            className="modern-input w-auto" 
            value={filterCategoryId} 
            onChange={e => setFilterCategoryId(e.target.value)}
          >
            <option value="">所有分類</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="modern-btn" onClick={() => handleShow()}>
            <i className="bi bi-plus-lg"></i> 新增商品
          </button>
        </div>
      </div>

      <table className="modern-table">
        <thead>
          <tr>
            <th>圖片</th>
            <th>商品名稱</th>
            <th>分類</th>
            <th>價格</th>
            <th>狀態</th>
            <th className="text-end">操作</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id}>
              <td>
                {p.imageUrl ? 
                  <img src={p.imageUrl} alt={p.name} style={{width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px'}} /> : 
                  <div style={{width: '48px', height: '48px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <i className="bi bi-image text-muted"></i>
                  </div>
                }
              </td>
              <td className="fw-semibold">{p.name}</td>
              <td>{getCategoryName(p.categoryId)}</td>
              <td>${p.price}</td>
              <td>{getStatusBadge(p.status)}</td>
              <td className="text-end">
                <select 
                  className="modern-input w-auto d-inline-block me-2 py-1" 
                  style={{fontSize: '13px'}}
                  value={p.status}
                  onChange={e => handleStatusChange(p.id, e.target.value)}
                >
                  <option value="AVAILABLE">上架</option>
                  <option value="SOLD_OUT">售完</option>
                  <option value="HIDDEN">隱藏</option>
                </select>
                <button className="modern-btn modern-btn-outline me-2 py-1 px-2" onClick={() => handleShow(p)}>
                  <i className="bi bi-pencil"></i>
                </button>
                <button className="modern-btn modern-btn-danger py-1 px-2" onClick={() => handleDelete(p.id)}>
                  <i className="bi bi-trash"></i>
                </button>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan="6" className="text-center py-5 text-muted">目前沒有任何商品</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Modal */}
      <Modal show={showModal} onHide={handleClose} size="lg" centered>
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-bold">{editingProduct ? '編輯商品' : '新增商品'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <div className="row">
              <div className="col-md-6 mb-3">
                <Form.Label>商品名稱</Form.Label>
                <input type="text" className="modern-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="col-md-6 mb-3">
                <Form.Label>分類</Form.Label>
                <select className="modern-input" value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})} required>
                  <option value="">請選擇</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-md-6 mb-3">
                <Form.Label>價格</Form.Label>
                <input type="number" step="0.01" className="modern-input" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required />
              </div>
              <div className="col-md-6 mb-3">
                <Form.Label>狀態</Form.Label>
                <select className="modern-input" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} required>
                  <option value="AVAILABLE">販售中</option>
                  <option value="SOLD_OUT">已售完</option>
                  <option value="HIDDEN">隱藏</option>
                </select>
              </div>
              <div className="col-12 mb-3">
                <Form.Label>圖片網址 (URL)</Form.Label>
                <input type="url" className="modern-input" value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} />
              </div>
              <div className="col-12 mb-3">
                <Form.Label>商品描述</Form.Label>
                <textarea className="modern-input" rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <button type="button" className="modern-btn modern-btn-outline" onClick={handleClose}>取消</button>
            <button type="submit" className="modern-btn">儲存</button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default ProductList;
