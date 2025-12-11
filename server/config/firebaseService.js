const { getFirestore, docToObject, snapshotToArray, generateId, addTimestamps, updateTimestamp } = require('./firebase');

class FirebaseService {
  constructor() {
    this.db = getFirestore();
  }

  // Generic collection operations
  async create(collection, data) {
    try {
      const docRef = this.db.collection(collection).doc();
      const dataWithTimestamps = addTimestamps(data);
      await docRef.set(dataWithTimestamps);

      const doc = await docRef.get();
      return docToObject(doc);
    } catch (error) {
      console.error(`Error creating document in ${collection}:`, error);
      throw error;
    }
  }

  async findById(collection, id) {
    try {
      const doc = await this.db.collection(collection).doc(id).get();
      return docToObject(doc);
    } catch (error) {
      console.error(`Error finding document in ${collection}:`, error);
      throw error;
    }
  }

  async findOne(collection, field, value) {
    try {
      const snapshot = await this.db.collection(collection)
        .where(field, '==', value)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      return docToObject(snapshot.docs[0]);
    } catch (error) {
      console.error(`Error finding document in ${collection}:`, error);
      throw error;
    }
  }

  async findMany(collection, conditions = {}, options = {}) {
    try {
      let query = this.db.collection(collection);

      // Apply where conditions
      Object.entries(conditions).forEach(([field, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.where(field, '==', value);
        }
      });

      // Apply ordering - MUST be done before limit/offset in Firestore
      // Only apply ordering if explicitly requested to avoid composite index requirements
      if (options.orderBy) {
        query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
      }
      // If no explicit orderBy and no conditions, use default created_at ordering
      else if (Object.keys(conditions).length === 0) {
        query = query.orderBy('created_at', 'desc');
      }

      // Firestore doesn't support offset efficiently, so we'll get all and paginate in memory
      // Note: This is not ideal for large datasets, but works for the current use case
      const snapshot = await query.get();
      let results = snapshotToArray(snapshot);

      // If no orderBy was used but we want sorting, do it in memory
      if (!options.orderBy && Object.keys(conditions).length > 0 && options.sortInMemory !== false) {
        results.sort((a, b) => {
          const aDate = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || 0);
          const bDate = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || 0);
          return bDate - aDate;
        });
      }

      // Apply offset and limit in memory
      if (options.offset) {
        results = results.slice(options.offset);
      }

      if (options.limit) {
        results = results.slice(0, options.limit);
      }

      return results;
    } catch (error) {
      console.error(`Error finding documents in ${collection}:`, error);
      console.error('Conditions:', conditions);
      console.error('Options:', options);
      throw error;
    }
  }

  async update(collection, id, data) {
    try {
      const docRef = this.db.collection(collection).doc(id);
      const dataWithTimestamp = updateTimestamp(data);
      await docRef.update(dataWithTimestamp);

      const doc = await docRef.get();
      return docToObject(doc);
    } catch (error) {
      console.error(`Error updating document in ${collection}:`, error);
      throw error;
    }
  }

  async delete(collection, id) {
    try {
      await this.db.collection(collection).doc(id).delete();
      return true;
    } catch (error) {
      console.error(`Error deleting document in ${collection}:`, error);
      throw error;
    }
  }

  async count(collection, conditions = {}) {
    try {
      let query = this.db.collection(collection);

      // Apply where conditions
      Object.entries(conditions).forEach(([field, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.where(field, '==', value);
        }
      });

      const snapshot = await query.get();
      return snapshot.size;
    } catch (error) {
      console.error(`Error counting documents in ${collection}:`, error);
      throw error;
    }
  }

  // Specific methods for each collection
  async createUser(userData) {
    return this.create('users', userData);
  }

  async findUserByEmail(email) {
    return this.findOne('users', 'email', email);
  }

  async findUserByUsername(username) {
    return this.findOne('users', 'username', username);
  }

  async findUserByBadgeNumber(badgeNumber) {
    return this.findOne('users', 'badge_number', badgeNumber);
  }

  async getUsers(filters = {}, options = {}) {
    return this.findMany('users', filters, options);
  }

  async updateUser(id, userData) {
    return this.update('users', id, userData);
  }

  async deleteUser(id) {
    return this.delete('users', id);
  }

  // Violations
  async createViolation(violationData) {
    return this.create('violations', violationData);
  }

  async findViolationByNumber(violationNumber) {
    return this.findOne('violations', 'violation_number', violationNumber);
  }

  async getViolations(filters = {}, options = {}) {
    return this.findMany('violations', filters, options);
  }

  async updateViolation(id, violationData) {
    return this.update('violations', id, violationData);
  }

  async deleteViolation(id) {
    return this.delete('violations', id);
  }

  // SMS Logs
  async createSmsLog(smsData) {
    return this.create('sms_logs', smsData);
  }

  async getSmsLogs(filters = {}, options = {}) {
    return this.findMany('sms_logs', filters, options);
  }

  async updateSmsLog(id, smsData) {
    return this.update('sms_logs', id, smsData);
  }

  // Audit Logs
  async createAuditLog(auditData) {
    return this.create('audit_logs', auditData);
  }

  async getAuditLogs(filters = {}, options = {}) {
    return this.findMany('audit_logs', filters, options);
  }

  // System Settings
  async createSetting(settingData) {
    return this.create('system_settings', settingData);
  }

  async findSettingByKey(key) {
    return this.findOne('system_settings', 'setting_key', key);
  }

  async getSettings(filters = {}, options = {}) {
    return this.findMany('system_settings', filters, options);
  }

  async updateSetting(id, settingData) {
    return this.update('system_settings', id, settingData);
  }

  // Complex queries that require multiple operations
  async getViolationsWithEnforcer(filters = {}, options = {}) {
    try {
      const violations = await this.getViolations(filters, options);

      // Get enforcer details for each violation
      const violationsWithEnforcer = await Promise.all(
        violations.map(async (violation) => {
          if (violation.enforcer_id) {
            try {
              const enforcer = await this.findById('users', violation.enforcer_id);
              return {
                ...violation,
                enforcer_name: enforcer ? enforcer.full_name : 'Unknown',
                enforcer_badge: enforcer ? enforcer.badge_number : 'Unknown'
              };
            } catch (error) {
              console.error(`Error fetching enforcer for violation ${violation.id}:`, error);
              return {
                ...violation,
                enforcer_name: 'Unknown',
                enforcer_badge: 'Unknown'
              };
            }
          }
          return {
            ...violation,
            enforcer_name: 'Unknown',
            enforcer_badge: 'Unknown'
          };
        })
      );

      return violationsWithEnforcer;
    } catch (error) {
      console.error('Error getting violations with enforcer:', error);
      throw error;
    }
  }

  async getAuditLogsWithUser(filters = {}, options = {}) {
    try {
      const auditLogs = await this.getAuditLogs(filters, options);

      // Get user details for each audit log
      const auditLogsWithUser = await Promise.all(
        auditLogs.map(async (log) => {
          if (log.user_id) {
            const user = await this.findById('users', log.user_id);
            return {
              ...log,
              user_name: user ? user.full_name : 'Unknown'
            };
          }
          return log;
        })
      );

      return auditLogsWithUser;
    } catch (error) {
      console.error('Error getting audit logs with user:', error);
      throw error;
    }
  }

  // Transaction support
  async runTransaction(callback) {
    try {
      return await this.db.runTransaction(callback);
    } catch (error) {
      console.error('Transaction error:', error);
      throw error;
    }
  }
}

module.exports = FirebaseService;
