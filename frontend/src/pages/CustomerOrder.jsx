/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Spinner, Modal } from 'react-bootstrap';
import API_BASE_URL from '../utils/api';
import useWebSocket from '../hooks/useWebSocket';
import './CustomerOrder.css';

const CustomerOrder = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // Table Info State
  const [table, setTable] = useState(null);
  const [loadingTable, setLoadingTable] = useState(true);
  const [tableError, setTableError] = useState('');

  // Menu Data State
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loadingMenu, setLoadingMenu] = useState(true);

  // Cart State
  const [cart, setCart] = useState([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [itemNote, setItemNote] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);

  // Customization State (POS-48)
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({}); // groupId -> array of optionIds
  const [showCustomModal, setShowCustomModal] = useState(false);

  // Order Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState(null);

  // WebSocket Live Updates
  useWebSocket('/topic/orders', useCallback((event) => {
    if (submittedOrder && event.orderId === submittedOrder.id) {
      console.log('[CustomerOrder] 收到即時訂單狀態更新:', event);
      setSubmittedOrder(prev => ({
        ...prev,
        status: event.status
      }));
    }
  }, [submittedOrder]));

  // 1. Fetch Table Info on Mount
  useEffect(() => {
    if (!token) {
      setTableError('無效的點餐連結，網址缺少桌台 Token。請掃描桌上專屬條碼。');
      setLoadingTable(false);
      return;
    }

    const fetchTable = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/tables/token/${token}`);
        const json = await res.json();
        if (json.code === 200) {
          setTable(json.data);
        } else {
          setTableError(json.message || '無效的桌台 Token，請重試或聯絡服務人員。');
        }
      } catch (error) {
        console.error('Error validation token:', error);
        setTableError('載入桌台失敗，請確認網路連線。');
      } finally {
        setLoadingTable(false);
      }
    };

    fetchTable();
  }, [token]);

  // 2. Fetch Categories & Products once Table is verified
  useEffect(() => {
    if (!table) return;

    const fetchMenu = async () => {
      try {
        const [catRes, prodRes] = await Promise.all([
          fetch(`${API_BASE_URL}/categories`),
          fetch(`${API_BASE_URL}/products`)
        ]);
        const catJson = await catRes.json();
        const prodJson = await prodRes.json();

        if (catJson.code === 200 && prodJson.code === 200) {
          const activeCats = catJson.data.filter(c => !c.isDeleted);
          const activeProds = prodJson.data.filter(p => !p.isDeleted && p.status === 'AVAILABLE');
          
          setCategories(activeCats);
          setProducts(activeProds);
          
          if (activeCats.length > 0) {
            setActiveCategory(activeCats[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching menu:', error);
      } finally {
        setLoadingMenu(false);
      }
    };

    fetchMenu();
  }, [table]);

  // Cart Operations
  // Cart Operations (POS-48)
  const findOptionInProduct = (product, optionId) => {
    if (!product || !product.modifierGroups) return null;
    
    const searchGroups = (groups) => {
      for (const group of groups) {
        if (!group.options) continue;
        for (const opt of group.options) {
          if (opt.id === optionId) {
            return opt;
          }
          if (opt.modifierGroups) {
            const found = searchGroups(opt.modifierGroups);
            if (found) return found;
          }
        }
      }
      return null;
    };
    
    return searchGroups(product.modifierGroups);
  };

  const getActiveModifierGroups = (product, selectedOptionsMap) => {
    const activeGroups = [];
    if (!product || !product.modifierGroups) return activeGroups;
    
    const collectActive = (groups) => {
      groups.forEach(group => {
        activeGroups.push(group);
        const selectedIds = selectedOptionsMap[group.id] || [];
        selectedIds.forEach(optId => {
          const opt = group.options?.find(o => o.id === optId);
          if (opt) {
            if (opt.bundleItems) {
              opt.bundleItems.forEach(bi => {
                if (bi.modifierGroups) {
                  collectActive(bi.modifierGroups);
                }
              });
            }
            if (opt.modifierGroups) {
              collectActive(opt.modifierGroups);
            }
          }
        });
      });
    };
    
    collectActive(product.modifierGroups);
    return activeGroups;
  };

  const calculateOptionsPriceSum = (product, optionIds) => {
    if (!product.modifierGroups || !optionIds || optionIds.length === 0) return 0;
    let sum = 0;
    
    const scanGroups = (groups) => {
      groups.forEach(group => {
        if (group.options) {
          group.options.forEach(opt => {
            if (optionIds.includes(opt.id)) {
              sum += opt.priceModifier;
            }
            if (opt.bundleItems) {
              opt.bundleItems.forEach(bi => {
                if (bi.modifierGroups) {
                  scanGroups(bi.modifierGroups);
                }
              });
            }
            if (opt.modifierGroups) {
              scanGroups(opt.modifierGroups);
            }
          });
        }
      });
    };
    
    scanGroups(product.modifierGroups);
    return sum;
  };

  const getOptionNamesText = (product, optionIds) => {
    if (!product.modifierGroups || !optionIds || optionIds.length === 0) return '';
    
    const formatOption = (opt) => {
      let optText = opt.name;
      if (opt.priceModifier > 0) {
        optText += `(+$${opt.priceModifier})`;
      }
      
      // If bundleItems exist, format them dynamically (POS-48)
      if (opt.bundleItems && opt.bundleItems.length > 0) {
        const cleanedName = opt.name.replace(/\s*\([^)]*\)/g, '').trim();
        let formattedName = cleanedName;
        if (opt.priceModifier > 0) {
          formattedName += `(+$${opt.priceModifier})`;
        }
        
        const biTexts = [];
        opt.bundleItems.forEach(bi => {
          const selectedSubOpts = [];
          if (bi.modifierGroups) {
            bi.modifierGroups.forEach(subGroup => {
              if (subGroup.options) {
                subGroup.options.forEach(subOpt => {
                  if (optionIds.includes(subOpt.id)) {
                    let subOptName = subOpt.name;
                    if (subOpt.priceModifier > 0) {
                      subOptName += `(+$${subOpt.priceModifier})`;
                    }
                    selectedSubOpts.push(subOptName);
                  }
                });
              }
            });
          }
          if (selectedSubOpts.length > 0) {
            biTexts.push(`${bi.name}（${selectedSubOpts.join('、')}）`);
          } else {
            biTexts.push(bi.name);
          }
        });
        
        return `${formattedName}：${biTexts.join(' / ')}`;
      }
      
      if (opt.modifierGroups && opt.modifierGroups.length > 0) {
        const subNames = [];
        opt.modifierGroups.forEach(subGroup => {
          if (subGroup.options) {
            subGroup.options.forEach(subOpt => {
              if (optionIds.includes(subOpt.id)) {
                subNames.push(formatOption(subOpt));
              }
            });
          }
        });
        if (subNames.length > 0) {
          optText += ` (${subNames.join(' / ')})`;
        }
      }
      return optText;
    };

    const names = [];
    product.modifierGroups.forEach(group => {
      if (group.options) {
        group.options.forEach(opt => {
          if (optionIds.includes(opt.id)) {
            names.push(formatOption(opt));
          }
        });
      }
    });
    
    return names.join(' / ');
  };


  const handleProductClick = (product) => {
    if (product.modifierGroups && product.modifierGroups.length > 0) {
      setSelectedProduct(product);
      const initial = {};
      
      const initGroup = (group) => {
        const defaultOptions = [];
        if (group.minSelection === 1 && group.maxSelection === 1 && group.options && group.options.length > 0) {
          const defaultOpt = group.options[0];
          defaultOptions.push(defaultOpt.id);
          if (defaultOpt.modifierGroups) {
            defaultOpt.modifierGroups.forEach(initGroup);
          }
        }
        initial[group.id] = defaultOptions;
      };
      
      product.modifierGroups.forEach(initGroup);
      setSelectedOptions(initial);
      setShowCustomModal(true);
    } else {
      addCustomizedToCart(product, [], '');
    }
  };

  const addCustomizedToCart = (product, optionIds, note) => {
    const sortedOptionIds = [...optionIds].sort((a, b) => a - b);
    setCart(prevCart => {
      const existingIdx = prevCart.findIndex(item => 
        item.product.id === product.id && 
        JSON.stringify(item.optionIds) === JSON.stringify(sortedOptionIds) &&
        item.note === note
      );
      if (existingIdx > -1) {
        const newCart = [...prevCart];
        newCart[existingIdx].quantity += 1;
        return newCart;
      }
      const optionsPriceSum = calculateOptionsPriceSum(product, sortedOptionIds);
      const unitPrice = product.price + optionsPriceSum;
      return [...prevCart, { product, quantity: 1, optionIds: sortedOptionIds, note, unitPrice }];
    });
  };

  const updateQuantity = (index, delta) => {
    setCart(prevCart => {
      const newCart = [...prevCart];
      const newQty = newCart[index].quantity + delta;
      if (newQty <= 0) {
        newCart.splice(index, 1);
        if (newCart.length === 0) {
          setShowCartDrawer(false);
        }
      } else {
        newCart[index].quantity = newQty;
      }
      return newCart;
    });
  };

  const openNoteModal = (index) => {
    setEditingItemIndex(index);
    setItemNote(cart[index].note || '');
    setShowNoteModal(true);
  };

  const saveNote = () => {
    if (editingItemIndex !== null) {
      setCart(prevCart => {
        const newCart = [...prevCart];
        newCart[editingItemIndex].note = itemNote;
        return newCart;
      });
    }
    setShowNoteModal(false);
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  };

  const calculateTotalItems = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const buildStructuredSelectedOptions = (product, optionIds) => {
    if (!product || !product.modifierGroups || !optionIds || optionIds.length === 0) {
      return null;
    }
    
    const selectedOptionsPayload = [];
    
    product.modifierGroups.forEach(group => {
      if (group.options) {
        group.options.forEach(opt => {
          if (optionIds.includes(opt.id)) {
            const selOptPayload = {
              optionId: opt.id,
              bundleItems: []
            };
            
            if (opt.bundleItems && opt.bundleItems.length > 0) {
              opt.bundleItems.forEach(bi => {
                const childOptionIds = [];
                if (bi.modifierGroups) {
                  bi.modifierGroups.forEach(subG => {
                    if (subG.options) {
                      subG.options.forEach(subOpt => {
                        if (optionIds.includes(subOpt.id)) {
                          childOptionIds.push(subOpt.id);
                        }
                      });
                    }
                  });
                }
                selOptPayload.bundleItems.push({
                  bundleItemId: bi.id,
                  optionIds: childOptionIds
                });
              });
            }
            
            selectedOptionsPayload.push(selOptPayload);
          }
        });
      }
    });
    
    return selectedOptionsPayload;
  };

  const submitOrder = async () => {
    if (cart.length === 0 || !token) return;
    setSubmitting(true);
    
    const requestBody = {
      tableToken: token,
      items: cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        note: item.note || null,
        optionIds: item.optionIds || [],
        selectedOptions: buildStructuredSelectedOptions(item.product, item.optionIds)
      }))
    };

    try {
      const res = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const json = await res.json();
      if (json.code === 200) {
        setSubmittedOrder(json.data);
        setCart([]);
        setShowCartDrawer(false);
      } else {
        alert(json.message || '送出訂單失敗，請重試。');
      }
    } catch (error) {
      console.error('Error submitting order:', error);
      alert('送單失敗，請確認網路狀態。');
    } finally {
      setSubmitting(false);
    }
  };

  const getOrderStatusLabel = (status) => {
    switch (status) {
      case 'PENDING_CONFIRM': return '待確認';
      case 'PENDING': return '已確認/待製作';
      case 'PREPARING': return '製作中';
      case 'READY': return '已完成（可取餐/送達）';
      case 'PAID': return '已付清';
      case 'CANCELLED': return '已取消';
      default: return status;
    }
  };

  const getOrderStatusAlertClass = (status) => {
    switch (status) {
      case 'PENDING_CONFIRM': return 'alert-warning';
      case 'PENDING': return 'alert-primary';
      case 'PREPARING': return 'alert-info';
      case 'READY': return 'alert-success';
      case 'CANCELLED': return 'alert-danger';
      default: return 'alert-secondary';
    }
  };

  // Loading Screen
  if (loadingTable) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 bg-light">
        <Spinner animation="border" variant="primary" className="mb-3" />
        <p className="text-secondary fw-semibold">正在驗證桌台資訊...</p>
      </div>
    );
  }

  // Error Screen
  if (tableError) {
    return (
      <div className="container py-5 min-vh-100 d-flex align-items-center justify-content-center">
        <div className="card border-0 shadow-lg p-4 text-center glass-card" style={{ maxWidth: '400px' }}>
          <div className="text-danger mb-4" style={{ fontSize: '48px' }}>
            <i className="bi bi-exclamation-octagon-fill"></i>
          </div>
          <h4 className="fw-bold text-dark mb-3">存取錯誤</h4>
          <p className="text-secondary mb-4" style={{ fontSize: '15px', lineHeight: '1.6' }}>
            {tableError}
          </p>
          <button 
            className="btn btn-secondary w-100 py-2.5 rounded-3 fw-semibold"
            onClick={() => window.location.reload()}
          >
            重新載入
          </button>
        </div>
      </div>
    );
  }

  // Success Screen after order submission
  if (submittedOrder) {
    return (
      <>
        <div className="success-page">
          <div className="success-card animate-fade-in">
            <div className="success-icon">
              <i className="bi bi-check-lg"></i>
            </div>
            <h3 className="fw-bold text-dark mb-2">點餐已送出！</h3>
            <p className="text-secondary mb-4" style={{ fontSize: '14px' }}>
              桌號：<strong className="text-dark">{table.name}</strong> 桌
            </p>

            <div className={`status-indicator ${getOrderStatusAlertClass(submittedOrder.status)} mb-4`}>
              目前狀態：{getOrderStatusLabel(submittedOrder.status)}
              {submittedOrder.status === 'PENDING_CONFIRM' && (
                <div className="small fw-normal text-secondary mt-1">
                  請稍候，服務員確認後即會開始製作
                </div>
              )}
              {submittedOrder.status === 'PENDING' && (
                <div className="small fw-normal text-secondary mt-1">
                  訂單已進入廚房，請耐心等候餐點
                </div>
              )}
            </div>

            <div className="bg-light p-3 rounded-3 mb-4 text-start">
              <div className="detail-row">
                <span className="text-muted">訂單編號</span>
                <span className="fw-bold text-dark">{submittedOrder.orderNo}</span>
              </div>
              <div className="detail-row">
                <span className="text-muted">餐點份數</span>
                <span className="fw-semibold text-dark">
                  {submittedOrder.items?.reduce((sum, item) => sum + item.quantity, 0)} 份
                </span>
              </div>
              <div className="detail-row">
                <span className="text-muted">訂單總額</span>
                <span className="fw-bold text-primary">${submittedOrder.totalAmount}</span>
              </div>
            </div>

            <button 
              className="modern-btn w-100 py-3 mb-2"
              onClick={() => setSubmittedOrder(null)}
            >
              繼續加點
            </button>
          </div>
        </div>
      </>
    );
  }

  // Active Menu Products filtered by Category
  const filteredProducts = products.filter(p => p.categoryId === activeCategory);

  return (
    <>
      <div className="customer-layout">
        {/* Header */}
        <div className="mobile-header d-flex justify-content-between align-items-center">
          <div>
            <h4 className="fw-bold mb-0" style={{ fontSize: '20px' }}>{table.name} 桌</h4>
            <small className="text-white-50"><i className="bi bi-people-fill"></i> {table.seats} 人席</small>
          </div>
          <div className="text-white bg-white bg-opacity-10 py-1.5 px-3 rounded-pill" style={{ fontSize: '13px' }}>
            自助點餐系統
          </div>
        </div>

        {/* Category horizontal scrolling tabs */}
        <div className="category-scroll">
          {categories.map(c => (
            <button
              key={c.id}
              className={`category-tab ${activeCategory === c.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Menu list */}
        {loadingMenu ? (
          <div className="d-flex justify-content-center align-items-center py-5">
            <Spinner animation="border" variant="primary" />
          </div>
        ) : (
          <div className="menu-list animate-fade-in">
            {filteredProducts.map(product => (
              <div key={product.id} className="product-item">
                {product.imageUrl && (
                  <img src={product.imageUrl} alt={product.name} className="product-img" />
                )}
                <div className="product-info">
                  <div>
                    <h5 className="product-title">{product.name}</h5>
                    <p className="product-desc">{product.description || '美味現點現做。'}</p>
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="product-price">${product.price}</span>
                    <button className="add-btn" onClick={() => handleProductClick(product)}>
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div className="text-center py-5 text-muted">
                該分類目前沒有供應的商品
              </div>
            )}
          </div>
        )}

        {/* Bottom Cart Drawer Bar */}
        {cart.length > 0 && (
          <div className="cart-drawer-bar animate-fade-in">
            <div className="d-flex align-items-center gap-3" onClick={() => setShowCartDrawer(true)}>
              <div className="cart-badge-container">
                <i className="bi bi-cart3"></i>
                <span className="cart-qty-badge">{calculateTotalItems()}</span>
              </div>
              <span className="cart-total-text">總計 ${calculateTotal()}</span>
            </div>
            <button className="cart-submit-btn" onClick={submitOrder} disabled={submitting}>
              {submitting ? '送單中...' : '確認送單'}
            </button>
          </div>
        )}

        {/* Cart Drawer Details Sheet */}
        {showCartDrawer && (
          <>
            <div className="drawer-overlay" onClick={() => setShowCartDrawer(false)}></div>
            <div className="drawer-sheet animate-fade-in">
              <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
                <h5 className="fw-bold text-dark mb-0"><i className="bi bi-cart3 me-2 text-primary"></i>購物車明細</h5>
                <button className="btn-close" onClick={() => setShowCartDrawer(false)}></button>
              </div>

              <div className="d-flex flex-column">
                {cart.map((item, idx) => (
                  <div key={idx} className="drawer-item">
                    <div style={{ flex: 1, marginRight: '16px' }}>
                      <h6 className="fw-bold text-dark mb-1">{item.product.name}</h6>
                      {item.optionIds && item.optionIds.length > 0 && (
                        <div className="text-muted mb-1" style={{ fontSize: '12px' }}>
                          {getOptionNamesText(item.product, item.optionIds)}
                        </div>
                      )}
                      <div className="d-flex gap-2 align-items-center">
                        <span className="text-primary fw-semibold" style={{ fontSize: '14px' }}>
                          ${item.unitPrice}
                        </span>
                        <button 
                          className="btn btn-link text-muted p-0" 
                          style={{ fontSize: '12px', textDecoration: 'none' }}
                          onClick={() => openNoteModal(idx)}
                        >
                          <i className="bi bi-pencil-square me-0.5"></i> 
                          {item.note ? `備註: ${item.note}` : '加備註'}
                        </button>
                      </div>
                    </div>
                    <div className="qty-controls">
                      <button className="qty-btn" onClick={() => updateQuantity(idx, -1)}>-</button>
                      <span className="fw-bold text-dark">{item.quantity}</span>
                      <button className="qty-btn" onClick={() => updateQuantity(idx, 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Edit Note Modal */}
        <Modal show={showNoteModal} onHide={() => setShowNoteModal(false)} centered size="sm">
          <Modal.Header closeButton className="border-0 pb-0">
            <Modal.Title className="fw-bold" style={{ fontSize: '16px' }}>編輯備註</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <input 
              type="text" 
              className="modern-input" 
              value={itemNote} 
              onChange={e => setItemNote(e.target.value)}
              placeholder="例如：去冰、少油、不要蔥"
              maxLength="50"
            />
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <button className="modern-btn modern-btn-outline py-1.5" onClick={() => setShowNoteModal(false)}>
              取消
            </button>
            <button className="modern-btn py-1.5" onClick={saveNote}>
              確認
            </button>
          </Modal.Footer>
        </Modal>

        {/* Customization Modal (POS-48) */}
        <Modal show={showCustomModal} onHide={() => setShowCustomModal(false)} centered className="custom-modal">
          <Modal.Header closeButton className="border-0 pb-0">
            <Modal.Title className="fw-bold text-dark" style={{ fontSize: '18px' }}>
              {selectedProduct?.name}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="pt-2">
            {(() => {
              const renderModifierGroup = (group, depth = 0) => {
                const selected = selectedOptions[group.id] || [];
                const isInvalid = (group.minSelection && selected.length < group.minSelection) ||
                                  (group.maxSelection && group.maxSelection > 0 && selected.length > group.maxSelection);
                
                return (
                  <div 
                    key={group.id} 
                    className="modifier-group-section mb-3" 
                    style={{ paddingLeft: `${depth * 16}px`, borderLeft: depth > 0 ? '2px dashed #dee2e6' : 'none' }}
                  >
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="fw-bold text-dark mb-0" style={{ fontSize: depth > 0 ? '13px' : '14px' }}>
                        {group.name}
                        <span className="text-muted ms-1" style={{ fontSize: '11px', fontWeight: 'normal' }}>
                          ({group.minSelection === 1 && group.maxSelection === 1 ? '必選 1' : 
                            `選擇 ${group.minSelection || 0}~${group.maxSelection || '無限制'}`})
                        </span>
                      </h6>
                      {isInvalid && (
                        <span className="text-danger" style={{ fontSize: '11px' }}>
                          請符合選擇限制
                        </span>
                      )}
                    </div>
                    <div className="modifier-options-grid">
                      {group.options?.map(opt => {
                        const isChecked = selected.includes(opt.id);
                        const handleSelect = () => {
                          setSelectedOptions(prev => {
                            const currentSelected = prev[group.id] || [];
                            let nextSelected;
                            let deselectedOptions = [];
                            
                            if (group.maxSelection === 1) {
                              deselectedOptions = currentSelected.filter(id => id !== opt.id);
                              nextSelected = [opt.id];
                            } else {
                              if (currentSelected.includes(opt.id)) {
                                deselectedOptions = [opt.id];
                                nextSelected = currentSelected.filter(id => id !== opt.id);
                              } else {
                                if (group.maxSelection && group.maxSelection > 0 && currentSelected.length >= group.maxSelection) {
                                  return prev;
                                }
                                nextSelected = [...currentSelected, opt.id];
                              }
                            }
                            
                            const newSelectedOptions = {
                              ...prev,
                              [group.id]: nextSelected
                            };
                            
                            const clearSubSelections = (optId) => {
                              const optionObj = findOptionInProduct(selectedProduct, optId);
                              if (optionObj) {
                                if (optionObj.bundleItems) {
                                  optionObj.bundleItems.forEach(bi => {
                                    if (bi.modifierGroups) {
                                      bi.modifierGroups.forEach(subG => {
                                        delete newSelectedOptions[subG.id];
                                        if (subG.options) {
                                          subG.options.forEach(subOpt => {
                                            clearSubSelections(subOpt.id);
                                          });
                                        }
                                      });
                                    }
                                  });
                                }
                                if (optionObj.modifierGroups) {
                                  optionObj.modifierGroups.forEach(subG => {
                                    delete newSelectedOptions[subG.id];
                                    if (subG.options) {
                                      subG.options.forEach(subOpt => {
                                        clearSubSelections(subOpt.id);
                                      });
                                    }
                                  });
                                }
                              }
                            };
                            
                            deselectedOptions.forEach(clearSubSelections);
                            
                            const initSubSelections = (optId) => {
                              const optionObj = findOptionInProduct(selectedProduct, optId);
                              if (optionObj) {
                                if (optionObj.bundleItems) {
                                  optionObj.bundleItems.forEach(bi => {
                                    if (bi.modifierGroups) {
                                      bi.modifierGroups.forEach(subG => {
                                        const subDefaults = [];
                                        if (subG.minSelection === 1 && subG.maxSelection === 1 && subG.options && subG.options.length > 0) {
                                          subDefaults.push(subG.options[0].id);
                                        }
                                        newSelectedOptions[subG.id] = subDefaults;
                                        subDefaults.forEach(initSubSelections);
                                      });
                                    }
                                  });
                                }
                                if (optionObj.modifierGroups) {
                                  optionObj.modifierGroups.forEach(subG => {
                                    const subDefaults = [];
                                    if (subG.minSelection === 1 && subG.maxSelection === 1 && subG.options && subG.options.length > 0) {
                                      subDefaults.push(subG.options[0].id);
                                    }
                                    newSelectedOptions[subG.id] = subDefaults;
                                    subDefaults.forEach(initSubSelections);
                                  });
                                }
                              }
                            };
                            
                            if (group.maxSelection === 1) {
                              initSubSelections(opt.id);
                            } else {
                              if (!currentSelected.includes(opt.id)) {
                                initSubSelections(opt.id);
                              }
                            }
                            
                            return newSelectedOptions;
                          });
                        };
                        
                        return (
                          <div key={opt.id} style={{ display: 'contents' }}>
                            <div 
                              className={`modifier-option-card ${isChecked ? 'selected' : ''}`}
                              onClick={handleSelect}
                            >
                              <span className="modifier-option-name">{opt.name}</span>
                              {opt.priceModifier > 0 && (
                                <span className="modifier-option-price">+${opt.priceModifier}</span>
                              )}
                            </div>
                            {isChecked && (
                              <>
                                {opt.bundleItems && opt.bundleItems.length > 0 && (
                                  <div className="modifier-bundle-items-container w-100 mt-2 mb-2" style={{ gridColumn: 'span 2' }}>
                                    {opt.bundleItems.map(bi => (
                                      <div key={bi.id} className="bundle-item-section mb-3 p-3 rounded bg-light border">
                                        <div className="bundle-item-header fw-bold text-dark border-bottom pb-1.5 mb-2 d-flex align-items-center justify-content-between" style={{ fontSize: '13px' }}>
                                          <span><i className="bi bi-tag-fill text-secondary me-1.5"></i>{bi.name}</span>
                                          {(!bi.modifierGroups || bi.modifierGroups.length === 0) && (
                                            <span className="text-muted fw-normal" style={{ fontSize: '11px' }}>此品項無客製化調整</span>
                                          )}
                                        </div>
                                        {bi.modifierGroups && bi.modifierGroups.length > 0 ? (
                                          <div className="bundle-item-groups">
                                            {bi.modifierGroups.map(subGroup => renderModifierGroup(subGroup, depth + 1))}
                                          </div>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {(!opt.bundleItems || opt.bundleItems.length === 0) && opt.modifierGroups && opt.modifierGroups.length > 0 && (
                                  <div className="modifier-nested-groups-container w-100 mt-2 mb-2" style={{ gridColumn: 'span 2' }}>
                                    {opt.modifierGroups.map(subGroup => renderModifierGroup(subGroup, depth + 1))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              };
              return selectedProduct?.modifierGroups?.map(group => renderModifierGroup(group, 0));
            })()}
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0 d-flex justify-content-between align-items-center">
            <span className="fw-bold text-primary" style={{ fontSize: '18px' }}>
              ${selectedProduct ? selectedProduct.price + calculateOptionsPriceSum(selectedProduct, Object.values(selectedOptions).flat()) : 0}
            </span>
            <button 
              className="modern-btn px-4" 
              onClick={() => {
                let isValid = true;
                const activeGroups = getActiveModifierGroups(selectedProduct, selectedOptions);
                activeGroups.forEach(group => {
                  const selected = selectedOptions[group.id] || [];
                  if (group.minSelection && selected.length < group.minSelection) isValid = false;
                  if (group.maxSelection && group.maxSelection > 0 && selected.length > group.maxSelection) isValid = false;
                });
                
                if (!isValid) {
                  alert('請檢查您的客製化選項是否符合選擇數量限制！');
                  return;
                }
                
                const allSelectedOptionIds = Object.values(selectedOptions).flat();
                addCustomizedToCart(selectedProduct, allSelectedOptionIds, '');
                setShowCustomModal(false);
              }}
            >
              加入購物車
            </button>
          </Modal.Footer>
        </Modal>
      </div>
    </>
  );
};

export default CustomerOrder;
