const createModel = require('./baseModel');

module.exports = createModel({
  name: 'Product',
  table: 'products',
  afterLoad(doc) {
    // Sama seperti sebelumnya: detail.gallery & detail.ingredients selalu array
    if ('detail' in doc) {
      doc.detail = { gallery: [], ingredients: [], ...(doc.detail || {}) };
    }
  },
});
