const RawMaterial = require('../models/RawMaterialModel');
const Expense = require('../models/ExpenseModel');

exports.getInventory = async (req, res) => {
  const [materials, expenses] = await Promise.all([
    RawMaterial.find().sort({ name: 1 }),
    Expense.find().populate('rawMaterial', 'name unit').sort({ date: -1 }).limit(20),
  ]);
  res.render('admin/inventory', {
    materials,
    expenses,
    pageTitle: 'Inventory',
  });
};

exports.createMaterial = async (req, res) => {
  await RawMaterial.create({
    name: req.body.name,
    unit: req.body.unit,
    stock: Number(req.body.stock || 0),
    minimumStock: Number(req.body.minimumStock || 0),
    unitCost: Number(req.body.unitCost || 0),
    supplier: req.body.supplier,
    notes: req.body.notes,
  });
  res.redirect('/dashboard/inventory');
};

exports.createExpense = async (req, res) => {
  const amount = Number(req.body.amount || 0);
  const rawMaterial = req.body.rawMaterial || null;
  await Expense.create({
    type: req.body.type,
    description: req.body.description,
    amount,
    date: req.body.date || new Date(),
    rawMaterial,
    createdBy: req.session.user?.id || null,
  });
  if (rawMaterial) {
    await RawMaterial.findByIdAndUpdate(rawMaterial, {
      $inc: { stock: Number(req.body.quantity || 0) },
    });
  }
  res.redirect('/dashboard/inventory');
};

exports.updateMaterial = async (req, res) => {
  await RawMaterial.findByIdAndUpdate(
    req.params.id,
    {
      name: req.body.name,
      unit: req.body.unit,
      stock: Number(req.body.stock || 0),
      minimumStock: Number(req.body.minimumStock || 0),
      unitCost: Number(req.body.unitCost || 0),
      supplier: req.body.supplier,
    },
    { runValidators: true },
  );
  res.redirect('/dashboard/inventory');
};
