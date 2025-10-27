output "vpc_id" {
  value = module.network.vpc_id
}

output "private_subnet_ids" {
  value = module.network.private_subnet_ids
}

output "public_subnet_ids" {
  value = module.network.public_subnet_ids
}

output "fastify_load_balancer" {
  value = module.fastify_api.load_balancer_dns
}

output "livekit_load_balancer" {
  value = module.livekit.load_balancer_dns
}

output "simulation_load_balancer" {
  value = module.simulation.load_balancer_dns
}

output "database_endpoint" {
  value = module.database.cluster_endpoint
}

output "database_secret_arn" {
  value = module.database.secret_arn
}

output "cdn_bucket_name" {
  value = module.cdn.bucket_name
}

output "cdn_distribution_domain" {
  value = module.cdn.distribution_domain_name
}
