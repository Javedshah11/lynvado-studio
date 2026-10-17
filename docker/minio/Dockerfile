FROM golang:1.24-alpine AS builder

ARG MINIO_VERSION

RUN CGO_ENABLED=0 go install github.com/minio/minio@${MINIO_VERSION}

FROM alpine:3.22

RUN apk add --no-cache ca-certificates curl

COPY --from=builder /go/bin/minio /usr/local/bin/minio

EXPOSE 9000 9001

ENTRYPOINT ["minio"]
