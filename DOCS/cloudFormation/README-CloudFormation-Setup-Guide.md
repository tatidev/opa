# OPMS API CloudFormation Infrastructure Setup Guide

## Overview

This guide provides step-by-step instructions for deploying the OPMS API infrastructure using AWS CloudFormation templates. The deployment follows a specific order to ensure proper resource dependencies and parameter passing.

## Prerequisites

### AWS CLI Configuration
- Ensure you have AWS CLI installed and configured
- Use the `aws_cli_admin` profile for account `992382576482`
- Verify your AWS region is set to `us-west-1`

### Required AWS Resources
- **VPC**: `vpc-0374245a0431efd1e`
- **Subnets**: 
  - Subnet 1: `subnet-0f6ff18ee5a9c7b29`
  - Subnet 2: `subnet-07ebdc23cab656e21`
- **Security Groups**:
  - ALB Public Access: `sg-0e817112760176796`
  - ALB to Instances: `sg-0e44797047e65559f`
  - Node Instances: `sg-0e788bb40ae6dc9e6`
  - Restricted Access: `sg-0fba45b2463b776df`
- **IAM Role**: `arn:aws:iam::992382576482:instance-profile/opms-ec2`
- **Key Pair**: `opuzen_dev_opms`
- **ACM Certificate**: `arn:aws:acm:us-west-1:992382576482:certificate/cb9c2bc7-3457-45f3-9a9f-92d47d7c3a1d`
- **RDS Secret**: `arn:aws:secretsmanager:us-west-1:992382576482:secret:rds!cluster-2cc47963-bf79-4426-8b61-6aac4f194a15-BS8pVs`
- **App Secret**: `arn:aws:secretsmanager:us-west-1:992382576482:secret:Opuzen_Master_App_Secrets-RgGNj0`

### S3 User Data Scripts
Ensure the following scripts are uploaded to `s3://opuzen-scripts/user-data/`:
- `LaunchTemplateUserData-opms-api-InstallNodeJS-V1.sh`
- `LaunchTemplateUserData-opms-api-DeployApp-V1.sh`

## Deployment Order

**⚠️ CRITICAL: Templates must be deployed in this exact order to ensure proper parameter resolution.**

### 1. Application Load Balancer (ALB)
**Template**: `cloudform-OPMSapi-ALB-ALL-2025a.yaml`

**Purpose**: Creates the main Application Load Balancer that will serve all environments.

**Deployment Command**:
```bash
aws cloudformation create-stack \
  --stack-name OPMS-API-ALB-ALL \
  --template-body file://cloudform-OPMSapi-ALB-ALL-2025a.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --profile aws_cli_admin \
  --region us-west-1
```

**Wait for completion** before proceeding to step 2.

### 2. Launch Template
**Template**: `cloudForm-OPMSapi-LaunchTemp-DEV-2025a.yaml`

**Purpose**: Creates the launch template for DEV environment instances with user data scripts.

**Deployment Command**:
```bash
aws cloudformation create-stack \
  --stack-name OPMS-API-LaunchTemplate-DEV \
  --template-body file://cloudForm-OPMSapi-LaunchTemp-DEV-2025a.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --profile aws_cli_admin \
  --region us-west-1
```

**Wait for completion** and note the `LaunchTemplateId` output.

### 3. Target Group
**Template**: `cloudform-OPMSapi-TargetGrp-DEV-2025a.yaml`

**Purpose**: Creates the target group for routing traffic to DEV instances.

**Deployment Command**:
```bash
aws cloudformation create-stack \
  --stack-name OPMS-API-TargetGroup-DEV \
  --template-body file://cloudform-OPMSapi-TargetGrp-DEV-2025a.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --profile aws_cli_admin \
  --region us-west-1
```

**Wait for completion** and note the `TargetGroup` ARN output.

### 4. Integration (Listener, Rules, ASG)
**Template**: `cloudform-OPMSapi-Rules-Listener-TargetGrp-ASG-2025a.yaml`

**Purpose**: Creates the HTTPS listener, routing rules, and Auto Scaling Group for DEV environment.

**⚠️ IMPORTANT**: Update the template parameters with actual values from previous stacks:
- `LaunchTemplateIdDEV`: Use the LaunchTemplateId from step 2
- `TargetGrpDEV`: Use the TargetGroup ARN from step 3
- `AlbArn`: Use the ALB ARN from step 1

