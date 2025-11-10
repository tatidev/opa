#!/usr/bin/env node
/**
 * Production OPMS API Restart Script
 * 
 * This script automatically discovers production EC2 instances and performs
 * a zero-downtime PM2 restart of the OPMS API application.
 * 
 * Prerequisites:
 * - AWS CLI configured with appropriate credentials
 * - SSM permissions for production instances
 * - Production instances tagged with Environment=prod, Application=opms-api
 * 
 * Usage:
 *   node scripts/startup-prod.js
 *   OR
 *   ./scripts/startup-prod.js
 * 
 * Features:
 * - Automatic instance discovery via AWS tags
 * - Zero-downtime PM2 reload
 * - Health check verification
 * - Clear status reporting
 * - Error handling and recovery
 */

const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  REGION: 'us-west-1',
  APP_PATH: '/opuzen-efs/prod/opms-api',
  APP_NAME: 'opms-api',
  PM2_USER: 'ubuntu',
  HEALTH_ENDPOINT: 'http://localhost:3000/api/health',
  WAIT_TIME: 15, // seconds to wait for restart
};

/**
 * Execute shell command and return output
 */
function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    }).trim();
  } catch (error) {
    if (options.ignoreError) {
      return '';
    }
    throw error;
  }
}

/**
 * Discover production EC2 instances running OPMS API
 */
function discoverProductionInstances() {
  console.log('🔍 Discovering production OPMS API instances...');
  
  try {
    // Query EC2 instances by tags
    const query = `aws ec2 describe-instances \
      --region ${CONFIG.REGION} \
      --filters \
        "Name=tag:Environment,Values=prod,production" \
        "Name=tag:Application,Values=opms-api" \
        "Name=instance-state-name,Values=running" \
      --query "Reservations[].Instances[].[InstanceId,Tags[?Key=='Name'].Value|[0],State.Name,PublicIpAddress]" \
      --output text`;
    
    const result = exec(query, { silent: true });
    
    if (!result) {
      console.log('⚠️  No instances found via tags. Trying known instance IDs...');
      
      // Fallback to known production instance IDs from existing scripts
      const knownInstances = [
        'i-0641b830fc1add76c',  // From memory - current production instance
        'i-0102d90b810973c44',  // From restart-prod-simple.sh
        'i-0f4f20f1caf1b1fab',  // From restart-prod-pm2.sh
      ];
      
      for (const instanceId of knownInstances) {
        const state = exec(
          `aws ec2 describe-instances --instance-ids ${instanceId} --region ${CONFIG.REGION} --query "Reservations[0].Instances[0].State.Name" --output text 2>/dev/null || echo "not-found"`,
          { silent: true, ignoreError: true }
        );
        
        if (state === 'running') {
          console.log(`✅ Found running instance: ${instanceId}`);
          return [instanceId];
        }
      }
      
      throw new Error('No running production instances found');
    }
    
    // Parse results
    const instances = result.split('\n').map(line => {
      const [id, name, state, ip] = line.split('\t');
      return { id, name: name || 'N/A', state, ip: ip || 'N/A' };
    });
    
    console.log(`✅ Found ${instances.length} production instance(s):`);
    instances.forEach(inst => {
      console.log(`   - ${inst.id} (${inst.name}) - ${inst.ip}`);
    });
    
    return instances.map(inst => inst.id);
  } catch (error) {
    console.error('❌ Error discovering instances:', error.message);
    throw error;
  }
}

/**
 * Send PM2 restart command to instance via SSM
 */
