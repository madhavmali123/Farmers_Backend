const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { User, Product, Cart } = require("./Models/models");
const { Crop } = require("./Models/cropModels");

const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");


const path = require("path");
const fs = require("fs");
const Razorpay = require("razorpay");

const dotenv = require("dotenv");
dotenv.config();





const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

const razorpay = new Razorpay({
  key_id: process.env.key_id,
  key_secret: process.env.key_secret,
});
//app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // serve static files
//app.use("/uploads", express.static("uploads"));

// app.use(cors());

app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
// connect to MongoDB
mongoose.connect(process.env.mongo_uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));


// storage config
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "uploads/"); // folder where images will be stored
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + path.extname(file.originalname)); // unique file name
//   },
// });

// const upload = multer({ storage });

cloudinary.config({
  secure: true,
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// console.log("🔹 Cloudinary Config:", {
//   name: process.env.CLOUDINARY_NAME,
//   key: process.env.CLOUDINARY_API_KEY ? "✅ Loaded" : "❌ Missing",
//   secret: process.env.CLOUDINARY_API_SECRET ? "✅ Loaded" : "❌ Missing"
// });


const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "farmers-market", // folder in Cloudinary
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const upload = multer({ storage });


// ✅ Create Razorpay Order
app.post("/api/payment/create-order", async (req, res) => {
  try {
    const { amount } = req.body; // amount in INR (frontend will send)

    const options = {
      amount: amount * 100, // Razorpay accepts in paise (₹1 = 100 paise)
      currency: "INR",
      receipt: "order_rcptid_" + Date.now(),
    };

    const order = await razorpay.orders.create(options);

    res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("❌ Error creating order:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


// ✅ Cloudinary uploader function (you wanted this)
const uploadImage = async (imagePath) => {
  const options = {
    use_filename: true,
    unique_filename: false,
    overwrite: true,
  };

  try {
    const result = await cloudinary.uploader.upload(imagePath, options);
    //console.log("✅ Uploaded to Cloudinary:", result.secure_url);
    return result.secure_url;
  } catch (error) {
    console.error("❌ Cloudinary Upload Error:", error);
    throw error;
  }
};
// put this once in server.js (remove other duplicate definitions)
app.post("/api/products/add", upload.single("image"), async (req, res) => {
  try {
    // Basic debug logs
    // console.log("➡️ /api/products/add - body:", req.body);
    // console.log("➡️ /api/products/add - file:", req.file);

    const { name, description, price, quantity, farmerId } = req.body;
    if (!name || !price || !farmerId) {
      return res.status(400).json({ message: "Name, price, and farmerId are required" });
    }

    const farmer = await User.findById(farmerId);
    if (!farmer || farmer.type !== "farmer") {
      return res.status(400).json({ message: "Invalid farmer ID or user is not a farmer" });
    }

    // get Cloudinary url robustly (different storage libs use different fields)
    const imageUrl =
      (req.file && (req.file.path || req.file.secure_url || req.file.url)) ||
      null;

    const newProduct = new Product({
      name,
      description,
      price,
      quantity,
      farmer: farmerId,
      image: imageUrl,
    });

    await newProduct.save();
    console.log("Image file:", imageUrl);

    return res.status(201).json({ message: "Product added successfully", product: newProduct });
  } catch (err) {
    console.error("🔥 /api/products/add error:", err);
    return res
      .status(500)
      .json({ message: "Server error while adding product", error: err.message, stack: err.stack });
  }

});

//Register API
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password, type } = req.body;

    if (!name || !email || !password || !type) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "User already exists" });
    }

    // create user
    const user = new User({ name, email, password, type });
    await user.save();

    res.status(201).json({ message: "User registered successfully", user });
  } catch (error) {
    console.error("❌ Register error:", error);
    res.status(500).json({ message: "Server error" });
  }
});


app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // check password (plain text for now – later use bcrypt for security)
    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // login successful
    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        type: user.type,
        token: user.token,

      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all products of a farmer
app.get('/api/products/:farmerId', async (req, res) => {
  try {
    const { farmerId } = req.params;  // ✅ correct
    const products = await Product.find({ farmer: farmerId });
    console.log(`Fetched products for farmer ${farmerId}:`, products);

    if (!products || products.length === 0) {
      return res.status(404).json({ message: "No products found" });
    }

    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Error fetching products", error: error.message });
  }
});

// ✅ Get ALL products (for buyers)
app.get('/api/products', async (req, res) => {
  try {
    // fetch all products and also populate farmer details if needed
    const products = await Product.find().populate("farmer", "name email");

    if (!products || products.length === 0) {
      return res.status(404).json({ message: "No products available" });
    }

    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching all products:", error);
    res.status(500).json({ message: "Error fetching products", error: error.message });
  }
});


app.delete("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Delete image file if it exists
    if (product.image) {
      const imagePath = path.join(__dirname, "uploads", product.image);
      fs.unlink(imagePath, (err) => {
        if (err) console.error("Failed to delete image:", err);
      });
    }

    await Product.findByIdAndDelete(id);

    res.status(200).json({ message: "✅ Product and image deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "❌ Server error", error: error.message });
  }
});



// Add to cart
app.post("/api/add-to-cart", async (req, res) => {
  const { userId, productId, quantity } = req.body;
  try {
    let cart = await Cart.findOne({ userId });
    if (cart) {
      // Check if product already in cart
      const itemIndex = cart.products.findIndex(p => p.productId.toString() === productId);
      if (itemIndex > -1) {
        cart.products[itemIndex].quantity += quantity;
      } else {
        cart.products.push({ productId, quantity });
      }
      cart = await cart.save();
    } else {
      cart = await Cart.create({ userId, products: [{ productId, quantity }] });
    }
    res.status(200).json(cart);
  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Get user's cart
app.get("/api/cart/:userId", async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.params.userId })
      .populate("products.productId", "name price image"); // 👈 fetch only fields needed
    res.status(200).json(cart);
  } catch (err) {
    res.status(500).json(err);
  }
});




// Remove from cart
// app.post("/remove", async (req, res) => {
//   const { userId, productId } = req.body;
//   try {
//     const cart = await Cart.findOne({ userId });
//     cart.products = cart.products.filter(p => p.productId != productId);
//     await cart.save();
//     res.status(200).json(cart);
//   } catch (err) {
//     res.status(500).json(err);
//   }
// });

app.post("/test-upload", upload.single("image"), async (req, res) => {
  try {
    console.log("➡️ /test-upload file:", req.file);
    if (!req.file) return res.status(400).json({ message: "No file received" });

    const imageUrl = await uploadImage(req.file.path);
    return res.json({ message: "Upload OK", file: req.file, imageUrl });
  } catch (err) {
    console.error("❌ /test-upload error:", err.stack || err);
    return res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

app.get("/api/test", (req, res) => {
  res.send("Test working!");
});



// start server
const PORT = 8080;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
