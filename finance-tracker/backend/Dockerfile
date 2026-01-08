FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create directories for data
RUN mkdir -p /app/data /app/uploads

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
