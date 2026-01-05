const { Sequelize } = require('sequelize');

require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false, // cambiar a console.log para ver las consultas SQL
});

const Product = require('../models/Product')(sequelize, Sequelize.DataTypes);
const CartItem = require('../models/CartItem')(sequelize, Sequelize.DataTypes);
const User = require('../models/User')(sequelize, Sequelize.DataTypes);

// Conexiones entre las tablas
CartItem.belongsTo(Product, { foreignKey: 'productId' });
Product.hasMany(CartItem, { foreignKey: 'productId' });
CartItem.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(CartItem, { foreignKey: 'userId' });

module.exports = { sequelize, Product, CartItem, User };