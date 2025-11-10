'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class NetsuiteOpmsSyncItem extends Model {
    static associate(models) {
      // Define associations here
      NetsuiteOpmsSyncItem.belongsTo(models.NetsuiteOpmsSyncJob, {
        foreignKey: 'sync_job_id',
        as: 'syncJob'
      });
    }
  }

  NetsuiteOpmsSyncItem.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    sync_job_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'netsuite_opms_sync_jobs',
        key: 'id'
      }
    },
    netsuite_item_id: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    opms_item_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'success', 'failed', 'skipped'),
      allowNull: false,
      defaultValue: 'pending'
    },
    sync_fields: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Fields that were synced and their values'
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    retry_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    max_retries: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'NetsuiteOpmsSyncItem',
    tableName: 'netsuite_opms_sync_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return NetsuiteOpmsSyncItem;
};
