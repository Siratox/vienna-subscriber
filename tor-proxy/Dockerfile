# use Ubuntu as base image
FROM ubuntu:latest

# install tor
RUN apt-get update && apt-get install -y \
    tor \
    gettext-base

# copy tor configuration file into container
COPY torrc.template /etc/tor/torrc.template

# expose the default Tor SOCKS and Tor Control port
EXPOSE 9050 9051

# configure and start Tor
CMD envsubst < /etc/tor/torrc.template > /etc/tor/torrc && tor -f /etc/tor/torrc
