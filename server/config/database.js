const { initializeFirebase } = require('./firebase');
const FirebaseService = require('./firebaseService');

let firebaseService;

const connectDB = async () => {
  try {
    await initializeFirebase();
    firebaseService = new FirebaseService();
    console.log('✅ Firebase Database connected successfully');
    return firebaseService;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
};

const getConnection = () => {
  if (!firebaseService) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return firebaseService;
};

// Legacy query function for backward compatibility
// This will be gradually replaced with specific Firebase methods
const query = async (sql, params = []) => {
  console.warn('⚠️ Using legacy query function. Consider migrating to Firebase-specific methods.');
  
  // This is a simplified implementation for basic queries
  // Complex queries should be migrated to use Firebase methods directly
  try {
    const service = getConnection();
    
    // Parse basic SQL patterns (this is limited and should be replaced)
    if (sql.includes('SELECT * FROM users WHERE email = ?')) {
      return await service.findUserByEmail(params[0]);
    }
    
    if (sql.includes('SELECT * FROM users WHERE username = ?')) {
      return await service.findUserByUsername(params[0]);
    }
    
    if (sql.includes('SELECT * FROM violations WHERE violation_number = ?')) {
      return await service.findViolationByNumber(params[0]);
    }
    
    // For other queries, throw an error to encourage migration
    throw new Error(`Legacy query not supported: ${sql}. Please migrate to Firebase-specific methods.`);
    
  } catch (error) {
    console.error('Database query error:', error);
    console.error('SQL:', sql);
    console.error('Parameters:', params);
    throw error;
  }
};

const transaction = async (callback) => {
  const service = getConnection();
  try {
    return await service.runTransaction(callback);
  } catch (error) {
    console.error('Transaction error:', error);
    throw error;
  }
};

module.exports = {
  connectDB,
  getConnection,
  query,
  transaction,
  getFirebaseService: () => firebaseService
};
