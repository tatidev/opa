'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class NetsuiteOpmsSyncJob extends Model {
    static associate(models) {
      // Define associations here
      NetsuiteOpmsSyncJob.hasMany(models.NetsuiteOpmsSyncItem, {
        foreignKey: 'sync_job_id',
        as: 'syncItems'
      });
      
      NetsuiteOpmsSyncJob.hasMany(models.NetsuiteOpmsSyncLog, {
        foreignKey: 'sync_job_id',
        as: 'syncLogs'
      });
    }

    // Helper methods
    isRunning() {
      return this.status === 'running';
    }

    isCompleted() {
      return this.status === 'completed';
    }

    isFailed() {
      return this.status === 'failed';
    }

    isPending() {
      return this.status === 'pending';
    }

    getProgress() {
      if (!this.total_items || this.total_items === 0) return 0;
      return Math.round((this.processed_items / this.total_items) * 100);
    }

    getSuccessRate() {
      if (!this.processed_items || this.processed_items === 0) return 0;
      return Math.round((this.successful_items / this.processed_items) * 100);
    }

    getFailureRate() {
      if (!this.processed_items || this.processed_items === 0) return 0;
      return Math.round((this.failed_items / this.processed_items) * 100);
    }

    getDuration() {
      if (!this.started_at) return null;
      const endTime = this.completed_at || new Date();
      return Math.round((endTime - this.started_at) / 1000); // seconds
    }

    addLog(level, message, details = null) {
      return this.sequelize.models.NetsuiteOpmsSyncLog.create({
        sync_job_id: this.id,
        log_level: level,
        message,
        details
      });
    }

    async updateProgress(processed, successful, failed) {
      this.processed_items = processed;
      this.successful_items = successful;
      this.failed_items = failed;
      await this.save();
    }

    async markStarted() {
      this.status = 'running';
      this.started_at = new Date();
      await this.save();
    }

    async markCompleted() {
      this.status = 'completed';
      this.completed_at = new Date();
      await this.save();
    }

    async markFailed(errorMessage) {
      this.status = 'failed';
      this.completed_at = new Date();
      this.error_message = errorMessage;
      await this.save();
    }

    async markCancelled() {
      this.status = 'cancelled';
      this.completed_at = new Date();
      await this.save();
    }
  }

  NetsuiteOpmsSyncJob.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    job_type: {
      type: DataTypes.ENUM('initial', 'item', 'scheduled', 'manual', 'force_full', 'pricing_sync', 'ns_to_opms_pricing'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'running', 'completed', 'failed', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending'
    },
    total_items: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    processed_items: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    successful_items: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    failed_items: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'NetsuiteOpmsSyncJob',
    tableName: 'netsuite_opms_sync_jobs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return NetsuiteOpmsSyncJob;
};
