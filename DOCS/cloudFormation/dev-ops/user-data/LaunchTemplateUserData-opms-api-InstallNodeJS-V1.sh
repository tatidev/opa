#!/bin/bash
# Set environment variables from ~positional parameters~
APP_ENV="$1"
APP_NAME="$2"
SECRET_ID="$3"
DB_HOST="$4"

# Convert to lowercase
APP_ENV=$(echo "$APP_ENV" | tr '[:upper:]' '[:lower:]')
APP_NAME=$(echo "$APP_NAME" | tr '[:upper:]' '[:lower:]')

# Export variables for future use
echo "export SECRET_ID=${SECRET_ID}" >> /etc/environment
echo "export DB_HOST=${DB_HOST}" >> /etc/environment
echo "export PathToAppRoot=/opuzen-efs/${APP_ENV}/${APP_NAME}" >> /etc/environment
#===============================
# Install NFS client
#===============================
apt-get update
apt-get install -y nfs-common
apt autoremove -y
#===============================
# Mount EFS 
#===============================
mkdir -p /opuzen-efs
sudo mount -t nfs4 -o nfsvers=4.1,rsize=1048576,wsize=1048576,hard,timeo=600,retrans=2,noresvport fs-02b00efdea45171a7.efs.us-west-1.amazonaws.com:/ /opuzen-efs
#===============================
# Mount EFS on Reboot
#===============================
echo "fs-02b00efdea45171a7.efs.us-west-1.amazonaws.com:/ /opuzen-efs nfs4 nfsvers=4.1,rsize=1048576,wsize=1048576,hard,timeo=600,retrans=2,noresvport,_netdev 0 0" >> /etc/fstab
#===============================
# Configure AWS Secrets manager
#===============================
# Install dependencies
apt-get install -y unzip curl jq
#-----------------------------------------------------------------------
# Determine the architecture and install the appropriate AWS CLI version
# Commented out because this happens in the init user data 
# of the Launch Template
#-----------------------------------------------------------------------
# ARCH=$(uname -m)
# if [ "$ARCH" = "x86_64" ]; then
#   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
# elif [ "$ARCH" = "aarch64" ]; then
#   curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
# else
#   echo "Unsupported architecture: $ARCH"
#   exit 1
# fi
# unzip awscliv2.zip
# ./aws/install
#-----------------------------------------
# Retrieve the secret from Secrets Manager
#-----------------------------------------
SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ID" --region us-west-1 --query 'SecretString' --output text)
DB_USERNAME=$(echo $SECRET_JSON | jq -r '.username')
DB_PASSWORD=$(echo $SECRET_JSON | jq -r '.password')
# Construct the DB_CONN string with appropriate escaping
DB_CONN="mysql -h $DB_HOST -u $DB_USERNAME -p\"$DB_PASSWORD\""
#-------------------------------
# Use the credentials as needed
#-------------------------------
echo "DB Username: $DB_USERNAME"
echo "DB Password: $DB_PASSWORD"
#-------------------------------
# Set environment variables
#-------------------------------
echo "export DB_USERNAME='$DB_USERNAME'" >> /etc/profile.d/db_credentials.sh
echo "export DB_USER='$DB_USERNAME'" >> /etc/profile.d/db_credentials.sh
echo "export DB_PASSWORD='$DB_PASSWORD'" >> /etc/profile.d/db_credentials.sh
echo "export DB_HOST='$DB_HOST'" >> /etc/profile.d/db_credentials.sh
echo "export DB_CONN='$DB_CONN'" >> /etc/profile.d/db_credentials.sh
# Also add them to /etc/environment
echo "DB_USERNAME='$DB_USERNAME'" >> /etc/environment
echo "DB_USER='$DB_USERNAME'" >> /etc/environment
echo "DB_PASSWORD='$DB_PASSWORD'" >> /etc/environment
echo "DB_HOST='$DB_HOST'" >> /etc/environment
echo "DB_NAME='opuzen_${APP_ENV}_master_app'" >> /etc/environment
echo "DB_CONN='$DB_CONN'" >> /etc/environment
#-------------------------------
# Install rsync
# used for code deployment
#-------------------------------
sudo apt-get install -y rsync
#-------------------------------
# Install the CodeDeploy agent
#-------------------------------
# Install Ruby if not already installed
if ! command -v ruby &> /dev/null; then
  sudo apt-get install -y ruby
