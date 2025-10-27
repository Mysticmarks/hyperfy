variable "project" {
  type = string
}

variable "name" {
  type = string
}

variable "cluster_arn" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "container_image" {
  type = string
}

variable "container_port" {
  type = number
}

variable "desired_count" {
  type    = number
  default = 2
}

variable "cpu" {
  type    = number
  default = 512
}

variable "memory" {
  type    = number
  default = 1024
}

variable "environment" {
  type    = map(string)
  default = {}
}

variable "secrets" {
  type    = map(string)
  default = {}
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "vpc_id" {
  type = string
}

variable "certificate_arn" {
  type = string
}

variable "domain" {
  type = string
}

variable "health_check_path" {
  type    = string
  default = "/healthz"
}

variable "allowed_cidr_blocks" {
  type    = list(string)
  default = ["0.0.0.0/0"]
}

variable "autoscaling" {
  type = object({
    min_capacity          = optional(number, 2)
    max_capacity          = optional(number, 10)
    target_cpu_utilization = optional(number, 60)
    target_memory_utilization = optional(number, 70)
  })
  default = {}
}
