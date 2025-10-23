#!/bin/bash

# EventTria Deployment Script for Hostinger KVM/VPS
# Run this script on your server after uploading the project

echo "🚀 Starting EventTria deployment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Installing Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Check Node.js version
NODE_VERSION=$(node -v)
echo "✅ Node.js version: $NODE_VERSION"

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the application
echo "🔨 Building application..."
npm run build

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'eventtria',
    script: 'npm',
    args: 'start',
    cwd: './',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
EOF

# Stop existing PM2 process if running
pm2 stop eventtria 2>/dev/null || true
pm2 delete eventtria 2>/dev/null || true

# Start the application with PM2
echo "🚀 Starting application with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup

echo "✅ Deployment completed!"
echo "📊 Application status:"
pm2 status

echo ""
echo "🌐 Your application should be running on port 3000"
echo "🔧 Use 'pm2 logs eventtria' to view logs"
echo "🔄 Use 'pm2 restart eventtria' to restart the app"
echo "⏹️  Use 'pm2 stop eventtria' to stop the app"
