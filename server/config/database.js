const mysql = require('mysql2/promise');

let pool;

const connectDB = async () => {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'e_traffic_db',
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test the connection
    const connection = await pool.getConnection();
    console.log('✅ MySQL Database connected successfully');
    connection.release();
    
    return pool;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
};

const getConnection = () => {
  if (!pool) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return pool;
};

const query = async (sql, params = []) => {
  let sanitizedParams = [];
  try {
    const connection = await getConnection();
    
    // Ensure all parameters are properly defined and converted to appropriate types
    sanitizedParams = params.map((param, index) => {
      if (param === undefined || param === null) {
        console.warn(`Warning: Parameter at index ${index} is ${param}, converting to null`);
        return null;
      }
      // Convert numeric strings to numbers for LIMIT/OFFSET
      if (typeof param === 'string' && !isNaN(param) && param.trim() !== '') {
        const num = parseInt(param);
        if (!isNaN(num)) {
          return num;
        }
      }
      // Ensure numbers are actually numbers
      if (typeof param === 'number' && isNaN(param)) {
        console.warn(`Warning: Parameter at index ${index} is NaN, converting to 0`);
        return 0;
      }
      return param;
    });
    
    // Query execution logging (minimal)
    
    const [rows] = await connection.execute(sql, sanitizedParams);
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
    console.error('SQL:', sql);
    console.error('Parameters:', params);
    console.error('Sanitized parameters:', sanitizedParams);
    throw error;
  }
};

const transaction = async (callback) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
};

module.exports = {
  connectDB,
  getConnection,
  query,
  transaction
};
