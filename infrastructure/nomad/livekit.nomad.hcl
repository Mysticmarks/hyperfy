job "livekit" {
  datacenters = ["dc1"]
  type        = "service"

  group "livekit" {
    count = 2

    network {
      mode = "bridge"
      port "http" {
        to = 7880
      }
      port "rtc" {
        to       = 7881
        protocol = "udp"
      }
    }

    service {
      name     = "livekit"
      provider = "consul"
      port     = "http"
      tags = [
        "traefik.enable=true",
        "traefik.http.routers.livekit.rule=Host(`livekit.hyperfy.example`)",
        "traefik.http.routers.livekit.entrypoints=https",
        "traefik.http.routers.livekit.tls=true",
        "traefik.http.services.livekit.loadbalancer.server.port=7880",
        "traefik.tcp.routers.livekit-rtc.rule=HostSNI(`*`)",
        "traefik.tcp.routers.livekit-rtc.entrypoints=livekit",
        "traefik.tcp.routers.livekit-rtc.tls.passthrough=true",
        "traefik.tcp.services.livekit-rtc.loadbalancer.server.port=7881",
      ]

      check {
        name     = "status"
        type     = "http"
        path     = "/status"
        interval = "10s"
        timeout  = "3s"
      }
    }

    scaling {
      enabled = true
      min     = 2
      max     = 6

      policy {
        evaluation_interval = "45s"
        cooldown            = "2m"
        target {
          source    = "nomad-apm"
          metric    = "nomad.job.cpu.percent"
          value     = 50
          strategy  = "target-value"
          direction = "increase"
        }
      }
    }

    task "livekit" {
      driver = "docker"

      config {
        image = "ghcr.io/hyperfy-xyz/livekit:latest"
        ports = ["http", "rtc"]
        args  = ["--config", "/etc/livekit/config.yaml"]
      }

      resources {
        cpu    = 1200
        memory = 2048
      }

      template {
        destination = "local/config.yaml"
        change_mode = "restart"
        data = <<EOT
rtc:
  tcp_port: 7881
turn:
  enabled: true
  tls_port: 5349
keys:
{{ with secret "secret/data/hyperfy/production/livekit" -}}
  {{ .Data.data.api_key }}: {{ .Data.data.api_secret }}
{{- end }}
EOT
      }

      template {
        destination = "secrets/env"
        change_mode = "signal"
        change_signal = "SIGHUP"
        env = true
        data = <<EOT
{{ with secret "secret/data/hyperfy/production/livekit" -}}
LIVEKIT_API_KEY={{ .Data.data.api_key }}
LIVEKIT_API_SECRET={{ .Data.data.api_secret }}
{{- end }}
EOT
      }
    }
  }
}
