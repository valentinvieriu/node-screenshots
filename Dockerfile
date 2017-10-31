FROM node:8.8.1
WORKDIR /app

#we want to cache the the npm install
COPY package.json .
COPY package-lock.json .
# Install app dependencies
RUN npm install

# Adding the rest of the app source
COPY . .

EXPOSE 80
CMD [ "node","--harmony", "app.js" ]