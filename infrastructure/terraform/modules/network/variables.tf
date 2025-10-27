variable "project" {
  type        = string
  description = "Project name for tagging"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC"
  default     = "10.0.0.0/16"
}

variable "azs" {
  type        = list(string)
  description = "Availability zones to spread subnets across"
  default     = []
}
