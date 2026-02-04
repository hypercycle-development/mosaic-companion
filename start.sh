#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

if ! command -v node &> /dev/null; then
    error "Node.js is not installed. Please install it from https://nodejs.org/"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    error "npm is not installed. Please install Node.js from https://nodejs.org/"
    exit 1
fi

info "Node.js version: $(node --version)"
info "npm version: $(npm --version)"

if [ -d "node_modules" ] && [ -f "package-lock.json" ]; then
    info "Dependencies already installed. Skipping install..."
    read -p "Reinstall dependencies? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info "Installing dependencies..."
        npm install
    fi
else
    info "Installing dependencies..."
    npm install
fi

info "Starting Mosaic application..."
npm start