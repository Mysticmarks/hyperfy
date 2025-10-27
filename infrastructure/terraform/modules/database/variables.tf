variable "project" {
  type = string
}

variable "database_username" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "vpc_id" {
  type = string
}

variable "allowed_security_group_ids" {
  type    = list(string)
  default = []
}
