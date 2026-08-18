#!/bin/bash
# Server Setup Script for Core Bridge POS
# Usage: sudo ./server-setup.sh

set -e

echo "=========================================="
echo "  Server Setup for Core Bridge POS"
echo "=========================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo $0"
  exit 1
fi

# Update system
echo "Updating system..."
apt-get update && apt-get upgrade -y

# Install Node.js 20
echo "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verify Node.js
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Install Supervisor
echo "Installing Supervisor..."
apt-get install -y supervisor

# Create app directory
echo "Creating app directory..."
mkdir -p /opt/core-bridge-pos
mkdir -p /var/log/core-bridge-pos

# Set permissions
chown -R www-data:www-data /opt/core-bridge-pos
chown -R www-data:www-data /var/log/core-bridge-pos

echo "=========================================="
echo "  Server setup completed!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Clone repository to /opt/core-bridge-pos"
echo "2. Setup Supervisor config: cp scripts/supervisor.conf /etc/supervisor/conf.d/"
echo "3. Configure GitHub Secrets with SSH keys"
echo "4. Setup environment variables in /etc/environment or .env"
