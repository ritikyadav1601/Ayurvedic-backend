import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  fullDescription: { type: String },
  images: [{ type: String }],
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  discount: { type: Number },
  rating: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  inStock: { type: Boolean, default: true },
  ingredients: [{ type: String }],
  benefits: [{ type: String }],
  howToUse: [{ type: String }],
  specifications: { type: Map, of: String },
  stock: { type: Number, default: 0 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('Product', productSchema);


