const Order = require('../models/OrderModel');
const Expense = require('../models/ExpenseModel');
const RawMaterial = require('../models/RawMaterialModel');
const User = require('../models/UserModel');

exports.getAnalytics = async (req, res) => {
  const [orders, expenses, materials, totalCustomers] = await Promise.all([
    Order.find().sort({ createdAt: -1 }),
    Expense.find().sort({ date: -1 }),
    RawMaterial.find(),
    User.countDocuments({ role: 'customer' }),
  ]);
  const revenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const expensesTotal = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  const materialValue = materials.reduce(
    (sum, material) => sum + material.stock * material.unitCost,
    0,
  );
  const capitalExpenses = expenses
    .filter((expense) => expense.type === 'capital')
    .reduce((sum, expense) => sum + expense.amount, 0);
  const materialExpenses = expenses
    .filter((expense) => expense.type === 'material')
    .reduce((sum, expense) => sum + expense.amount, 0);
  const operationalExpenses = expenses
    .filter((expense) => expense.type === 'operational')
    .reduce((sum, expense) => sum + expense.amount, 0);
  res.render('admin/analytics', {
    pageTitle: 'Financial Analytics',
    metrics: {
      revenue,
      expensesTotal,
      materialValue,
      capitalExpenses,
      materialExpenses,
      operationalExpenses,
      profit: revenue - expensesTotal,
      totalCustomers,
      totalOrders: orders.length,
    },
    expenses: expenses.slice(0, 10),
  });
};
