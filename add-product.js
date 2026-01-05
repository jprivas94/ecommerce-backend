require('dotenv').config();
const { sequelize, Product } = require('./config/database');

async function addProduct(name, description, price, category, image, rating, stock) {
  try {
    await sequelize.authenticate();
    console.log('Connected to database.');

    const product = await Product.create({
      id: require('crypto').randomUUID(),
      name,
      description,
      price: parseFloat(price),
      category,
      image,
      rating: parseFloat(rating),
      stock: parseInt(stock),
    });

    console.log('Product added successfully:', product.toJSON());
    process.exit(0);
  } catch (error) {
    console.error('Error adding product:', error);
    process.exit(1);
  }
}

// Usage: node add-product.js "Product Name" "Description" 29.99 "Category" "image-url" 4.5 10
const [,, name, description, price, category, image, rating, stock] = process.argv;

if (!name || !description || !price || !category || !image || !rating || !stock) {
  console.log('Usage: node add-product.js "name" "description" price "category" "image" rating stock');
  process.exit(1);
}

addProduct(name, description, price, category, image, rating, stock);