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

section "Mosaic Browser Setup"

if ! command -v bun &> /dev/null; then
    warn "Bun is not installed."
    echo "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    
    if [ -f "$HOME/.bashrc" ]; then
        source "$HOME/.bashrc"
    elif [ -f "$HOME/.zshrc" ]; then
        source "$HOME/.zshrc"
    fi
    
    if ! command -v bun &> /dev/null; then
        error "Bun installation failed. Please install manually:"
        echo "  curl -fsSL https://bun.sh/install | bash"
        exit 1
    fi
    info "Bun installed successfully!"
else
    info "Bun is already installed: $(bun --version)"
fi

section "Installing Dependencies"
info "Installing project dependencies..."
bun install

section "Environment Configuration"
if [ ! -f ".env.local" ]; then
    warn ".env.local file not found."
    echo "Creating .env.local template..."
    cat > .env.local << EOF
GEMINI_API_KEY=your-api-key-here
EOF
    warn "Please update .env.local with your GEMINI_API_KEY"
else
    info ".env.local file exists"
fi

section "Setup Complete!"
info "You can now run:"
echo "  bun run dev    - Start Mosaic development server"
echo "  bun start      - Build and run Mosaic app"
echo "  ./start.sh     - Quick start script"
