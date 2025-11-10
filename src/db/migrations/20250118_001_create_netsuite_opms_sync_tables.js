'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create sync configuration table
    await queryInterface.createTable('netsuite_opms_sync_config', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      config_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      config_value: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Create sync jobs table
    await queryInterface.createTable('netsuite_opms_sync_jobs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      job_type: {
        type: Sequelize.ENUM('initial', 'item', 'scheduled', 'manual', 'force_full'),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'running', 'completed', 'failed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending'
      },
      total_items: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      processed_items: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      successful_items: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      failed_items: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Create sync items table
    await queryInterface.createTable('netsuite_opms_sync_items', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      sync_job_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'netsuite_opms_sync_jobs',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      netsuite_item_id: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      opms_item_id: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'success', 'failed', 'skipped'),
        allowNull: false,
        defaultValue: 'pending'
      },
      sync_fields: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Fields that were synced and their values'
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      retry_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      max_retries: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Create sync logs table
    await queryInterface.createTable('netsuite_opms_sync_logs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      sync_job_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'netsuite_opms_sync_jobs',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      log_level: {
        type: Sequelize.ENUM('debug', 'info', 'warn', 'error'),
        allowNull: false,
        defaultValue: 'info'
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      details: {
        type: Sequelize.JSON,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('netsuite_opms_sync_jobs', ['status', 'created_at']);
    await queryInterface.addIndex('netsuite_opms_sync_items', ['sync_job_id', 'status']);
    await queryInterface.addIndex('netsuite_opms_sync_items', ['netsuite_item_id']);
    await queryInterface.addIndex('netsuite_opms_sync_logs', ['sync_job_id', 'created_at']);
    await queryInterface.addIndex('netsuite_opms_sync_logs', ['log_level', 'created_at']);

    // Insert default configuration
    await queryInterface.bulkInsert('netsuite_opms_sync_config', [
      {
        config_key: 'sync_enabled',
        config_value: 'true',
        description: 'Enable/disable NetSuite to OPMS sync'
      },
      {
        config_key: 'max_retries',
        config_value: '3',
        description: 'Maximum retry attempts for failed syncs'
      },
      {
        config_key: 'retry_delay_seconds',
        config_value: '300',
        description: 'Delay between retry attempts in seconds'
      },
      {
        config_key: 'batch_size',
        config_value: '100',
        description: 'Number of items to process in each batch'
      },
      {
        config_key: 'rate_limit_delay_ms',
        config_value: '1000',
        description: 'Delay between NetSuite API calls in milliseconds'
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('netsuite_opms_sync_logs');
    await queryInterface.dropTable('netsuite_opms_sync_items');
    await queryInterface.dropTable('netsuite_opms_sync_jobs');
    await queryInterface.dropTable('netsuite_opms_sync_config');
  }
};
