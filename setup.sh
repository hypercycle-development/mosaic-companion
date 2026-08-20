#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() {
    echo -e "${GREEN}ℹ${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✖${NC} $1"
}

section() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

section "Mosaic Companion Setup"

if ! command -v node &> /dev/null; then
    error "Node.js is not installed."
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
else
    info "Node.js is already installed: $(node --version)"
fi

if ! command -v npm &> /dev/null; then
    error "npm is not installed."
    echo "Please install Node.js from https://nodejs.org/ (npm is included)"
    exit 1
else
    info "npm is already installed: $(npm --version)"
fi

section "Installing Dependencies"
info "Installing project dependencies..."
npm install

section "Setup Complete!"
info "You can now run:"
echo "  npm run dev    - Start Mosaic development server"
echo "  npm start      - Build and run Mosaic app"
echo ""
info "Configure your AI provider key inside the app:"
echo "  use the onboarding wizard on first launch, or Configuration → AI Agents"
