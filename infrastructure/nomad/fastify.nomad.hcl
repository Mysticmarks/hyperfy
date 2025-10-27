job "fastify-api" {
  datacenters = ["dc1"]
  type        = "service"

  update {
    max_parallel     = 1
    min_healthy_time = "30s"
    healthy_deadline = "3m"
    auto_revert      = true
    auto_promote     = true
  }

  group "fastify" {
    count = 2

    network {
      mode = "bridge"
      port "http" {
        static = 3000
      }
    }

    service {
      name = "fastify-api"
      provider = "consul"
      port = "http"
      tags = [
        "traefik.enable=true",
        "traefik.http.routers.fastify.entrypoints=https",
        "traefik.http.routers.fastify.rule=Host(`api.hyperfy.example`)",
        "traefik.http.routers.fastify.tls=true",
        "traefik.http.services.fastify.loadbalancer.server.port=3000",
      ]

      check {
        name     = "liveness"
        type     = "http"
        path     = "/healthz"
        interval = "15s"
        timeout  = "3s"
      }

      check {
        name     = "readiness"
        type     = "http"
        path     = "/healthz"
        interval = "10s"
        timeout  = "2s"
      }
    }

    scaling {
      enabled = true
      min     = 2
      max     = 8

      policy {
        evaluation_interval = "30s"
        cooldown            = "2m"

        target {
          source    = "nomad-apm"
          metric    = "nomad.job.cpu.percent"
          value     = 55
          strategy  = "target-value"
          direction = "increase"
        }

        target {
          source    = "nomad-apm"
          metric    = "nomad.job.memory.percent"
          value     = 70
          strategy  = "target-value"
          direction = "increase"
        }
      }
    }

    task "fastify" {
      driver = "docker"

      config {
        image = "ghcr.io/hyperfy-xyz/hyperfy:latest"
        ports = ["http"]
        args  = ["node", "build/index.js"]
      }

      resources {
        cpu    = 700
        memory = 1024
      }

      env {
        NODE_ENV         = "production"
        PUBLIC_BASE_URL  = "https://api.hyperfy.example"
      }

      template {
        destination = "secrets/env"
        change_mode = "signal"
        change_signal = "SIGHUP"
        env = true
        data = <<EOT
{{ with secret "secret/data/hyperfy/production/server" -}}
FASTIFY_JWT_SECRET={{ .Data.data.jwt_secret }}
FASTIFY_ADMIN_CODE={{ .Data.data.admin_code }}
{{- end }}
{{ with secret "secret/data/hyperfy/production/database" -}}
DATABASE_URL={{ .Data.data.url }}
{{- end }}
EOT
      }
    }
  }
}
