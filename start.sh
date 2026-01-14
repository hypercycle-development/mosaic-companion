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

if ! command -v bun &> /dev/null; then
    error "Bun is not installed. Please install it first:"
    echo "  curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

info "Bun version: $(bun --version)"

if [ -d "node_modules" ] && [ -f "bun.lockb" ]; then
    info "Dependencies already installed. Skipping install..."
    read -p "Reinstall dependencies? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info "Installing dependencies..."
        bun install
    fi
else
    info "Installing dependencies..."
    bun install
fi

info "Starting application..."
bun start