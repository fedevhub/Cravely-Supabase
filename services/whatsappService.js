const sendWhatsAppOrderNotification = async (order) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER;

  if (!phoneNumberId || !accessToken || !adminPhone) {
    return { sent: false, reason: 'WhatsApp Cloud API belum dikonfigurasi' };
  }

  const message = `Pesanan baru ${order.orderNumber} dari ${order.user?.fullname || 'Customer'}. Total Rp ${Number(order.totalAmount).toLocaleString('id-ID')}.`;
  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: adminPhone,
      type: 'text',
      text: { body: message },
    }),
  });

  if (!response.ok) throw new Error(`WhatsApp API error: ${response.status}`);
  return { sent: true };
};

module.exports = { sendWhatsAppOrderNotification };
