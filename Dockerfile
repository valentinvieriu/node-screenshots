FROM node:9.5.0 as build
# set our node environment, either development or production
# defaults to production, compose overrides this to development on build and run
ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV
# install dependencies first, in a different location for easier app bind mounting for local development
WORKDIR /usr/src
COPY package.json /usr/src
COPY package-lock.json /usr/src
RUN npm set progress=false && \
npm config set depth 0 && \
npm install && \
npm cache clean --force && \
rm -rf /tmp/*

FROM node:9.5.0-slim
# copy in our source code last, as it changes the most
WORKDIR /usr/src/app
ENV PATH /usr/src/node_modules/.bin:$PATH

COPY --from=build /usr/src /usr/src
COPY . /usr/src/app

# set our node environment, either development or production
# defaults to production, compose overrides this to development on build and run
ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV

# check every 30s to ensure this service returns HTTP 200
# HEALTHCHECK CMD curl -fs http://localhost:$PORT/ || exit 1
# default to port 80 for node, and 5858 or 9229 for debug
ARG PORT=80
ENV PORT $PORT
EXPOSE $PORT 5858 9229
CMD [ "node","--harmony", "app.js" ]