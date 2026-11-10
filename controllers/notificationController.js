const Notification = require('../models/NotificationModel');
const Order = require('../models/OrderModel');

exports.getNotifications = async (req, res) => {
  const notifications = await Notification.find({
    recipientRole: req.session.user.role,
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  if (req.session.user.role === 'admin') {
    const orders = await Order.find()
      .populate('user', 'fullname')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    notifications.push(
      ...orders.map((order) => ({
        _id: `order-${order._id}`,
        type: 'order',
        title: 'Pesanan baru masuk',
        message: `${order.orderNumber || order._id} dari ${order.user?.fullname || 'Customer'} · ${order.status}`,
        link: '/dashboard/orders',
        createdAt: order.createdAt,
        readAt: null,
      })),
    );
    notifications.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  }
  res.render('shared/notifications', {
    notifications,
    isAdmin: req.session.user.role === 'admin',
  });
};

exports.readAll = async (req, res) => {
  await Notification.updateMany(
    { recipientRole: req.session.user.role, readAt: null },
    { $set: { readAt: new Date() } },
  );
  res.redirect('/notifications');
};
