# Multi-stage build for e-Traffic System

# Stage 1: Build the React client
FROM node:18 AS client-builder

# Set working directory for client
WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install client dependencies
RUN npm ci

# Copy client source code
COPY client/ ./

# Build the React app
RUN npm run build

# Stage 2: Build the server
FROM node:18-alpine AS server-builder

# Set working directory for server
WORKDIR /app

# Copy server package files
COPY server/package*.json ./

# Install server dependencies
RUN npm ci --only=production

# Copy server source code
COPY server/ ./

# Stage 3: Final production image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy built client files from client-builder stage
COPY --from=client-builder /app/client/build ./public

# Copy server files from server-builder stage
COPY --from=server-builder /app ./

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]
