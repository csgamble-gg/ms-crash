FROM node:12-alpine as Builder

WORKDIR /app

ENV SERVICE_NAME=ms-graphql

ARG NPM_TOKEN_GITHUB

# Copy package.json and package-lock.json to /app
COPY .npmrc ./
COPY .yarnrc ./
COPY ["package.json", "/app"]
COPY ["yarn.lock", "/app"]

# Run npm install and remove credentials from image
RUN yarn install && rm .npmrc

COPY [".", "./"]

RUN yarn run build

FROM node:12-alpine as Worker
COPY --from=Builder /app .

# Run the server when the container starts
CMD ["node", "dist/server.js"]