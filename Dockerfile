# Multi-stage build for e-Traffic System (Updated for Railway) - CACHE BUSTER: 2025-08-31

# Stage 1: Build the server
FROM node:18-alpine AS server-builder

# Set working directory for server
WORKDIR /app

# Copy server package files
COPY server/package*.json ./

# Install server dependencies
RUN npm ci --only=production

# Copy server source code
COPY server/ ./

# Stage 2: Final production image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy server files from server-builder stage
COPY --from=server-builder /app ./

# Copy pre-built client files (these should be in server/public)
COPY server/public ./public

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
