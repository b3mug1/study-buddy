FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy server and prebuilt frontend
COPY server ./server
COPY dist ./dist

EXPOSE 1000
ENV API_PROXY_PORT=1000
CMD ["node", "server/index.mjs", "--production"]
