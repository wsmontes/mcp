#!/bin/bash

# MCP-Tabajara Anthropic Proxy Server Startup Script

echo "🚀 Starting MCP-Tabajara Anthropic Proxy Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
fi

# Start the proxy server
echo "🌐 Starting proxy server on http://localhost:3001"
echo "📡 Proxying Anthropic API requests"
echo "🔧 Health check available at: http://localhost:3001/health"
echo ""
echo "⚠️  IMPORTANT: Keep this terminal open while using Claude models"
echo "   To stop the server, press Ctrl+C"
echo ""

npm start 