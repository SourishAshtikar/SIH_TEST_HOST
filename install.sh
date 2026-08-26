#!/bin/bash

# Groundwater & Agricultural Irrigation Platform Setup Script
# Targets macOS, Linux, and git bash/WSL on Windows

# Exit immediately if a command exits with a non-zero status
set -e

# Color definitions
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0;m' # No Color

echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}   Groundwater Platform - Installation Script     ${NC}"
echo -e "${GREEN}==================================================${NC}"

# 1. Check Node.js
echo -e "\n${YELLOW}[1/4] Checking Node.js installation...${NC}"
if command -v node >/dev/null 2>&1; then
    nodeVer=$(node --version)
    echo -e "${GREEN}✅ Node.js is installed ($nodeVer)${NC}"
else
    echo -e "${RED}❌ Node.js is not installed or not in PATH!${NC}"
    echo "Please download and install Node.js (v18 or higher) from https://nodejs.org/"
    exit 1
fi

# 2. Check Python
echo -e "\n${YELLOW}[2/4] Checking Python installation...${NC}"
PYTHON_CMD=""
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
fi

if [ -n "$PYTHON_CMD" ]; then
    pyVer=$($PYTHON_CMD --version 2>&1)
    echo -e "${GREEN}✅ Python is installed ($pyVer)${NC}"
else
    echo -e "${RED}❌ Python is not installed or not in PATH!${NC}"
    echo "Please download and install Python (v3.8 or higher) from https://www.python.org/"
    exit 1
fi

# 3. Install Node.js Packages
echo -e "\n${YELLOW}[3/4] Installing Node.js dependencies in /backend...${NC}"
if cd backend; then
    echo "Running npm install..."
    npm install
    cd ..
    echo -e "${GREEN}✅ Node.js dependencies installed successfully.${NC}"
else
    echo -e "${RED}❌ Failed to navigate to backend directory!${NC}"
    exit 1
fi

# 4. Setup Python Virtual Environment and Packages
echo -e "\n${YELLOW}[4/4] Setting up Python virtual environment (.venv)...${NC}"
GLOBAL_FALLBACK=0
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment at .venv..."
    if $PYTHON_CMD -m venv .venv; then
        echo -e "${GREEN}✅ Virtual environment created successfully.${NC}"
    else
        echo -e "${YELLOW}⚠️ Failed to create virtual environment! Attempting to install packages globally (fallback)...${NC}"
        if $PYTHON_CMD -m pip install -r requirements.txt; then
            echo -e "${GREEN}✅ Python packages installed globally.${NC}"
            GLOBAL_FALLBACK=1
        else
            echo -e "${RED}❌ Global package installation also failed.${NC}"
            exit 1
        fi
    fi
else
    echo -e "${GREEN}✅ Virtual environment already exists.${NC}"
fi

if [ $GLOBAL_FALLBACK -eq 0 ]; then
    echo "Installing Python packages in virtual environment..."
    PIP_PATH=".venv/bin/pip"
    if [ ! -f "$PIP_PATH" ]; then
        PIP_PATH=".venv/bin/python"
        PIP_ARGS=(-m pip install -r requirements.txt)
    else
        PIP_ARGS=(install -r requirements.txt)
    fi

    if "$PIP_PATH" "${PIP_ARGS[@]}"; then
        echo -e "${GREEN}✅ Python packages installed successfully.${NC}"
    else
        echo -e "${RED}❌ Failed to install Python dependencies in virtual environment!${NC}"
        exit 1
    fi
fi

# Make install.sh executable (helpful on Unix systems)
chmod +x install.sh 2>/dev/null || true

echo -e "\n${GREEN}==================================================${NC}"
echo -e "${GREEN}     Setup completed successfully!                ${NC}"
echo -e "${GREEN}==================================================${NC}"
echo "To start the development server:"
echo "1. Activate Python virtual environment (recommended):"
echo "   source .venv/bin/activate"
echo "2. Navigate to backend directory:"
echo "   cd backend"
echo "3. Start the application (starts both Express & FastAPI):"
echo "   npm start"
echo -e "${GREEN}==================================================${NC}"
