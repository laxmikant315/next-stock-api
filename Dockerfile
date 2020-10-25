FROM node:12.19.0

WORKDIR /usr/src/next-stock-api

COPY ./ ./

RUN npm install

CMD ["/bin/bash"]
