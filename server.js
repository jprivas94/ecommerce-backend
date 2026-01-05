require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { sequelize, Product, CartItem, User } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuraciones básicas del servidor
const corsOptions = process.env.NODE_ENV === 'production'
  ? {
      origin: process.env.FRONTEND_URL || 'https://tu-app.vercel.app',
      credentials: true
    }
  : {}; // Permitimos todo en desarrollo

app.use(cors(corsOptions));

// Registramos todas las visitas al servidor
app.use((req, res, next) => {
  console.log('Request:', req.method, req.url);
  next();
});

// Limitamos las visitas para evitar abusos
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 visitas por dirección IP cada 15 minutos
});
app.use(limiter);

// Ruta de prueba para verificar que funciona
app.post('/test', (req, res) => res.send('POST funciona'));

// Verificamos que el usuario esté logueado y tenga permiso
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Ahora usamos la base de datos para guardar la información

// Definimos las rutas de la aplicación
console.log('Empezando a definir las rutas');

// Rutas para registro e inicio de sesión
app.post('/api/auth/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().isLength({ min: 1 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid input data', details: errors.array() });
  }

  const { email, password, name } = req.body;

  try {
    // Verificamos si el usuario ya existe
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'El usuario ya existe' });
    }

    // Protegemos la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Creamos el nuevo usuario
    const user = await User.create({
      email,
      password: hashedPassword,
      name,
    });

    // Generamos un pase de acceso
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Devolvemos la información del usuario (sin contraseña) y el pase
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid input data', details: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // Buscamos al usuario por email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    // Verificamos la contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    // Generamos un pase de acceso
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Devolvemos la información del usuario y el pase
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rutas para el carrito de compras
app.get('/api/cart', authenticateToken, async (req, res) => {
  try {
    const cartItems = await CartItem.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Product,
        as: 'Product', // assuming default alias
      }],
    });

    // Organizamos los productos del carrito con toda su información
    const formattedCart = cartItems.map(item => ({
      id: item.Product.id,
      cartId: item.id,
      name: item.Product.name,
      description: item.Product.description,
      price: item.Product.price,
      category: item.Product.category,
      image: item.Product.image,
      rating: item.Product.rating,
      stock: item.Product.stock,
      quantity: item.quantity,
    }));

    res.json(formattedCart);
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/cart', authenticateToken, [
  body('productId').isString().notEmpty(),
  body('quantity').optional().isInt({ min: 1 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid input data', details: errors.array() });
  }

  const { productId, quantity = 1 } = req.body;
  const userId = req.user.id;

  try {
    // Verificamos que el producto existe y hay suficiente stock
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    if (product.stock < quantity) {
      return res.status(400).json({ error: 'No hay suficiente stock' });
    }

    // Verificamos si el producto ya está en el carrito
    const existingItem = await CartItem.findOne({
      where: { userId, productId },
    });

    if (existingItem) {
      // Sumamos la cantidad
      const newQuantity = existingItem.quantity + quantity;
      if (product.stock < newQuantity) {
        return res.status(400).json({ error: 'No hay suficiente stock para la cantidad total' });
      }
      existingItem.quantity = newQuantity;
      await existingItem.save();
    } else {
      // Agregamos el producto al carrito
      await CartItem.create({ userId, productId, quantity });
    }

    // Devolvemos el carrito actualizado
    const updatedCart = await CartItem.findAll({
      where: { userId },
      include: [{ model: Product }],
    });

    const formattedCart = updatedCart.map(item => ({
      id: item.Product.id,
      cartId: item.id,
      name: item.Product.name,
      description: item.Product.description,
      price: item.Product.price,
      category: item.Product.category,
      image: item.Product.image,
      rating: item.Product.rating,
      stock: item.Product.stock,
      quantity: item.quantity,
    }));

    res.json(formattedCart);
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/cart/:cartId', authenticateToken, [
  body('quantity').isInt({ min: 1 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid input data', details: errors.array() });
  }

  const { cartId } = req.params;
  const { quantity } = req.body;
  const userId = req.user.id;

  try {
    const cartItem = await CartItem.findOne({
      where: { id: cartId, userId },
      include: [{ model: Product }],
    });

    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    if (cartItem.Product.stock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    cartItem.quantity = quantity;
    await cartItem.save();

    // Return updated cart
    const updatedCart = await CartItem.findAll({
      where: { userId },
      include: [{ model: Product }],
    });

    const formattedCart = updatedCart.map(item => ({
      id: item.Product.id,
      cartId: item.id,
      name: item.Product.name,
      description: item.Product.description,
      price: item.Product.price,
      category: item.Product.category,
      image: item.Product.image,
      rating: item.Product.rating,
      stock: item.Product.stock,
      quantity: item.quantity,
    }));

    res.json(formattedCart);
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/cart/:cartId', authenticateToken, async (req, res) => {
  const { cartId } = req.params;
  const userId = req.user.id;

  try {
    const cartItem = await CartItem.findOne({
      where: { id: cartId, userId },
    });

    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    await cartItem.destroy();

    // Return updated cart
    const updatedCart = await CartItem.findAll({
      where: { userId },
      include: [{ model: Product }],
    });

    const formattedCart = updatedCart.map(item => ({
      id: item.Product.id,
      cartId: item.id,
      name: item.Product.name,
      description: item.Product.description,
      price: item.Product.price,
      category: item.Product.category,
      image: item.Product.image,
      rating: item.Product.rating,
      stock: item.Product.stock,
      quantity: item.quantity,
    }));

    res.json(formattedCart);
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/cart/checkout', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // Obtenemos todos los productos del carrito
    const cartItems = await CartItem.findAll({
      where: { userId },
      include: [{ model: Product }],
    });

    if (cartItems.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío' });
    }

    // Verificamos el stock de todos los productos
    for (const item of cartItems) {
      if (item.Product.stock < item.quantity) {
        return res.status(400).json({
          error: `No hay suficiente stock para ${item.Product.name}. Disponible: ${item.Product.stock}, solicitado: ${item.quantity}`
        });
      }
    }

    // Calculamos el total y preparamos el resumen del pedido
    const orderSummary = cartItems.map(item => ({
      productId: item.productId,
      name: item.Product.name,
      quantity: item.quantity,
      price: item.Product.price,
      total: item.Product.price * item.quantity,
    }));

    const total = orderSummary.reduce((sum, item) => sum + item.total, 0);

    // Actualizamos el stock de los productos
    for (const item of cartItems) {
      item.Product.stock -= item.quantity;
      await item.Product.save();
    }

    // Vaciamos el carrito
    await CartItem.destroy({ where: { userId } });

    res.json({
      message: '¡Felicidades! Ya lo compraste.',
      orderSummary,
      total,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

// Obtener todos los productos
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.findAll();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Obtener un producto específico
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Obtener productos por categoría
app.get('/api/products/category/:category', async (req, res) => {
  try {
    const category = req.params.category;
    const where = category === 'All' ? {} : { category };
    const filteredProducts = await Product.findAll({ where });
    res.json(filteredProducts);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Buscar productos
app.get('/api/products/search/:query', async (req, res) => {
  try {
    const query = req.params.query.toLowerCase();
    const filteredProducts = await Product.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: `%${query}%` } },
          { description: { [Op.iLike]: `%${query}%` } },
        ],
      },
    });
    res.json(filteredProducts);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Verificar que el servidor está funcionando
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

console.log('Todas las rutas definidas');

console.log('Sincronizando la base de datos...');
sequelize.sync().then(async () => {
  console.log('Database synced successfully');
  // Agregamos usuarios de prueba si no hay ninguno
  const existingUsers = await User.findAll();
  if (existingUsers.length === 0) {
    console.log('Agregando usuarios de prueba...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    await User.bulkCreate([
      { email: 'user1@example.com', password: hashedPassword, name: 'Usuario Uno' },
      { email: 'user2@example.com', password: hashedPassword, name: 'Usuario Dos' },
    ]);
    console.log('Usuarios agregados');
  }

  // Agregamos productos de prueba si no hay ninguno
  const existingProducts = await Product.findAll();
  if (existingProducts.length === 0) {
    await Product.bulkCreate([
      {
        id: '1',
        name: 'Quantum Headphones',
        description: 'High-fidelity audio with active noise cancellation and 40-hour battery life.',
        price: 299.99,
        category: 'Electronics',
        image: 'https://picsum.photos/seed/hp1/600/600',
        rating: 4.8,
        stock: 15,
      },
      {
        id: '2',
        name: 'Minimalist Watch',
        description: 'A sleek, titanium-cased timepiece with a scratch-resistant sapphire crystal.',
        price: 185.0,
        category: 'Accessories',
        image: 'https://picsum.photos/seed/watch2/600/600',
        rating: 4.5,
        stock: 22,
      },
      {
        id: '3',
        name: 'Smart Desk Lamp',
        description: 'Adjustable color temperature and brightness with built-in wireless charging.',
        price: 79.99,
        category: 'Home',
        image: 'https://picsum.photos/seed/lamp3/600/600',
        rating: 4.2,
        stock: 45,
      },
      {
        id: '4',
        name: 'Eco-Friendly Backpack',
        description: 'Made from 100% recycled ocean plastics. Water-resistant and modular design.',
        price: 120.0,
        category: 'Apparel',
        image: 'https://picsum.photos/seed/bag4/600/600',
        rating: 4.9,
        stock: 10,
      },
      {
        id: '5',
        name: 'Mechanical Keyboard',
        description: 'RGB backlit, hot-swappable switches, and ultra-low latency wireless connection.',
        price: 159.99,
        category: 'Electronics',
        image: 'https://picsum.photos/seed/kb5/600/600',
        rating: 4.7,
        stock: 8,
      },
      {
        id: '6',
        name: 'Linen Comfort Shirt',
        description: 'Breathable organic linen, perfect for summer days and casual evenings.',
        price: 55.0,
        category: 'Apparel',
        image: 'https://picsum.photos/seed/shirt6/600/600',
        rating: 4.4,
        stock: 30,
      },
    ]);
  }
   console.log('Database synced');
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Unable to sync database:', err);
  process.exit(1);
});