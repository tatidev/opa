'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class NetsuiteOpmsSyncLog extends Model {
    static associate(models) {
      // Define associations here
      NetsuiteOpmsSyncLog.belongsTo(models.NetsuiteOpmsSyncJob, {
        foreignKey: 'sync_job_id',
        as: 'syncJob'
      });
    }
  }

  NetsuiteOpmsSyncLog.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    sync_job_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'netsuite_opms_sync_jobs',
        key: 'id'
      }
    },
    log_level: {
      type: DataTypes.ENUM('debug', 'info', 'warn', 'error'),
      allowNull: false,
      defaultValue: 'info'
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    details: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'NetsuiteOpmsSyncLog',
    tableName: 'netsuite_opms_sync_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false // Logs are immutable
  });

  return NetsuiteOpmsSyncLog;
};
