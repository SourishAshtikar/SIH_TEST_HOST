# 1. Use a stable Node.js Debian-based slim image
FROM node:18-bullseye-slim

# 2. Install Python, pip, and venv tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# 3. Set the working directory to the app root
WORKDIR /app

# 4. Copy all project files into the container
COPY . .

# 5. Create Python virtual environment inside /backend (where Node expects it)
# and install all Python ML dependencies
RUN python3 -m venv backend/.venv \
    && ./backend/.venv/bin/pip install --upgrade pip \
    && ./backend/.venv/bin/pip install -r requirements.txt

# 6. Change working directory to /backend to install Node.js dependencies
WORKDIR /app/backend
RUN npm install

# 7. Expose the Node.js Express server port (default 3000)
EXPOSE 3000

# 8. Start the Express backend (which auto-spawns Python on port 8000)
CMD ["npm", "start"]
