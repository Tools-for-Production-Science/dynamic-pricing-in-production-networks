#FROM python:3
FROM node:14-buster

# Create app directory
WORKDIR /usr/src/app


COPY . .
#COPY ./.git ./.git

RUN npm install
RUN npm install -g typescript
RUN npm run build

EXPOSE 3001

CMD [ "npm", "run", "start"]
