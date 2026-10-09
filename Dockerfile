FROM node:20-alpine

LABEL org.opencontainers.image.title="proxy-ip-check" \
      org.opencontainers.image.description="Zero-dependency CLI and library: look up an IP's ASN, ISP, country and network type (residential vs hosting vs proxy). No API key required." \
      org.opencontainers.image.url="https://socks5ip.com.cn/ip-check-center/" \
      org.opencontainers.image.source="https://github.com/socks5ip/proxy-ip-check" \
      org.opencontainers.image.documentation="https://github.com/socks5ip/proxy-ip-check#readme" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.vendor="socks5ip"

WORKDIR /app
COPY package.json index.js README.md LICENSE ./

# Deterministic, network-free install: the package has zero dependencies,
# so we only need the executable on PATH.
RUN chmod +x /app/index.js && ln -sf /app/index.js /usr/local/bin/proxy-ip-check

USER node

ENTRYPOINT ["proxy-ip-check"]
CMD ["8.8.8.8"]
