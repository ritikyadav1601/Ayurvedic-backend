import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  fullDescription: { type: String, default: "" },
  images: [{ type: String }],
  price: { type: Number, required: true },
  originalPrice: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  inStock: { type: Boolean, default: true },
  ingredients: [{ type: String, default: [] }],
  benefits: [{ type: String, default: [] }],
  howToUse: [{ type: String, default: [] }],
  specifications: { type: Map, of: String, default: {} },
  stock: { type: Number, default: 0 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });


export default mongoose.model('Product', productSchema);


