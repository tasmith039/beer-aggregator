FROM node:18-alpine

RUN mkdir -p /home/node/app/node_modules &&  mkdir -p /home/node/app/web/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY package.json ./

COPY web/package.json ./web/

USER node

COPY --chown=node:node . .

RUN npm install

WORKDIR /home/node/app/web

RUN npm install

RUN npm run build

EXPOSE 3000

CMD [ "node", "index.js" ]