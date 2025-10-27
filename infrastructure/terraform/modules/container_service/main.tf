locals {
  env_pairs    = [for key, value in var.environment : { name = key, value = value }]
  secret_pairs = [for key, value in var.secrets : { name = key, valueFrom = value }]
  secret_arns  = distinct(values(var.secrets))

  autoscaling_min     = try(var.autoscaling.min_capacity, var.desired_count)
  autoscaling_max     = try(var.autoscaling.max_capacity, max(var.desired_count, var.desired_count * 2))
  autoscaling_cpu     = try(var.autoscaling.target_cpu_utilization, 60)
  autoscaling_memory  = try(var.autoscaling.target_memory_utilization, 70)
}

data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/hyperfy/${var.name}"
  retention_in_days = 30

  tags = {
    Project = var.project
    Service = var.name
  }
}

resource "aws_iam_role" "task_execution" {
  name = "${var.project}-${var.name}-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.${data.aws_partition.current.dns_suffix}"
      }
    }]
  })

  tags = {
    Project = var.project
    Service = var.name
  }
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task" {
  name = "${var.project}-${var.name}-task"

  assume_role_policy = aws_iam_role.task_execution.assume_role_policy

  tags = {
    Project = var.project
    Service = var.name
  }
}

locals {
  secrets_policy_json = length(local.secret_arns) > 0
    ? jsonencode({
        Version   = "2012-10-17"
        Statement = [{
          Effect   = "Allow"
          Action   = ["secretsmanager:GetSecretValue"]
          Resource = local.secret_arns
        }]
      })
    : null
}

resource "aws_iam_role_policy" "task" {
  count = local.secrets_policy_json == null ? 0 : 1

  role   = aws_iam_role.task.id
  policy = local.secrets_policy_json
}

resource "aws_security_group" "lb" {
  name        = "${var.project}-${var.name}-lb"
  description = "Ingress for ${var.name} load balancer"
  vpc_id      = var.vpc_id

  tags = {
    Project = var.project
    Service = var.name
    Component = "load-balancer"
  }
}

resource "aws_security_group_rule" "lb_ingress" {
  security_group_id = aws_security_group.lb.id
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = var.allowed_cidr_blocks
}

resource "aws_security_group_rule" "lb_http" {
  security_group_id = aws_security_group.lb.id
  type              = "ingress"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = var.allowed_cidr_blocks
}

resource "aws_security_group_rule" "lb_egress" {
  security_group_id = aws_security_group.lb.id
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group" "service" {
  name        = "${var.project}-${var.name}-service"
  description = "Service security group"
  vpc_id      = var.vpc_id

  tags = {
    Project = var.project
    Service = var.name
  }
}

resource "aws_security_group_rule" "service_ingress" {
  security_group_id        = aws_security_group.service.id
  type                     = "ingress"
  from_port                = var.container_port
  to_port                  = var.container_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.lb.id
}

resource "aws_security_group_rule" "service_egress" {
  security_group_id = aws_security_group.service.id
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_lb" "this" {
  name               = "${var.project}-${var.name}"
  load_balancer_type = "application"
  subnets            = var.public_subnet_ids
  security_groups    = [aws_security_group.lb.id]

  tags = {
    Project = var.project
    Service = var.name
    Domain  = var.domain
  }
}

resource "aws_lb_target_group" "this" {
  name        = "${var.project}-${var.name}"
  port        = var.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    enabled             = true
    path                = var.health_check_path
    healthy_threshold   = 2
    unhealthy_threshold = 5
    interval            = 30
    timeout             = 5
    matcher             = "200-399"
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_ecs_task_definition" "this" {
  family                   = "${var.project}-${var.name}"
  cpu                      = tostring(var.cpu)
  memory                   = tostring(var.memory)
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = var.name
      image     = var.container_image
      essential = true
      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]
      environment = local.env_pairs
      secrets     = local.secret_pairs
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.this.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = var.name
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.container_port}${var.health_check_path} || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])
}

resource "aws_ecs_service" "this" {
  name            = "${var.project}-${var.name}"
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"
  enable_execute_command = true

  network_configuration {
    assign_public_ip = false
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.service.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.this.arn
    container_name   = var.name
    container_port   = var.container_port
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener.https]
}

resource "aws_appautoscaling_target" "this" {
  max_capacity       = local.autoscaling_max
  min_capacity       = local.autoscaling_min
  resource_id        = "service/${var.cluster_name}/${aws_ecs_service.this.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "${var.project}-${var.name}-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.this.resource_id
  scalable_dimension = aws_appautoscaling_target.this.scalable_dimension
  service_namespace  = aws_appautoscaling_target.this.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }

    target_value = local.autoscaling_cpu
  }
}

resource "aws_appautoscaling_policy" "memory" {
  name               = "${var.project}-${var.name}-memory"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.this.resource_id
  scalable_dimension = aws_appautoscaling_target.this.scalable_dimension
  service_namespace  = aws_appautoscaling_target.this.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }

    target_value = local.autoscaling_memory
  }
}

output "load_balancer_dns" {
  value = aws_lb.this.dns_name
}

output "security_group_id" {
  value = aws_security_group.service.id
}

output "task_role_arn" {
  value = aws_iam_role.task.arn
}

output "execution_role_arn" {
  value = aws_iam_role.task_execution.arn
}
