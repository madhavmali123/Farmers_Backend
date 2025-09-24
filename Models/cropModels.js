const mongoose = require('mongoose');

const CropSchema = new mongoose.Schema({
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  cropName: { type: String, required: true },
  seedingDate: { type: Date, required: true },

  fertilizers: [{ name: String, cost: Number, dateApplied: Date }],
  pesticides: [{ name: String, cost: Number, dateApplied: Date }],
  irrigation: [{ method: String, cost: Number, date: Date }],
  otherExpenses: [{ description: String, cost: Number }],

  // ✅ custom entries (flexible expenses)
  customEntries: [
    {
      type: { type: String },  // farmer decides the category
      description: String,
      cost: Number,
      date: Date
    }
  ],

  harvestDate: { type: Date },
  yieldQuantity: { type: Number },
  sellingPricePerUnit: { type: Number },

  createdAt: { type: Date, default: Date.now }

});

const Crop = mongoose.model('Crop', CropSchema);

module.exports = { Crop };