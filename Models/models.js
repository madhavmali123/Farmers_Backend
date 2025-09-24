const mongoose = require('mongoose');

// User Schema (Farmer / Buyer)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  type: { type: String, enum: ['farmer', 'buyer'], required: true }, // user role
}, { timestamps: true });

// Product Schema (linked to farmer)
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  quantity: { type: Number, default: 1 },
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // relation
  image: { type: String } // ✅ store image path/URL
}, { timestamps: true });

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  products: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",   // must match your Product model name
        required: true,
      },
      quantity: {
        type: Number,
        default: 1,
      }
    }
  ]
}, { timestamps: true });



// Export models
const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Cart = mongoose.model("Cart", cartSchema);

module.exports = { User, Product, Cart };
