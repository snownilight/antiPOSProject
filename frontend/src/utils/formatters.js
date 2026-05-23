/**
 * 前端通用格式化工具
 */

/**
 * 格式化訂單的客製化與套餐選項 (POS-48)
 * @param {Array} options - 訂單品項選項列表 (OrderItemOption)
 * @returns {string} 格式化後的文字描述
 */
export const formatOrderOptions = (options) => {
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

/**
 * 格式化時間戳記為台北時間字串
 * @param {string} value - ISO 時間字串
 * @returns {string} 格式化後的時間與日期描述
 */
export const formatTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit'
  }) + ` (${date.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })})`;
};