function restartInstance(instanceId) {
  console.log(`\n🔄 Restarting OPMS API on instance: ${instanceId}`);
  console.log('=' .repeat(60));
  
  // Build SSM command for PM2 reload
  const commands = [
    `echo "=== Checking current PM2 status ==="`,
    `cd ${CONFIG.APP_PATH}`,
    `sudo -u ${CONFIG.PM2_USER} npx pm2 status || echo "PM2 not running yet"`,
    `echo ""`,
    `echo "=== Performing PM2 reload (zero-downtime restart) ==="`,
    `sudo -u ${CONFIG.PM2_USER} npx pm2 reload ${CONFIG.APP_NAME} || sudo -u ${CONFIG.PM2_USER} npx pm2 restart ${CONFIG.APP_NAME} || sudo -u ${CONFIG.PM2_USER} npx pm2 start ecosystem.config.js`,
    `sleep 5`,
    `echo ""`,
    `echo "=== Verifying PM2 status ==="`,
    `sudo -u ${CONFIG.PM2_USER} npx pm2 status`,
    `echo ""`,
    `echo "=== Testing health endpoint ==="`,
    `curl -f ${CONFIG.HEALTH_ENDPOINT} || echo "⚠️  Health check pending..."`,
    `echo ""`,
    `echo "=== Recent application logs ==="`,
    `sudo -u ${CONFIG.PM2_USER} npx pm2 logs ${CONFIG.APP_NAME} --lines 15 --nostream || tail -20 /home/ubuntu/logs/opms-api-out.log`
  ];
  
  const commandJson = JSON.stringify(commands);
  
  try {
    // Send SSM command
    const commandId = exec(
      `aws ssm send-command \
        --instance-ids "${instanceId}" \
        --document-name "AWS-RunShellScript" \
        --comment "PM2 Reload OPMS API Production" \
        --parameters 'commands=${commandJson}' \
        --region ${CONFIG.REGION} \
        --output text \
        --query 'Command.CommandId'`,
      { silent: true }
    );
    
    console.log(`✅ Command sent: ${commandId}`);
    console.log(`⏳ Waiting ${CONFIG.WAIT_TIME} seconds for restart to complete...\n`);
    
    // Wait for command to complete
    exec(`sleep ${CONFIG.WAIT_TIME}`, { silent: true });
    
    // Get command status and output
    console.log('📊 Restart Results:');
    console.log('=' .repeat(60));
    
    const output = exec(
      `aws ssm get-command-invocation \
        --command-id "${commandId}" \
        --instance-id "${instanceId}" \
        --region ${CONFIG.REGION} \
        --query 'StandardOutputContent' \
        --output text`,
      { silent: true }
    );
    
    console.log(output);
    
    // Check final status
    const status = exec(
      `aws ssm get-command-invocation \
        --command-id "${commandId}" \
        --instance-id "${instanceId}" \
        --region ${CONFIG.REGION} \
        --query 'Status' \
        --output text`,
      { silent: true }
    );
    
    if (status === 'Success') {
      console.log('\n✅ Restart completed successfully!');
      return true;
    } else {
      console.log(`\n⚠️  Restart completed with status: ${status}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error restarting instance ${instanceId}:`, error.message);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🚀 OPMS API Production Restart Utility');
  console.log('=' .repeat(60));
  console.log(`Region: ${CONFIG.REGION}`);
  console.log(`App Path: ${CONFIG.APP_PATH}`);
  console.log(`PM2 App: ${CONFIG.APP_NAME}`);
  console.log('=' .repeat(60));
  console.log('');
  
  try {
    // Step 1: Discover instances
    const instanceIds = discoverProductionInstances();
    
    if (instanceIds.length === 0) {
      throw new Error('No production instances found');
    }
    
    // Step 2: Restart each instance
    let successCount = 0;
    for (const instanceId of instanceIds) {
      const success = restartInstance(instanceId);
      if (success) successCount++;
    }
    
    // Step 3: Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📋 Restart Summary');
    console.log('=' .repeat(60));
    console.log(`Total instances: ${instanceIds.length}`);
    console.log(`Successful restarts: ${successCount}`);
    console.log(`Failed restarts: ${instanceIds.length - successCount}`);
    
    if (successCount === instanceIds.length) {
      console.log('\n✅ All instances restarted successfully!');
      console.log('\n📝 Next Steps:');
      console.log('   1. Check sync dashboard: https://api.opuzen-service.com/api/sync-dashboard/');
      console.log('   2. Monitor application logs via PM2');
      console.log('   3. Verify API health endpoint');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some instances failed to restart. Check logs above.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Verify AWS CLI is configured: aws sts get-caller-identity');
    console.error('   2. Check SSM permissions for production instances');
    console.error('   3. Verify instances are running: aws ec2 describe-instances');
    console.error('   4. Check instance tags: Environment=prod, Application=opms-api');
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { discoverProductionInstances, restartInstance };

