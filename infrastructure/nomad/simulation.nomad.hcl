job "hyperfy-sim" {
  datacenters = ["dc1"]
  type        = "service"

  group "sim" {
    count = 3

    network {
      mode = "bridge"
      port "grpc" {
        to = 7000
      }
    }

    service {
      name     = "hyperfy-sim"
      provider = "consul"
      port     = "grpc"
      tags = [
        "traefik.enable=true",
        "traefik.http.routers.sim.rule=Host(`sim.hyperfy.example`)",
        "traefik.http.routers.sim.entrypoints=https",
        "traefik.http.services.sim.loadbalancer.server.port=7000",
      ]

      check {
        name     = "grpc"
        type     = "http"
        path     = "/healthz"
        interval = "15s"
        timeout  = "3s"
      }
    }

    scaling {
      enabled = true
      min     = 3
      max     = 12

      policy {
        evaluation_interval = "1m"
        cooldown            = "3m"
        target {
          source    = "nomad-apm"
          metric    = "nomad.job.cpu.percent"
          value     = 60
          strategy  = "target-value"
          direction = "increase"
        }
      }
    }

    task "sim" {
      driver = "docker"

      config {
        image = "ghcr.io/hyperfy-xyz/hyperfy-sim:latest"
        ports = ["grpc"]
      }

      resources {
        cpu    = 1000
        memory = 2048
      }

      template {
        destination = "secrets/env"
        change_mode = "signal"
        change_signal = "SIGHUP"
        env = true
        data = <<EOT
{{ with secret "secret/data/hyperfy/production/sim" -}}
SIM_CLUSTER_TOKEN={{ .Data.data.cluster_token }}
{{- end }}
{{ with secret "secret/data/hyperfy/production/server" -}}
HYPERFY_JWT_SECRET={{ .Data.data.jwt_secret }}
{{- end }}
EOT
      }
    }
  }
}
