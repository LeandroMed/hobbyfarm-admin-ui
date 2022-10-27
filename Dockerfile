##### sdk image #####
FROM node:lts-alpine3.10 AS sdk

RUN apk add python make g++

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build:prod


###### release image #####
FROM nginx:stable-alpine

COPY --from=sdk /app/dist/* /usr/share/nginx/html

# copy staged files
COPY cicd/stage-release/ /

ENTRYPOINT ["entrypoint.sh"]
