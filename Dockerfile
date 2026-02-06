# OpenClaw Dashboard - Railway Deployment
FROM node:20-alpine

WORKDIR /app

# Copy backend package.json first for better caching
COPY backend/package.json backend/

# Install backend dependencies
RUN cd backend && npm install

# Copy all files
COPY . .

# Expose port
EXPOSE 3001

# Start the backend server
CMD ["node", "backend/server.js"]