fi
# Define the region
REGION="us-west-1"
# Use AWS CLI to download the CodeDeploy agent installer
aws s3 cp s3://aws-codedeploy-${REGION}/latest/install . --region ${REGION}
# Make the installer executable
chmod +x ./install
# Install the CodeDeploy agent
sudo ./install auto
# Start the CodeDeploy agent
sudo service codedeploy-agent start
# Check the status of the CodeDeploy agent
sudo service codedeploy-agent status
# Clean up the installer
rm ./install
#-------------------------------
# Associate the Elastic IP (DISABLED - conflicts with multiple instances)
#-------------------------------
# sudo apt-get install cloud-utils -y
# INSTANCE_ID=$(ec2metadata --instance-id)
# REGION="us-west-1"
# ELASTIC_IP="eipalloc-0912b5bddbb4eb05f"
# aws ec2 associate-address --instance-id $INSTANCE_ID --allocation-id $ELASTIC_IP --region $REGION
#----------------------------------
# Redirect all output to a log file
#----------------------------------
exec > /var/log/user-data.log 2>&1
echo "All done!"
echo "The user data script has finished execution at $(date)"
echo "You may check the log file for any errors at /var/log/user-data.log"
#----------------------------------
# Configure SSH for key-based auth
#----------------------------------
# User-data script to create an SSH key pair
# Define variables
KEY_USER=ubuntu
KEY_NAME="rsa"
KEY_DIR="/home/$KEY_USER/.ssh"
KEY_FILE="$KEY_DIR/$KEY_NAME"
# Create the .ssh directory if it doesn't exist
mkdir -p $KEY_DIR
chmod 700 $KEY_DIR
# Generate the SSH key pair
ssh-keygen -t rsa -b 2048 -f $KEY_FILE -N ""
# Set the correct permissions
chmod 600 $KEY_FILE
chmod 644 ${KEY_FILE}.pub
# Output the public key (optional)
echo the key owner is: $KEY_USER
echo the key dir is: $KEY_DIR
echo "The public key is:"
cat ${KEY_FILE}.pub
# Ensure the user owns the .ssh directory and its contents
chown -R $KEY_USER:$KEY_USER $KEY_DIR
# User-data script to configure SSH for key-based authentication only
# Disable password authentication and challenge-response authentication
sed -i 's/^#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#ChallengeResponseAuthentication yes/ChallengeResponseAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^ChallengeResponseAuthentication yes/ChallengeResponseAuthentication no/' /etc/ssh/sshd_config
# Ensure PubkeyAuthentication is enabled
sed -i 's/^#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config
# Restart the SSH service to apply changes
systemctl restart sshd
#===============================
# Install Node.js 18.x LTS
#===============================
echo "Installing Node.js 18.x LTS..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify Node.js installation
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

#===============================
# Install PM2 for process management
#===============================
echo "Installing PM2..."
npm install -g pm2

# Verify PM2 installation
echo "PM2 version: $(pm2 --version)"

#===============================
# Install additional Node.js dependencies
#===============================
echo "Installing additional Node.js dependencies..."
apt-get install -y git build-essential

#===============================
# Create application directory structure
#===============================
echo "Setting up application directory structure..."
mkdir -p ${PathToAppRoot}
chown -R ubuntu:ubuntu ${PathToAppRoot}

#===============================
# Set up Node.js environment variables
#===============================
echo "Setting up Node.js environment variables..."
echo "export NODE_ENV=${APP_ENV}" >> /etc/environment
echo "export PORT=3000" >> /etc/environment
echo "export PATH=/usr/bin:$PATH" >> /etc/environment

#===============================
# Configure UFW Firewall for Node.js
#===============================
echo "Configuring UFW firewall for Node.js port 3000..."
# Allow port 3000 from VPC CIDR block (ALB and internal traffic)
ufw allow from 10.0.0.0/16 to any port 3000
ufw status
echo "✅ Port 3000 allowed from VPC (10.0.0.0/16) for ALB access"

#===============================
# Configure PM2 startup
#===============================
echo "Configuring PM2 startup..."
sudo -u ubuntu pm2 startup systemd -u ubuntu --hp /home/ubuntu

#===============================
# Set proper permissions for Node.js
#===============================
echo "Setting proper permissions for Node.js..."
chown -R ubuntu:ubuntu /home/ubuntu/.pm2
chown -R ubuntu:ubuntu ${PathToAppRoot}

echo "Node.js installation and configuration completed successfully!"


