const admin = require('firebase-admin');
require('dotenv').config();

let db;

const initializeFirebase = async () => {
  try {
    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      // Use service account key if provided, otherwise use default credentials
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID
        });
      } else {
        // For local development, you can use default credentials
        // Make sure to set GOOGLE_APPLICATION_CREDENTIALS environment variable
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID
        });
      }
    }

    // Get Firestore instance
    db = admin.firestore();
    
    console.log('✅ Firebase Admin SDK initialized successfully');
    console.log(`✅ Connected to Firestore project: ${process.env.FIREBASE_PROJECT_ID}`);
    
    return db;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    throw error;
  }
};

const getFirestore = () => {
  if (!db) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return db;
};

// Helper function to convert Firestore document to plain object
const docToObject = (doc) => {
  if (!doc.exists) {
    return null;
  }
  
  const data = doc.data();
  return {
    id: doc.id,
    ...data
  };
};

// Helper function to convert Firestore query snapshot to array of objects
const snapshotToArray = (snapshot) => {
  const results = [];
  snapshot.forEach(doc => {
    results.push(docToObject(doc));
  });
  return results;
};

// Helper function to generate unique ID (similar to MySQL AUTO_INCREMENT)
const generateId = () => {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

// Helper function to add timestamps
const addTimestamps = (data) => {
  const now = admin.firestore.FieldValue.serverTimestamp();
  return {
    ...data,
    created_at: now,
    updated_at: now
  };
};

// Helper function to update timestamp
const updateTimestamp = (data) => {
  return {
    ...data,
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  };
};

module.exports = {
  initializeFirebase,
  getFirestore,
  docToObject,
  snapshotToArray,
  generateId,
  addTimestamps,
  updateTimestamp,
  admin
};
