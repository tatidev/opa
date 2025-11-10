'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class NetsuiteOpmsSyncConfig extends Model {
    static associate(models) {
      // No associations needed for config
    }
  }

  NetsuiteOpmsSyncConfig.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    config_key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    config_value: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'NetsuiteOpmsSyncConfig',
    tableName: 'netsuite_opms_sync_config',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return NetsuiteOpmsSyncConfig;
};
