# OpenClaw Dashboard - Railway Deployment
FROM node:20-alpine

WORKDIR /app

# Copy backend package.json first for better caching
COPY backend/package.json backend/

# Install backend dependencies
RUN cd backend && npm install

# Copy all files
COPY . .

# Railway injects PORT dynamically
ENV PORT=3001

# Expose port
EXPOSE ${PORT}

# Start the backend server
CMD ["node", "backend/server.js"]
