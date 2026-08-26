# Groundwater & Agricultural Irrigation Platform Setup Script
# Targets Windows PowerShell / pwsh

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Groundwater Platform - Installation Script     " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Check Node.js
Write-Host "`n[1/4] Checking Node.js installation..." -ForegroundColor Yellow
try {
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $nodeVer = node --version
        Write-Host "✅ Node.js is installed ($nodeVer)" -ForegroundColor Green
    } else {
        throw "Node.js executable not found in PATH."
    }
} catch {
    Write-Host "❌ Node.js is not installed or not in PATH!" -ForegroundColor Red
    Write-Host "Please download and install Node.js from https://nodejs.org/" -ForegroundColor Gray
    Write-Host "Recommended version: LTS (v18 or higher)" -ForegroundColor Gray
    Exit 1
}

# 2. Check Python
Write-Host "`n[2/4] Checking Python installation..." -ForegroundColor Yellow
$pythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
}

if ($pythonCmd) {
    try {
        $pyVer = & $pythonCmd --version 2>&1
        Write-Host "✅ Python is installed ($pyVer)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Found python command but failed to retrieve version." -ForegroundColor Red
        Exit 1
    }
} else {
    Write-Host "❌ Python is not installed or not in PATH!" -ForegroundColor Red
    Write-Host "Please download and install Python from https://www.python.org/" -ForegroundColor Gray
    Write-Host "Ensure you check the box that says 'Add Python to PATH' during installation." -ForegroundColor Gray
    Write-Host "Recommended version: v3.8 to v3.11" -ForegroundColor Gray
    Exit 1
}

# 3. Install Node.js Packages
Write-Host "`n[3/4] Installing Node.js dependencies in /backend..." -ForegroundColor Yellow
try {
    Push-Location backend
    Write-Host "Running npm install..." -ForegroundColor Gray
    npm install
    Pop-Location
    Write-Host "✅ Node.js dependencies installed successfully." -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install Node.js dependencies!" -ForegroundColor Red
    Pop-Location
    Exit 1
}

# 4. Setup Python Virtual Environment and Packages
Write-Host "`n[4/4] Setting up Python virtual environment (.venv)..." -ForegroundColor Yellow
$venvDir = Join-Path (Get-Location) ".venv"
if (!(Test-Path $venvDir)) {
    Write-Host "Creating virtual environment at $venvDir..." -ForegroundColor Gray
    try {
        & $pythonCmd -m venv .venv
        Write-Host "✅ Virtual environment created successfully." -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to create virtual environment! Attempting to install packages globally (fallback)..." -ForegroundColor Yellow
        try {
            & $pythonCmd -m pip install -r requirements.txt
            Write-Host "✅ Python packages installed globally." -ForegroundColor Green
            $globalFallback = $true
        } catch {
            Write-Host "❌ Global package installation also failed." -ForegroundColor Red
            Exit 1
        }
    }
} else {
    Write-Host "✅ Virtual environment already exists." -ForegroundColor Green
}

if (!$globalFallback) {
    Write-Host "Installing Python packages in virtual environment..." -ForegroundColor Gray
    $pipPath = Join-Path $venvDir "Scripts\pip.exe"
    if (!(Test-Path $pipPath)) {
        # Fallback to python.exe -m pip
        $pipPath = Join-Path $venvDir "Scripts\python.exe"
        $pipArgs = @("-m", "pip", "install", "-r", "requirements.txt")
    } else {
        $pipArgs = @("install", "-r", "requirements.txt")
    }

    try {
        & $pipPath $pipArgs
        Write-Host "✅ Python packages installed successfully." -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to install Python dependencies in virtual environment!" -ForegroundColor Red
        Exit 1
    }
}

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "     Setup completed successfully!                " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "To start the development server:"
Write-Host "1. Activate Python virtual environment (recommended):"
Write-Host "   .venv\Scripts\Activate.ps1"
Write-Host "2. Navigate to backend directory:"
Write-Host "   cd backend"
Write-Host "3. Start the application (starts both Express & FastAPI):"
Write-Host "   npm start"
Write-Host "==================================================" -ForegroundColor Green
