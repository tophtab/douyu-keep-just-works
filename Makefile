IMAGE ?= tophtab/douyu-keep-just-works
TAG ?= local
PLATFORM ?= linux/amd64
DOCKERFILE ?= ./Dockerfile

.PHONY: docker-check docker-build docker-up docker-logs docker-down

docker-check:
	npm ci --ignore-scripts
	npm run type-check

docker-build:
	docker buildx build --platform $(PLATFORM) --file $(DOCKERFILE) --tag $(IMAGE):$(TAG) --load .

docker-up:
	DOCKER_IMAGE=$(IMAGE) DOCKER_TAG=$(TAG) docker compose up -d

docker-logs:
	DOCKER_IMAGE=$(IMAGE) DOCKER_TAG=$(TAG) docker compose logs -f

docker-down:
	DOCKER_IMAGE=$(IMAGE) DOCKER_TAG=$(TAG) docker compose down
