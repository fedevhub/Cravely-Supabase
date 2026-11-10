const Product = require('../models/ProductModel');
const fs = require('fs');
const path = require('path');

const productController = {
  getDaftarProduct: async (req, res) => {
    try {
      const products = await Product.find();

      const totalProducts = await Product.countDocuments();
      const sweetCount = await Product.countDocuments({ category: 'sweet' });
      const savoryCount = await Product.countDocuments({ category: 'savory' });

      res.render('admin/products', {
        products,
        editProduct: null,
        pageTitle: 'Manajemen Produk',
        productLength: totalProducts,
        productCountSweet: sweetCount,
        productCountSavory: savoryCount,
      });
    } catch (error) {
      console.error('Error getDaftarProduct:', error);
      res.status(500).send('Gagal ambil data');
    }
  },

  getTambahProduct: async (req, res) => {
    try {
      const product = await Product.find();
      res.render('admin/products', {
        product,
        pageTitle: 'Manajemen Produk',
      });
    } catch (err) {
      console.error('Error getTambahProduct:', err);
      res.status(500).send('Gagal memuat form tambah produk');
    }
  },

  tambahProduct: async (req, res) => {
    try {
      const image = req.file ? req.file.filename : null;
      const { name, category, description, price, isActive } = req.body;

      await Product.create({
        name,
        category,
        description: description || null,
        price: price || null,
        isActive: isActive || null,
        image: image,
        stock: Number(req.body.stock) || 0,
        discount: Number(req.body.discount) || 0,
        isBestSeller: req.body.bestSeller === 'on' || req.body.bestSeller === 'true',
      });

      req.session.flash = {
        type: 'success',
        title: 'Product Created',
        message: 'The product has been created successfully.',
        icon: 'fa-box-open',
      };

      res.redirect('/dashboard/products');
    } catch (err) {
      console.error('Error tambahProduct:', err);
      res.status(500).send('Gagal tambah produk: ' + err.message);
    }
  },

  getEditProduct: async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      const products = await Product.find();

      if (!product) {
        return res.status(404).send('Data produk tidak ditemukan');
      }

      res.render('admin/products', {
        products,
        editProduct: product,
        pageTitle: 'Manajemen Produk',
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Gagal memuat form edit');
    }
  },

  updateProduct: async (req, res) => {
    try {
      const image = req.file ? req.file.filename : null;

      const existingProduct = await Product.findById(req.params.id);
      if (!existingProduct) {
        return res.status(404).send('Data tidak ditemukan');
      }

      const data = {
        name: req.body.name ?? existingProduct.name,
        category: req.body.category ?? existingProduct.category,
        description: req.body.description ?? existingProduct.description,
        price: req.body.price ?? existingProduct.price,
        image: req.body.image ?? existingProduct.image,
        isActive: req.body.isActive ?? existingProduct.isActive,
        stock:
          req.body.stock !== undefined && req.body.stock !== ''
            ? Number(req.body.stock)
            : existingProduct.stock,
        discount:
          req.body.discount !== undefined && req.body.discount !== ''
            ? Number(req.body.discount)
            : existingProduct.discount,
        isBestSeller: req.body.bestSeller === 'on' || req.body.bestSeller === 'true',
      };

      if (image) {
        if (existingProduct.image) {
          const imgPath = path.join(__dirname, '../public/img', existingProduct.image);
          if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        }
        data.image = image;
      }

      await Product.findByIdAndUpdate(req.params.id, data, {
        returnDocument: 'after',
        runValidators: true,
      });

      req.session.flash = {
        type: 'success',
        title: 'Product Updated',
        message: 'The product has been updated successfully.',
        icon: 'fa-box-open',
      };

      res.redirect('/dashboard/products');
    } catch (err) {
      console.error('Error updateProduct:', err);
      res.status(500).send('Gagal update: ' + err.message);
    }
  },

  deleteProduct: async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);

      if (!product) {
        return res.status(404).send('Produk tidak ditemukan');
      }

      if (product.image) {
        const imgPath = path.join(__dirname, '../public/img', product.image);

        if (fs.existsSync(imgPath)) {
          fs.unlinkSync(imgPath);
        }
      }

      await Product.findByIdAndDelete(req.params.id);

      req.session.flash = {
        type: 'success',
        title: 'Product Deleted',
        message: 'The product has been deleted successfully.',
        icon: 'fa-box-trash',
      };

      res.redirect('/dashboard/products');
    } catch (err) {
      console.error('Error deleteProduct:', err);
      res.status(500).send('Gagal hapus produk');
    }
  },

  // ---------------- DETAIL PRODUCT HANDLERS ----------------

  // 1. Get Detail Produk Page
  getDetailProduct: async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).send('Produk tidak ditemukan');
      }

      res.render('admin/product-detail', {
        product,
        pageTitle: 'Detail Produk',
      });
    } catch (error) {
      console.error('Error getDetailProduct:', error);
      res.status(500).send('Gagal memuat detail produk');
    }
  },

  // 2. Update Detail Produk
  updateDetailProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        price,
        category,
        isActive,
        description,
        fullDescription,
        weight,
        servings,
        ingredients,
        gallery,
      } = req.body;

      const ingredientsArray =
        typeof ingredients === 'string'
          ? ingredients
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          : [];

      // Jika upload multiple file galeri dari multer (req.files)
      let galleryArray = [];
      if (req.files && req.files.length > 0) {
        galleryArray = req.files.map((file) => file.filename);
      } else if (typeof gallery === 'string') {
        galleryArray = gallery
          .split(',')
          .map((url) => url.trim())
          .filter(Boolean);
      }

      const existingProduct = await Product.findById(id);
      if (!existingProduct) {
        return res.status(404).send('Produk tidak ditemukan');
      }

      await Product.findByIdAndUpdate(
        id,
        {
          name: name ?? existingProduct.name,
          price: price === undefined ? existingProduct.price : Number(price),
          category: category ?? existingProduct.category,
          isActive: isActive || existingProduct.isActive,
          description: description ?? existingProduct.description,
          detail: {
            gallery: galleryArray.length ? galleryArray : existingProduct.detail?.gallery || [],
            fullDescription: fullDescription ?? (existingProduct.detail?.fullDescription || ''),
            weight: weight ?? (existingProduct.detail?.weight || ''),
            servings: servings ?? (existingProduct.detail?.servings || ''),
            ingredients: ingredientsArray.length
              ? ingredientsArray
              : existingProduct.detail?.ingredients || [],
          },
        },
        { returnDocument: 'after', runValidators: true },
      );

      res.redirect(`/dashboard/detailProducts/${id}`);
    } catch (error) {
      console.error('Error updateDetailProduct:', error);
      res.status(500).send('Gagal memperbarui detail produk');
    }
  },

  // Dummy Handler pelengkap route
  deleteDetailImage: async (req, res) => {
    res.redirect(`/dashboard/detailProducts/${req.params.id}`);
  },

  deleteDetailProduct: async (req, res) => {
    res.redirect(`/dashboard/products`);
  },

  addDetailProduct: async (req, res) => {
    res.redirect(`/dashboard/detailProducts/${req.params.id}`);
  },
};

module.exports = productController;
