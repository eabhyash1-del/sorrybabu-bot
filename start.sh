#!/bin/bash

# Quick Start Script for SorryBabu Bot
# This script helps set up and run the bot locally

set -e

echo "🚀 SorryBabu Bot - Quick Start Script"
echo "====================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "📲 Install from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your BOT_TOKEN"
    echo ""
    echo "To get a bot token:"
    echo "1. Open Telegram and search for @BotFather"
    echo "2. Send /newbot command"
    echo "3. Follow instructions to create your bot"
    echo "4. Copy the token and paste it in .env"
    echo ""
    exit 1
fi

# Check if BOT_TOKEN is set
if grep -q "BOT_TOKEN=your_bot_token_here" .env; then
    echo "❌ BOT_TOKEN is not configured in .env"
    echo "📝 Please edit .env and add your actual bot token"
    exit 1
fi

echo "✅ .env is configured"
echo ""

# Start the bot
echo "🤖 Starting SorryBabu Bot..."
echo "📱 Test the bot: https://t.me/sorrybabubot?start=testvideo1"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm start
