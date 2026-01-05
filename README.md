# Ecommerce Backend

Backend API para la aplicación de ecommerce, construido con Node.js, Express y PostgreSQL.

## Tecnologías Utilizadas

### Backend
- **Node.js** v20 - JavaScript runtime (via Docker)
- **Express.js** v4.18.2 - Web framework
- **Sequelize** v6.37.7 - ORM para operaciones de base de datos
- **PostgreSQL** v16 - Base de datos relacional (via Docker)
- **bcryptjs** v3.0.3 - Encriptación de contraseñas
- **jsonwebtoken** v9.0.3 - Autenticación JWT
- **express-rate-limit** v8.2.1 - Limitación de rate de API
- **express-validator** v7.3.1 - Validación de inputs
- **cors** v2.8.5 - Cross-origin resource sharing
- **pg** v8.16.3 - Cliente PostgreSQL
- **dotenv** v17.2.3 - Manejo de variables de entorno

### Desarrollo
- **Docker** - Containerización
- **ESLint** - Linting de código

## Instalación y Configuración

### Prerrequisitos
- Node.js v18+
- Docker y Docker Compose
- PostgreSQL (local o en la nube)

### Instalación
1. Clona este repositorio
2. Instala dependencias:
   ```bash
   npm install
   ```

3. Copia el archivo de variables de entorno:
   ```bash
   cp .env.example .env
   ```

4. Configura las variables en `.env`:
   ```
   DATABASE_URL=postgresql://usuario:contraseña@host:puerto/base_datos
   JWT_SECRET=tu-clave-secreta-jwt-muy-segura
   NODE_ENV=development
   PORT=3000
   FRONTEND_URL=http://localhost:3000
   ```

### Desarrollo Local
```bash
npm run dev
```

### Producción con Docker
```bash
docker build -t ecommerce-backend .
docker run -p 3000:3000 ecommerce-backend
```

## API Endpoints

### Autenticación
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Inicio de sesión

### Productos
- `GET /api/products` - Obtener todos los productos
- `GET /api/products/:id` - Obtener producto específico
- `GET /api/products/category/:category` - Filtrar por categoría
- `GET /api/products/search/:query` - Buscar productos

### Carrito (Requiere autenticación)
- `GET /api/cart` - Obtener carrito del usuario
- `POST /api/cart` - Agregar producto al carrito
- `PUT /api/cart/:cartId` - Actualizar cantidad
- `DELETE /api/cart/:cartId` - Eliminar producto del carrito
- `POST /api/cart/checkout` - Procesar compra

### Salud
- `GET /api/health` - Verificar estado del servidor

## Base de Datos

### Esquema
- **users:** id (uuid), email, password, name, createdAt, updatedAt
- **products:** id (string), name, description, price, category, image, rating, stock, createdAt, updatedAt
- **cart_items:** id (uuid), userId, productId, quantity, createdAt, updatedAt

### Migraciones
Las tablas se crean automáticamente al iniciar el servidor usando Sequelize sync.

## Despliegue

### Render con Docker
1. Sube este repositorio a GitHub
2. Crea un nuevo Web Service en Render
3. Selecciona Docker como runtime
4. Configura las variables de entorno
5. Despliega

### Variables de Entorno para Producción
- `DATABASE_URL`: URL de conexión PostgreSQL
- `JWT_SECRET`: Clave secreta para JWT
- `NODE_ENV`: `production`
- `FRONTEND_URL`: URL de tu frontend desplegado

## Scripts Disponibles
- `npm start` - Inicia el servidor en producción
- `npm run dev` - Inicia el servidor en desarrollo
- `npm run add-product` - Agrega productos desde línea de comandos

## Contribución
1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## Licencia
MIT