**Deployment Command**:
```bash
aws cloudformation create-stack \
  --stack-name OPMS-API-Integration-DEV \
  --template-body file://cloudform-OPMSapi-Rules-Listener-TargetGrp-ASG-2025a.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --profile aws_cli_admin \
  --region us-west-1
```

## Adding Additional Environments

To add QA and PROD environments, repeat steps 2-4 with environment-specific templates:

### QA Environment
1. **Launch Template**: `cloudForm-OPMSapi-LaunchTemp-QA-2025a.yaml`
2. **Target Group**: `cloudform-OPMSapi-TargetGrp-QA-2025a.yaml`
3. **Integration**: `cloudform-OPMSapi-Rules-Listener-TargetGrp-ASG-QA-2025a.yaml`

### PROD Environment
1. **Launch Template**: `cloudForm-OPMSapi-LaunchTemp-PROD-2025a.yaml`
2. **Target Group**: `cloudform-OPMSapi-TargetGrp-PROD-2025a.yaml`
3. **Integration**: `cloudform-OPMSapi-Rules-Listener-TargetGrp-ASG-PROD-2025a.yaml`

## Monitoring Deployment

### Check Stack Status
```bash
aws cloudformation describe-stacks \
  --stack-name <STACK_NAME> \
  --profile aws_cli_admin \
  --region us-west-1
```

### View Stack Outputs
```bash
aws cloudformation describe-stacks \
  --stack-name <STACK_NAME> \
  --query 'Stacks[0].Outputs' \
  --profile aws_cli_admin \
  --region us-west-1
```

### Check Stack Events
```bash
aws cloudformation describe-stack-events \
  --stack-name <STACK_NAME> \
  --profile aws_cli_admin \
  --region us-west-1
```

## Troubleshooting

### Common Issues

1. **Parameter Validation Errors**
   - Ensure all required parameters are provided
   - Verify parameter values match existing AWS resources

2. **Resource Dependency Errors**
   - Ensure templates are deployed in the correct order
   - Wait for each stack to complete before proceeding

3. **User Data Script Errors**
   - Verify S3 scripts exist and are accessible
   - Check script permissions and syntax

4. **Security Group Issues**
   - Ensure security groups allow proper traffic flow
   - Verify VPC and subnet associations

### Rollback Procedures

If a deployment fails:
1. **Delete the failed stack**:
   ```bash
   aws cloudformation delete-stack \
     --stack-name <FAILED_STACK_NAME> \
     --profile aws_cli_admin \
     --region us-west-1
   ```

2. **Wait for deletion to complete**

3. **Fix the issue** and redeploy

4. **Continue with the next template in sequence**

## Post-Deployment Verification

### Verify ALB Health
```bash
aws elbv2 describe-load-balancers \
  --names ALB-OPMS-API-ALL \
  --profile aws_cli_admin \
  --region us-west-1
```

### Verify Target Group Health
```bash
aws elbv2 describe-target-health \
  --target-group-arn <TARGET_GROUP_ARN> \
  --profile aws_cli_admin \
  --region us-west-1
```

### Verify Auto Scaling Group
```bash
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names ASG-OPMS-API-DEV \
  --profile aws_cli_admin \
  --region us-west-1
```

### Test Application Access
- Verify HTTPS listener responds on port 443
- Test domain routing (e.g., `opms-dev.opuzen-service.com`)
- Check application health endpoint

## Security Considerations

- **Network Security**: All instances are in private subnets with restricted access
- **SSL/TLS**: HTTPS traffic is encrypted using ACM certificate
- **IAM Roles**: Instances use least-privilege IAM roles
- **Security Groups**: Traffic is restricted to necessary ports and sources

## Cost Optimization

- **Instance Types**: Uses cost-effective t4g.small instances
- **Auto Scaling**: Automatically scales based on demand (1-3 instances)
- **Reserved Instances**: Consider purchasing RIs for production workloads

## Support and Maintenance

- **Monitoring**: Use CloudWatch for metrics and alarms
- **Logging**: Application logs are stored in `/var/log/app-deployment.log`
- **Updates**: Deploy updates via GitHub Actions workflow
- **Backup**: EFS provides persistent storage with automatic backups

---

**⚠️ IMPORTANT REMINDER**: Always deploy templates in the specified order and wait for each stack to complete before proceeding to the next step.
