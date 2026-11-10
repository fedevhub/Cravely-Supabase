const Review = require('../models/ReviewModel');

exports.getReviews = async (req, res) => {
  const reviews = await Review.find()
    .populate('user', 'fullname email')
    .populate('product', 'name image')
    .sort({ createdAt: -1 });
  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;
  res.render('admin/reviews', {
    pageTitle: 'Customer Reviews',
    reviews,
    average,
  });
};

exports.toggleReview = async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (review) {
    review.status = review.status === 'published' ? 'hidden' : 'published';
    await review.save();
  }
  res.redirect('/dashboard/reviews');
};
