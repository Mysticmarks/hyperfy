variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
}

variable "project" {
  description = "Project name prefix used for tagging and resource names"
  type        = string
  default     = "hyperfy"
}

variable "domain" {
  description = "Root domain used for public endpoints (api.<domain>, livekit.<domain>, etc.)"
  type        = string
}

variable "api_certificate_arn" {
  description = "ACM certificate ARN used for the Fastify API load balancer"
  type        = string
}

variable "livekit_certificate_arn" {
  description = "ACM certificate ARN used for the LiveKit load balancer"
  type        = string
}

variable "sim_certificate_arn" {
  description = "ACM certificate ARN used for the simulation servers load balancer"
  type        = string
}

variable "cdn_certificate_arn" {
  description = "ACM certificate ARN used for the CloudFront distribution"
  type        = string
}

variable "fastify_image" {
  description = "Container image for the Fastify API"
  type        = string
}

variable "fastify_desired_count" {
  description = "Initial ECS desired count for the Fastify API"
  type        = number
  default     = 2
}

variable "fastify_environment" {
  description = "Static environment variables passed to the Fastify API"
  type        = map(string)
  default     = {}
}

variable "fastify_secrets" {
  description = "Map of environment variables to AWS Secrets Manager ARNs for the Fastify API"
  type        = map(string)
  default     = {}
}

variable "livekit_image" {
  description = "Container image for the LiveKit SFU"
  type        = string
}

variable "livekit_desired_count" {
  description = "Initial ECS desired count for LiveKit"
  type        = number
  default     = 2
}

variable "livekit_environment" {
  description = "Static environment variables for LiveKit"
  type        = map(string)
  default     = {}
}

variable "livekit_secrets" {
  description = "Map of environment variables to Secrets Manager ARNs for LiveKit"
  type        = map(string)
  default     = {}
}

variable "sim_image" {
  description = "Container image for authoritative simulation servers"
  type        = string
}

variable "sim_desired_count" {
  description = "Initial ECS desired count for authoritative simulation servers"
  type        = number
  default     = 3
}

variable "sim_environment" {
  description = "Static environment variables for authoritative simulation servers"
  type        = map(string)
  default     = {}
}

variable "sim_secrets" {
  description = "Map of environment variables to Secrets Manager ARNs for authoritative simulation servers"
  type        = map(string)
  default     = {}
}

variable "database_username" {
  description = "Master username for the Aurora Postgres cluster"
  type        = string
  default     = "hyperfy_admin"
}

variable "allowed_ingress_cidr_blocks" {
  description = "CIDR blocks allowed to access the public load balancers"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}
