FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy your custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static assets into the Nginx serving directory
COPY index.html /usr/share/nginx/html/
COPY help.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/
