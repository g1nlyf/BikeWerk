FROM mcr.microsoft.com/playwright:v1.47.0-jammy

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Install root dependencies
RUN npm install

# Copy autocat-klein package files
COPY autocat-klein/package*.json ./autocat-klein/

# Install module dependencies
WORKDIR /app/autocat-klein
RUN npm install

# Return to root
WORKDIR /app

# Copy source code
COPY . .

# Build autocat-klein (if needed, or just run ts-node)
# We will run with ts-node for simplicity as per scripts
WORKDIR /app/autocat-klein

# Set default command
CMD ["npm", "run", "autocat", "--", "--count=100"]
