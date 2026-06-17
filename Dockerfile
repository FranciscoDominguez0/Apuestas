FROM node:22-alpine

# Crear el directorio de la aplicación
WORKDIR /usr/src/app

# Copiar dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Exponer el puerto donde correrá Node.js
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["node", "server.js"]
