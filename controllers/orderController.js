const Order = require('../models/OrderModel');
const Product = require('../models/ProductModel');
const User = require('../models/UserModel');

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'fullname email')
      .populate('items.product', 'name')
      .sort({ createdAt: -1 });

    res.render('admin/orders', {
      title: 'Orders Management',
      orders,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving orders', error });
  }
};

exports.getOrderDetail = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user').populate('items.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.render('admin/orderDetail', {
      title: 'Order Detail',
      order,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error retrieving order detail', error });
  }
};

exports.getReceipt = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'fullname email')
      .populate('items.product', 'name');

    if (!order) {
      return res.status(404).send('Order tidak ditemukan');
    }

    res.render('shared/receipt', {
      order,
      isAdmin: true,
    });
  } catch (error) {
    console.error('Error getReceipt:', error);
    res.status(500).send('Gagal memuat struk');
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, {
      status,
    });

    res.redirect('/dashboard/orders');
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error updating order status', error });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.redirect('/admin/orders');
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error deleting order', error });
  }
};

exports.createDummyOrder = async (req, res) => {
  try {
    const user = await User.findOne({
      role: 'customer',
    });

    if (!user) {
      return res.status(404).json({ message: 'No customer user found' });
    }

    const products = await Product.find().limit(3);

    if (products.length === 0) {
      return res.send('Belum ada produk.');
    }

    let items = [];
    let total = 0;

    products.forEach((product, index) => {
      const qty = index + 1;

      items.push({
        product: product._id,
        quantity: qty,
        price: product.price,
      });

      total += product.price * qty;
    });

    const orderNumber = 'CRV-' + Date.now();

    await Order.create({
      orderNumber,
      user: user._id,
      items,
      totalAmount: total,
      paymentMethod: 'Transfer',
      paymentProof: null,
      customerNote: 'This is a dummy order for testing purposes.',
      shippingAddress: user.address,
      status: 'Waiting Payment',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating dummy order', error });
  }
};
