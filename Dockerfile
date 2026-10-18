FROM node:24-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine3.24 AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy only Node and application dependencies. npm, npx, Yarn and their unused
# dependency trees belong to the build stages, not the public game container.
FROM alpine:3.24 AS runtime
RUN apk upgrade --no-cache \
    && apk add --no-cache libstdc++ ca-certificates \
    && addgroup -g 1000 node \
    && adduser -u 1000 -G node -s /sbin/nologin -D node
COPY --from=dependencies /usr/local/bin/node /usr/local/bin/node
COPY --from=dependencies /usr/local/LICENSE /usr/local/share/licenses/node/LICENSE
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5173
ENV ARENA_DATA_DIR=/app/data/creator
COPY package.json package-lock.json ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/scripts/creator-import.ts ./scripts/creator-import.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME ["/app/data"]
EXPOSE 5173
USER node
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5173)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "--import", "tsx", "server/index.ts"]
