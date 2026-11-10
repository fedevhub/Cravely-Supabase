const Payment = require('../models/PaymentModel');
const Order = require('../models/OrderModel');

// ============================
// GET ALL PAYMENTS (Admin)
// ============================
exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('user', 'fullname email')
      .populate('order')
      .sort({ createdAt: -1 });

    res.render('admin/payments', {
      title: 'Payment Management',
      payments,
    });
  } catch (error) {
    console.error('Error retrieving payments:', error);
    res.status(500).json({
      message: 'Error retrieving payments',
      error: error.message,
    });
  }
};

// ============================
// GET PAYMENT DETAIL (Admin)
// ============================
exports.getPaymentDetail = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate('user').populate('order');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    res.render('admin/paymentDetail', {
      title: 'Payment Detail',
      payment,
    });
  } catch (error) {
    console.error('Error retrieving payment detail:', error);
    res.status(500).json({
      message: 'Error retrieving payment detail',
      error: error.message,
    });
  }
};

// ============================
// CREATE PAYMENT (Customer)
// Dipanggil saat customer submit bukti transfer.
// Kalau upload file pakai multer, pastikan route-nya
// pakai middleware upload.single("paymentProof") SEBELUM
// controller ini, supaya req.file terisi.
// ============================
exports.createPayment = async (req, res) => {
  try {
    const { orderId, paymentMethod } = req.body;

    if (!orderId) {
      req.session.flash = {
        type: 'error',
        title: 'Gagal',
        message: 'Order ID tidak ditemukan.',
        icon: 'fa-triangle-exclamation',
      };
      return res.redirect('back');
    }

    // Ambil order asli dari database — jangan pernah percaya
    // angka totalAmount dari form/client.
    const order = await Order.findOne({
      _id: orderId,
      user: req.session.user.id,
    });

    if (!order) {
      req.session.flash = {
        type: 'error',
        title: 'Gagal',
        message: 'Order tidak ditemukan.',
        icon: 'fa-triangle-exclamation',
      };
      return res.redirect('back');
    }

    // Cegah double payment untuk order yang sama
    const existingPayment = await Payment.findOne({ order: order._id });
    if (existingPayment) {
      req.session.flash = {
        type: 'error',
        title: 'Gagal',
        message: 'Payment untuk order ini sudah pernah dibuat.',
        icon: 'fa-triangle-exclamation',
      };
      return res.redirect('back');
    }

    const paymentNumber = 'PAY-' + Date.now();

    const payment = await Payment.create({
      paymentNumber,
      order: order._id,
      user: order.user,
      paymentMethod: paymentMethod || order.paymentMethod || 'Transfer',
      totalAmount: order.totalAmount, // <-- ambil dari Order
      paymentDate: new Date(), // <-- waktu submit
      paymentProof: req.file ? req.file.filename : null,
      status: 'Waiting Payment',
    });

    // update status order jadi menunggu verifikasi
    order.status = 'Waiting Payment';
    await order.save();

    req.session.flash = {
      type: 'success',
      title: 'Payment Submitted',
      message: 'Bukti pembayaran berhasil dikirim, menunggu verifikasi.',
      icon: 'fa-money-bill-transfer',
    };

    res.redirect('/customer/tracking/' + order._id);
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({
      message: 'Error creating payment',
      error: error.message,
    });
  }
};

// ============================
// UPDATE PAYMENT STATUS (Admin)
// ============================
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatus = ['Waiting Payment', 'Payment Verification', 'Confirmed', 'Rejected'];

    if (!allowedStatus.includes(status)) {
      req.session.flash = {
        type: 'error',
        title: 'Gagal',
        message: 'Status tidak valid.',
        icon: 'fa-triangle-exclamation',
      };
      return res.redirect('/dashboard/payments');
    }

    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { status },
      { returnDocument: 'after', runValidators: true },
    ).populate('order');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // sinkronkan status Order kalau ada relasinya
    if (payment.order) {
      if (status === 'Confirmed') {
        payment.order.status = 'Confirmed';
      } else if (status === 'Rejected') {
        payment.order.status = 'Rejected';
      } else if (status === 'Payment Verification') {
        payment.order.status = 'Payment Verification';
      }
      await payment.order.save();
    }

    req.session.flash = {
      type: 'success',
      title: 'Payment Updated',
      message: 'Payment status has been updated successfully.',
      icon: 'fa-money-bill-transfer',
    };

    res.redirect('/dashboard/payments');
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({
      message: 'Error updating payment status',
      error: error.message,
    });
  }
};

// ============================
// DELETE PAYMENT (Admin)
// ============================
exports.deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    req.session.flash = {
      type: 'success',
      title: 'Payment Deleted',
      message: 'Payment has been deleted successfully.',
      icon: 'fa-trash',
    };

    res.redirect('/dashboard/payments');
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({
      message: 'Error deleting payment',
      error: error.message,
    });
  }
};
