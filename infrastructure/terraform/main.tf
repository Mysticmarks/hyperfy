locals {
  api_subdomain     = "api.${var.domain}"
  livekit_subdomain = "livekit.${var.domain}"
  sim_subdomain     = "sim.${var.domain}"
  tags = {
    Project = var.project
  }
}

module "network" {
  source  = "./modules/network"
  project = var.project
}

resource "aws_ecs_cluster" "this" {
  name = "${var.project}-services"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.tags
}

module "fastify_api" {
  source             = "./modules/container_service"
  project            = var.project
  name               = "api"
  cluster_arn        = aws_ecs_cluster.this.arn
  cluster_name       = aws_ecs_cluster.this.name
  aws_region         = var.aws_region
  container_image    = var.fastify_image
  container_port     = 3000
  desired_count      = var.fastify_desired_count
  environment        = merge(var.fastify_environment, { PUBLIC_BASE_URL = "https://${local.api_subdomain}" })
  secrets            = var.fastify_secrets
  private_subnet_ids = module.network.private_subnet_ids
  public_subnet_ids  = module.network.public_subnet_ids
  vpc_id             = module.network.vpc_id
  certificate_arn    = var.api_certificate_arn
  domain             = local.api_subdomain
  health_check_path  = "/healthz"
  allowed_cidr_blocks = var.allowed_ingress_cidr_blocks
  autoscaling = {
    min_capacity               = var.fastify_desired_count
    max_capacity               = var.fastify_desired_count * 4
    target_cpu_utilization     = 55
    target_memory_utilization  = 70
  }
}

module "livekit" {
  source             = "./modules/container_service"
  project            = var.project
  name               = "livekit"
  cluster_arn        = aws_ecs_cluster.this.arn
  cluster_name       = aws_ecs_cluster.this.name
  aws_region         = var.aws_region
  container_image    = var.livekit_image
  container_port     = 7880
  desired_count      = var.livekit_desired_count
  environment        = var.livekit_environment
  secrets            = var.livekit_secrets
  private_subnet_ids = module.network.private_subnet_ids
  public_subnet_ids  = module.network.public_subnet_ids
  vpc_id             = module.network.vpc_id
  certificate_arn    = var.livekit_certificate_arn
  domain             = local.livekit_subdomain
  health_check_path  = "/status"
  allowed_cidr_blocks = var.allowed_ingress_cidr_blocks
  autoscaling = {
    min_capacity              = var.livekit_desired_count
    max_capacity              = var.livekit_desired_count * 4
    target_cpu_utilization    = 50
    target_memory_utilization = 65
  }
}

module "simulation" {
  source             = "./modules/container_service"
  project            = var.project
  name               = "sim"
  cluster_arn        = aws_ecs_cluster.this.arn
  cluster_name       = aws_ecs_cluster.this.name
  aws_region         = var.aws_region
  container_image    = var.sim_image
  container_port     = 7000
  desired_count      = var.sim_desired_count
  environment        = var.sim_environment
  secrets            = var.sim_secrets
  private_subnet_ids = module.network.private_subnet_ids
  public_subnet_ids  = module.network.public_subnet_ids
  vpc_id             = module.network.vpc_id
  certificate_arn    = var.sim_certificate_arn
  domain             = local.sim_subdomain
  health_check_path  = "/healthz"
  allowed_cidr_blocks = var.allowed_ingress_cidr_blocks
  autoscaling = {
    min_capacity              = var.sim_desired_count
    max_capacity              = var.sim_desired_count * 5
    target_cpu_utilization    = 60
    target_memory_utilization = 70
  }
}

module "database" {
  source                    = "./modules/database"
  project                   = var.project
  database_username         = var.database_username
  subnet_ids                = module.network.private_subnet_ids
  vpc_id                    = module.network.vpc_id
  allowed_security_group_ids = [
    module.fastify_api.security_group_id,
    module.livekit.security_group_id,
    module.simulation.security_group_id
  ]
}

module "cdn" {
  source          = "./modules/cdn"
  project         = var.project
  domain          = var.domain
  certificate_arn = var.cdn_certificate_arn
}
