resource "random_password" "master" {
  length  = 32
  special = true
}

resource "aws_secretsmanager_secret" "password" {
  name = "${var.project}/database/master"

  tags = {
    Project = var.project
    Tier    = "database"
  }
}

resource "aws_secretsmanager_secret_version" "password" {
  secret_id     = aws_secretsmanager_secret.password.id
  secret_string = random_password.master.result
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.project}-db-subnets"
  subnet_ids = var.subnet_ids

  tags = {
    Name    = "${var.project}-db"
    Project = var.project
  }
}

resource "aws_security_group" "db" {
  name        = "${var.project}-db"
  description = "Database ingress"
  vpc_id      = var.vpc_id

  tags = {
    Name    = "${var.project}-db"
    Project = var.project
  }
}

resource "aws_security_group_rule" "ingress" {
  security_group_id = aws_security_group.db.id
  type              = "ingress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  source_security_group_id = length(var.allowed_security_group_ids) > 0 ? null : aws_security_group.db.id
  cidr_blocks              = length(var.allowed_security_group_ids) > 0 ? null : ["10.0.0.0/8"]
  depends_on               = [aws_security_group.db]
}

resource "aws_security_group_rule" "ingress_from_sgs" {
  for_each = toset(var.allowed_security_group_ids)

  security_group_id        = aws_security_group.db.id
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = each.value
}

resource "aws_security_group_rule" "egress" {
  security_group_id = aws_security_group.db.id
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_rds_cluster" "this" {
  cluster_identifier      = "${var.project}-aurora"
  engine                  = "aurora-postgresql"
  engine_version          = "15.4"
  master_username         = var.database_username
  master_password         = random_password.master.result
  database_name           = "hyperfy"
  backup_retention_period = 7
  preferred_backup_window = "04:00-06:00"
  storage_encrypted       = true
  deletion_protection     = true
  vpc_security_group_ids  = [aws_security_group.db.id]
  db_subnet_group_name    = aws_db_subnet_group.this.name

  tags = {
    Name    = "${var.project}-aurora"
    Project = var.project
  }
}

resource "aws_rds_cluster_instance" "this" {
  count               = 2
  identifier          = "${var.project}-aurora-${count.index}"
  cluster_identifier  = aws_rds_cluster.this.id
  instance_class      = "db.serverless"
  engine              = aws_rds_cluster.this.engine
  engine_version      = aws_rds_cluster.this.engine_version
  publicly_accessible = false
  db_subnet_group_name = aws_db_subnet_group.this.name
}
