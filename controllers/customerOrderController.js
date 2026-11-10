const Cart = require('../models/CartModel');
const Wishlist = require('../models/WishlistModel');
const Product = require('../models/ProductModel');
const Order = require('../models/OrderModel');
const Payment = require('../models/PaymentModel');
const Notification = require('../models/NotificationModel');
const User = require('../models/UserModel');
const PreOrderSetting = require('../models/PreOrderSettingModel');
const { sendWhatsAppOrderNotification } = require('../services/whatsappService');

const userId = (req) => req.session.user.id;
const getCart = (id) => Cart.findOne({ user: id }).populate('items.product');
const requireOpen = async () => {
  const setting = await PreOrderSetting.findOne({ key: 'current' }).lean();
  return setting?.isOpen ?? true;
};

exports.getCart = async (req, res) => {
  const cart = await getCart(userId(req));
  const items = cart?.items || [];
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  res.render('customer/cart', {
    cart: items,
    subtotal,
    shipping: subtotal ? 20000 : 0,
    total: subtotal + (subtotal ? 20000 : 0),
    isPreOrderOpen: await requireOpen(),
  });
};

exports.addToCart = async (req, res) => {
  if (!(await requireOpen())) return res.status(409).send('Pre-order sedang ditutup');
  const product = await Product.findById(req.params.productId);
  if (!product) return res.status(404).send('Produk tidak ditemukan');
  const cart = await Cart.findOneAndUpdate(
    { user: userId(req) },
    { $setOnInsert: { user: userId(req) } },
    { upsert: true, returnDocument: 'after' },
  );
  const existing = cart.items.find((item) => item.product.toString() === product._id.toString());
  if (existing) existing.quantity = Math.min(5, existing.quantity + Number(req.body.quantity || 1));
  else
    cart.items.push({
      product: product._id,
      quantity: Math.min(5, Number(req.body.quantity || 1)),
    });
  await cart.save();
  res.redirect(req.get('referer') || '/customer/cart');
};

exports.updateCart = async (req, res) => {
  const cart = await Cart.findOne({ user: userId(req) });
  const item = cart?.items.find((entry) => entry.product.toString() === req.params.productId);
  if (item) item.quantity = Math.max(1, Math.min(5, Number(req.body.quantity || 1)));
  if (cart) await cart.save();
  res.redirect('/customer/cart');
};

exports.removeFromCart = async (req, res) => {
  await Cart.findOneAndUpdate(
    { user: userId(req) },
    { $pull: { items: { product: req.params.productId } } },
  );
  res.redirect('/customer/cart');
};

exports.getCheckout = async (req, res) => {
  const cart = await getCart(userId(req));
  const items = cart?.items || [];
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const user = await User.findById(userId(req));
  res.render('customer/checkout', {
    cart: items,
    user,
    subtotal,
    shipping: subtotal ? 20000 : 0,
    total: subtotal + (subtotal ? 20000 : 0),
    step: 'shipping',
  });
};

exports.createOrder = async (req, res) => {
  if (!(await requireOpen())) return res.status(409).send('Pre-order sedang ditutup');
  const cart = await getCart(userId(req));
  if (!cart?.items.length) return res.redirect('/customer/cart');
  const items = cart.items.map((item) => ({
    product: item.product._id,
    quantity: item.quantity,
    price: item.product.price,
  }));
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const order = await Order.create({
    orderNumber: `CRV-${Date.now()}`,
    user: userId(req),
    items,
    totalAmount: subtotal + 20000,
    paymentMethod: req.body.paymentMethod || 'Transfer',
    shippingAddress: req.body.shippingAddress || req.body.address,
    customerNote: req.body.customerNote || '',
    status: 'Waiting Payment',
  });

  // Kurangi stok produk sesuai jumlah yang dipesan (terhubung ke Supabase)
  await Promise.all(
    items.map((item) =>
      Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } }),
    ),
  );
  await Cart.findOneAndUpdate({ user: userId(req) }, { $set: { items: [] } });

  req.session.flash = {
    type: 'success',
    title: 'Pesanan dibuat',
    message: `Pesanan ${order.orderNumber} berhasil dibuat. Struk bisa dilihat di halaman pembayaran atau riwayat pesanan.`,
  };
  await Notification.create({
    recipientRole: 'admin',
    type: 'order',
    title: 'Pesanan baru masuk',
    message: `${order.orderNumber} menunggu diproses.`,
    link: `/dashboard/orders`,
  });
  try {
    await sendWhatsAppOrderNotification(await order.populate('user', 'fullname'));
  } catch (error) {
    console.error('WhatsApp notification failed:', error.message);
  }
  res.redirect(`/customer/payment/${order._id}`);
};

exports.getPayment = async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.orderId,
    user: userId(req),
  }).populate('items.product', 'name image');
  if (!order) return res.status(404).send('Order tidak ditemukan');
  res.render('customer/payment', { order });
};

exports.getHistory = async (req, res) => {
  const orders = await Order.find({ user: userId(req) })
    .populate('items.product', 'name image')
    .sort({ createdAt: -1 });
  res.render('customer/history', { orders });
};

exports.getTracking = async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.orderId,
    user: userId(req),
  }).populate('items.product', 'name image');
  if (!order) return res.status(404).send('Order tidak ditemukan');
  res.render('customer/tracking', { order });
};

exports.getReceipt = async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.orderId,
    user: userId(req),
  })
    .populate('items.product', 'name')
    .populate('user', 'fullname email');
  if (!order) return res.status(404).send('Order tidak ditemukan');
  res.render('shared/receipt', { order });
};

exports.getWishlist = async (req, res) => {
  const wishlist = await Wishlist.findOne({ user: userId(req) }).populate('products');
  res.render('customer/wishlist', {
    products: wishlist?.products || [],
    isPreOrderOpen: await requireOpen(),
  });
};

exports.toggleWishlist = async (req, res) => {
  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId(req) },
    { $setOnInsert: { user: userId(req) } },
    { upsert: true, returnDocument: 'after' },
  );
  const index = wishlist.products.findIndex((id) => id.toString() === req.params.productId);
  if (index === -1) wishlist.products.push(req.params.productId);
  else wishlist.products.splice(index, 1);
  await wishlist.save();
  res.redirect(req.get('referer') || '/customer/wishlist');
};
