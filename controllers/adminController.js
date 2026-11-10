const Order = require('../models/OrderModel');
const Payment = require('../models/PaymentModel');
const Product = require('../models/ProductModel');
const User = require('../models/UserModel');
const PreOrderSetting = require('../models/PreOrderSettingModel');

const statusConfig = [
  { status: 'Waiting Payment', color: '#d5a34a' },
  { status: 'Confirmed', color: '#7fa27f' },
  { status: 'In Production', color: '#c9803b' },
  { status: 'Delivered', color: '#3d9381' },
  { status: 'Completed', color: '#477c50' },
  { status: 'Rejected', color: '#d95d5d' },
];

const monthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const formatShortCurrency = (value) => {
  if (value >= 1000000) {
    return `Rp ${(value / 1000000).toFixed(value >= 10000000 ? 1 : 2)}M`;
  }

  if (value >= 1000) {
    return `Rp ${(value / 1000).toFixed(0)}K`;
  }

  return `Rp ${value.toLocaleString('id-ID')}`;
};

const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'CU';
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
};

exports.getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [orders, payments, activeCustomers, products, preOrderSetting] = await Promise.all([
      Order.find()
        .populate('user', 'fullname email')
        .populate('items.product', 'name category')
        .sort({ createdAt: -1 }),
      Payment.find().sort({ createdAt: -1 }),
      User.countDocuments({ role: 'customer' }),
      Product.find().sort({ createdAt: -1 }),
      PreOrderSetting.findOneAndUpdate(
        { key: 'current' },
        { $setOnInsert: { isOpen: true } },
        { returnDocument: 'after', upsert: true },
      ),
    ]);

    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const pendingPayments = payments.filter((payment) =>
      ['Waiting Payment', 'Payment Verification'].includes(payment.status),
    ).length;

    const recentOrders = orders.slice(0, 5).map((order) => ({
      id: order._id,
      orderNumber: order.orderNumber || `CRV-${order._id.toString().slice(-6).toUpperCase()}`,
      customerName: order.user?.fullname || 'Customer',
      initials: getInitials(order.user?.fullname || 'Customer'),
      itemCount: order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0,
      totalAmount: order.totalAmount || 0,
      status: order.status || 'Waiting Payment',
    }));

    const revenueMonths = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);

      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: monthNames[date.getMonth()],
        sweet: 0,
        savory: 0,
      };
    });

    const monthMap = new Map(revenueMonths.map((month) => [month.key, month]));
    const productDemand = new Map();

    orders.forEach((order) => {
      const orderDate = new Date(order.createdAt);
      const month = monthMap.get(`${orderDate.getFullYear()}-${orderDate.getMonth()}`);

      if (!month || orderDate < sixMonthsAgo) {
        return;
      }

      (order.items || []).forEach((item) => {
        const product = item.product;
        const category = product?.category;
        const quantity = item.quantity || 0;
        const lineTotal = (item.price || 0) * quantity;

        if (category === 'sweet' || category === 'savory') {
          month[category] += lineTotal;
        }

        if (product?._id) {
          const productId = product._id.toString();
          const current = productDemand.get(productId) || 0;
          productDemand.set(productId, current + quantity);
        }
      });
    });

    const maxRevenue = Math.max(
      1,
      ...revenueMonths.flatMap((month) => [month.sweet, month.savory]),
    );

    const statusCounts = statusConfig.map((item) => ({
      status: item.status,
      color: item.color,
      count: orders.filter((order) => order.status === item.status).length,
    }));

    const donutTotal = statusCounts.reduce((sum, item) => sum + item.count, 0) || 1;
    let donutStart = 0;
    const donutSegments = statusCounts.map((item) => {
      const degrees = (item.count / donutTotal) * 360;
      const segment = `${item.color} ${donutStart}deg ${donutStart + degrees}deg`;
      donutStart += degrees;
      return segment;
    });

    const lowStockAlerts = products.slice(0, 4).map((product, index) => {
      const sold = productDemand.get(product._id.toString()) || 0;
      const capacity = product.category === 'sweet' ? 20 : 25;
      const remaining = Math.max(0, capacity - sold);

      return {
        name: product.name,
        current: Math.max(1, Math.min(capacity - 1, remaining || index + 3)),
        max: capacity,
        level: remaining <= 5 ? 'danger' : 'warning',
      };
    });

    res.render('admin/dashboard', {
      pageTitle: 'Dashboard Admin',
      batchLabel: `Batch #12 - ${now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`,
      stats: {
        totalRevenue,
        totalOrders: orders.length,
        activeCustomers,
        pendingPayments,
      },
      recentOrders,
      lowStockAlerts,
      revenueMonths,
      maxRevenue,
      statusCounts,
      donutGradient: donutSegments.join(', '),
      formatShortCurrency,
      isPreOrderOpen: preOrderSetting.isOpen,
    });
  } catch (error) {
    console.error('Error getDashboard:', error);
    res.status(500).send('Gagal memuat dashboard admin');
  }
};

exports.togglePreOrder = async (req, res) => {
  try {
    const currentSetting = await PreOrderSetting.findOne({ key: 'current' });
    const setting = currentSetting
      ? await PreOrderSetting.findOneAndUpdate(
          { key: 'current' },
          {
            isOpen: !currentSetting.isOpen,
            updatedBy: req.session.user?.id || null,
          },
          { returnDocument: 'after' },
        )
      : await PreOrderSetting.create({
          key: 'current',
          isOpen: false,
          updatedBy: req.session.user?.id || null,
        });

    req.session.flash = {
      type: 'success',
      title: setting.isOpen ? 'Pre-order dibuka' : 'Pre-order ditutup',
      message: setting.isOpen
        ? 'Customer sekarang dapat melakukan pemesanan.'
        : 'Customer tidak dapat melakukan pemesanan sampai pre-order dibuka kembali.',
    };

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error togglePreOrder:', error);
    res.status(500).send('Gagal mengubah status pre-order');
  }
};
