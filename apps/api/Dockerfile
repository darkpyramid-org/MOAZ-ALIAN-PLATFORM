# Production image for the MOAZ ALIAN library API (Express 5 port).
# Build (from apps/api/): docker build -t moaz-alian-api-node .
# Run:                     docker run -p 5199:5199 \
#                            -e DATABASE_URL="postgresql://…?schema=library" \
#                            -e AUTH_JWT_SECRET="<32+ chars>" \
#                            moaz-alian-api-node
FROM node:24-alpine AS build
WORKDIR /app

# Enable pnpm via corepack (the monorepo's sole package manager).
RUN corepack enable

# Copy workspace manifests first so dependency layers cache independently of source.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
RUN pnpm --filter @moaz/api install --no-frozen-lockfile

COPY apps/api apps/api
RUN cd apps/api && pnpm prisma generate && pnpm build

# ---- runtime ----
FROM node:24-alpine
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production

# Only the API workspace's production dependencies + built output travel forward.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY package.json pnpm-workspace.yaml ./

WORKDIR /app/apps/api

# One container, one concern: the API. TLS termination stays at the reverse proxy.
EXPOSE 5199
CMD ["node", "dist/index.js"]
