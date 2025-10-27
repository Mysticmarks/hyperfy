import * as pulumi from "@pulumi/pulumi"
import * as aws from "@pulumi/aws"
import * as awsx from "@pulumi/awsx"
import * as random from "@pulumi/random"

interface ServiceArgs {
  name: string
  image: pulumi.Input<string>
  port: number
  desiredCount: number
  certificateArn: pulumi.Input<string>
  environment?: Record<string, pulumi.Input<string>>
  secrets?: Record<string, pulumi.Input<string>>
  healthCheckPath?: string
  allowedCidrs: pulumi.Input<pulumi.Input<string>[]>
  autoscaling?: {
    min: number
    max: number
    cpu: number
    memory: number
  }
}

const pulumiConfig = new pulumi.Config("hyperfy")
const project = pulumi.getProject()

const domain = pulumiConfig.require("domain")
const fastifyImage = pulumiConfig.require("fastifyImage")
const livekitImage = pulumiConfig.require("livekitImage")
const simImage = pulumiConfig.require("simImage")
const apiCertificateArn = pulumiConfig.require("apiCertificateArn")
const livekitCertificateArn = pulumiConfig.require("livekitCertificateArn")
const simCertificateArn = pulumiConfig.require("simCertificateArn")
const cdnCertificateArn = pulumiConfig.require("cdnCertificateArn")
const databaseUsername = pulumiConfig.get("databaseUsername") ?? "hyperfy_admin"
const allowedCidrs = pulumi.output(pulumiConfig.getObject<string[]>("allowedCidrs") ?? ["0.0.0.0/0"])
const fastifyEnv = pulumiConfig.getObject<Record<string, string>>("fastifyEnvironment") ?? {}
const livekitEnv = pulumiConfig.getObject<Record<string, string>>("livekitEnvironment") ?? {}
const simEnv = pulumiConfig.getObject<Record<string, string>>("simEnvironment") ?? {}
const fastifySecrets = pulumiConfig.getObject<Record<string, string>>("fastifySecrets") ?? {}
const livekitSecrets = pulumiConfig.getObject<Record<string, string>>("livekitSecrets") ?? {}
const simSecrets = pulumiConfig.getObject<Record<string, string>>("simSecrets") ?? {}

const fastifyDesired = pulumiConfig.getNumber("fastifyDesiredCount") ?? 2
const livekitDesired = pulumiConfig.getNumber("livekitDesiredCount") ?? 2
const simDesired = pulumiConfig.getNumber("simDesiredCount") ?? 3

const vpc = new awsx.ec2.Vpc("hyperfy-vpc", {
  numberOfAvailabilityZones: 2,
  cidrBlock: "10.2.0.0/16",
})

const cluster = new awsx.ecs.Cluster("hyperfy-cluster", {
  vpc,
  settings: [{
    name: "containerInsights",
    value: "enabled",
  }],
})

function createService(args: ServiceArgs) {
  const env = Object.entries(args.environment ?? {}).map(([name, value]) => ({ name, value }))
  const secrets = Object.entries(args.secrets ?? {}).map(([name, valueFrom]) => ({ name, valueFrom }))

  const logGroup = new aws.cloudwatch.LogGroup(`${args.name}-logs`, {
    name: `/hyperfy/${args.name}`,
    retentionInDays: 30,
  })

  const lbSecurityGroup = new aws.ec2.SecurityGroup(`${args.name}-lb-sg`, {
    vpcId: vpc.vpcId,
    description: pulumi.interpolate`Ingress for ${args.name}`,
    ingress: [
      { fromPort: 80, toPort: 80, protocol: "tcp", cidrBlocks: args.allowedCidrs },
      { fromPort: 443, toPort: 443, protocol: "tcp", cidrBlocks: args.allowedCidrs },
    ],
    egress: [{ fromPort: 0, toPort: 0, protocol: "-1", cidrBlocks: ["0.0.0.0/0"] }],
    tags: {
      Project: project,
      Service: args.name,
      Component: "load-balancer",
    },
  })

  const serviceSecurityGroup = new aws.ec2.SecurityGroup(`${args.name}-svc-sg`, {
    vpcId: vpc.vpcId,
    description: pulumi.interpolate`Service security group for ${args.name}`,
    ingress: [
      {
        fromPort: args.port,
        toPort: args.port,
        protocol: "tcp",
        securityGroups: [lbSecurityGroup.id],
      },
    ],
    egress: [{ fromPort: 0, toPort: 0, protocol: "-1", cidrBlocks: ["0.0.0.0/0"] }],
    tags: {
      Project: project,
      Service: args.name,
    },
  })

  const loadBalancer = new aws.lb.LoadBalancer(`${args.name}-alb`, {
    securityGroups: [lbSecurityGroup.id],
    subnets: vpc.publicSubnetIds,
    loadBalancerType: "application",
    tags: {
      Project: project,
      Service: args.name,
    },
  })

  const targetGroup = new aws.lb.TargetGroup(`${args.name}-tg`, {
    port: args.port,
    protocol: "HTTP",
    targetType: "ip",
    vpcId: vpc.vpcId,
    healthCheck: {
      enabled: true,
      path: args.healthCheckPath ?? "/healthz",
      interval: 30,
      timeout: 5,
      unhealthyThreshold: 5,
      healthyThreshold: 2,
      matcher: "200-399",
    },
  })

  const httpsListener = new aws.lb.Listener(`${args.name}-https`, {
    loadBalancerArn: loadBalancer.arn,
    port: 443,
    protocol: "HTTPS",
    certificateArn: args.certificateArn,
    defaultActions: [{
      type: "forward",
      targetGroupArn: targetGroup.arn,
    }],
  })

  new aws.lb.Listener(`${args.name}-http`, {
    loadBalancerArn: loadBalancer.arn,
    port: 80,
    protocol: "HTTP",
    defaultActions: [{
      type: "redirect",
      redirect: {
        statusCode: "HTTP_301",
        port: "443",
        protocol: "HTTPS",
      },
    }],
  })

  const taskExecutionRole = new aws.iam.Role(`${args.name}-execution`, {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: "ecs-tasks.amazonaws.com",
    }),
    tags: {
      Project: project,
      Service: args.name,
    },
  })

  new aws.iam.RolePolicyAttachment(`${args.name}-execution-policy`, {
    role: taskExecutionRole.name,
    policyArn: aws.iam.ManagedPolicies.AmazonECSTaskExecutionRolePolicy,
  })

  const taskRole = new aws.iam.Role(`${args.name}-task`, {
    assumeRolePolicy: taskExecutionRole.assumeRolePolicy,
    tags: {
      Project: project,
      Service: args.name,
    },
  })

  const secretArns = Object.values(args.secrets ?? {})
  if (secretArns.length > 0) {
    new aws.iam.RolePolicy(`${args.name}-secret-access`, {
      role: taskRole.id,
      policy: pulumi.all(secretArns).apply(arns => JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: ["secretsmanager:GetSecretValue"],
            Resource: arns,
          },
        ],
      })),
    })
  }

  const taskDefinition = new aws.ecs.TaskDefinition(`${args.name}-taskdef`, {
    family: `${project}-${args.name}`,
    cpu: "512",
    memory: "1024",
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    executionRoleArn: taskExecutionRole.arn,
    taskRoleArn: taskRole.arn,
    containerDefinitions: pulumi.all([logGroup.name]).apply(([logName]) => JSON.stringify([
      {
        name: args.name,
        image: args.image,
        essential: true,
        portMappings: [
          { containerPort: args.port, hostPort: args.port, protocol: "tcp" },
        ],
        environment: env,
        secrets,
        logConfiguration: {
          logDriver: "awslogs",
          options: {
            "awslogs-group": logName,
            "awslogs-region": aws.config.region,
            "awslogs-stream-prefix": args.name,
          },
        },
        healthCheck: {
          command: [
            "CMD-SHELL",
            `curl -f http://localhost:${args.port}${args.healthCheckPath ?? "/healthz"} || exit 1`,
          ],
          interval: 30,
          timeout: 5,
          retries: 3,
          startPeriod: 60,
        },
      },
    ])),
  })

  const service = new aws.ecs.Service(`${args.name}-service`, {
    cluster: cluster.cluster.arn,
    desiredCount: args.desiredCount,
    launchType: "FARGATE",
    taskDefinition: taskDefinition.arn,
    enableExecuteCommand: true,
    networkConfiguration: {
      subnets: vpc.privateSubnetIds,
      assignPublicIp: false,
      securityGroups: [serviceSecurityGroup.id],
    },
    loadBalancers: [{
      containerName: args.name,
      containerPort: args.port,
      targetGroupArn: targetGroup.arn,
    }],
    deploymentController: {
      type: "ECS",
    },
  }, { dependsOn: httpsListener })

  const scaling = args.autoscaling ?? { min: args.desiredCount, max: args.desiredCount * 3, cpu: 60, memory: 70 }

  const scalableTarget = new aws.appautoscaling.Target(`${args.name}-scaling-target`, {
    maxCapacity: scaling.max,
    minCapacity: scaling.min,
    resourceId: pulumi.interpolate`service/${cluster.cluster.name}/${service.name}`,
    scalableDimension: "ecs:service:DesiredCount",
    serviceNamespace: "ecs",
  })

  new aws.appautoscaling.Policy(`${args.name}-scaling-cpu`, {
    policyType: "TargetTrackingScaling",
    resourceId: scalableTarget.resourceId,
    scalableDimension: scalableTarget.scalableDimension,
    serviceNamespace: scalableTarget.serviceNamespace,
    targetTrackingScalingPolicyConfiguration: {
      predefinedMetricSpecification: {
        predefinedMetricType: "ECSServiceAverageCPUUtilization",
      },
      targetValue: scaling.cpu,
    },
  })

  new aws.appautoscaling.Policy(`${args.name}-scaling-mem`, {
    policyType: "TargetTrackingScaling",
    resourceId: scalableTarget.resourceId,
    scalableDimension: scalableTarget.scalableDimension,
    serviceNamespace: scalableTarget.serviceNamespace,
    targetTrackingScalingPolicyConfiguration: {
      predefinedMetricSpecification: {
        predefinedMetricType: "ECSServiceAverageMemoryUtilization",
      },
      targetValue: scaling.memory,
    },
  })

  return {
    service,
    loadBalancer,
    targetGroup,
    securityGroup: serviceSecurityGroup,
  }
}

const fastify = createService({
  name: "fastify",
  image: fastifyImage,
  port: 3000,
  desiredCount: fastifyDesired,
  certificateArn: apiCertificateArn,
  environment: { ...fastifyEnv, PUBLIC_BASE_URL: pulumi.interpolate`https://api.${domain}` },
  secrets: fastifySecrets,
  healthCheckPath: "/healthz",
  allowedCidrs,
  autoscaling: { min: fastifyDesired, max: fastifyDesired * 4, cpu: 55, memory: 70 },
})

const livekit = createService({
  name: "livekit",
  image: livekitImage,
  port: 7880,
  desiredCount: livekitDesired,
  certificateArn: livekitCertificateArn,
  environment: livekitEnv,
  secrets: livekitSecrets,
  healthCheckPath: "/status",
  allowedCidrs,
  autoscaling: { min: livekitDesired, max: livekitDesired * 4, cpu: 50, memory: 65 },
})

const sim = createService({
  name: "sim",
  image: simImage,
  port: 7000,
  desiredCount: simDesired,
  certificateArn: simCertificateArn,
  environment: simEnv,
  secrets: simSecrets,
  healthCheckPath: "/healthz",
  allowedCidrs,
  autoscaling: { min: simDesired, max: simDesired * 5, cpu: 60, memory: 70 },
})

const dbPassword = new random.RandomPassword("db-password", {
  length: 32,
  special: true,
})

const dbSecret = new aws.secretsmanager.Secret("db-secret", {
  name: `${project}/database/master`,
})

new aws.secretsmanager.SecretVersion("db-secret-version", {
  secretId: dbSecret.id,
  secretString: dbPassword.result,
})

const dbSecurityGroup = new aws.ec2.SecurityGroup("db-sg", {
  vpcId: vpc.vpcId,
  description: "Aurora PostgreSQL security group",
  ingress: [
    { fromPort: 5432, toPort: 5432, protocol: "tcp", securityGroups: [fastify.securityGroup.id, livekit.securityGroup.id, sim.securityGroup.id] },
  ],
  egress: [{ fromPort: 0, toPort: 0, protocol: "-1", cidrBlocks: ["0.0.0.0/0"] }],
  tags: {
    Project: project,
    Component: "database",
  },
})

const dbSubnetGroup = new aws.rds.SubnetGroup("db-subnets", {
  subnetIds: vpc.privateSubnetIds,
  tags: {
    Project: project,
    Component: "database",
  },
})

const dbCluster = new aws.rds.Cluster("hyperfy-db", {
  engine: "aurora-postgresql",
  engineMode: "provisioned",
  engineVersion: "15.4",
  masterUsername: databaseUsername,
  masterPassword: dbPassword.result,
  databaseName: "hyperfy",
  storageEncrypted: true,
  backupRetentionPeriod: 7,
  deletionProtection: true,
  dbSubnetGroupName: dbSubnetGroup.name,
  vpcSecurityGroupIds: [dbSecurityGroup.id],
  tags: {
    Project: project,
  },
})

const dbInstances = [0, 1].map(i => new aws.rds.ClusterInstance(`hyperfy-db-${i}`, {
  clusterIdentifier: dbCluster.id,
  instanceClass: "db.serverless",
  engine: dbCluster.engine,
  engineVersion: dbCluster.engineVersion,
  dbSubnetGroupName: dbSubnetGroup.name,
  publiclyAccessible: false,
}))

const assetsBucket = new aws.s3.Bucket("assets", {
  bucketPrefix: `${project}-assets-`,
  forceDestroy: false,
  versioning: { enabled: true },
  serverSideEncryptionConfiguration: {
    rule: {
      applyServerSideEncryptionByDefault: { sseAlgorithm: "AES256" },
    },
  },
  tags: {
    Project: project,
    Component: "cdn",
  },
})

new aws.s3.BucketPublicAccessBlock("assets-access", {
  bucket: assetsBucket.id,
  blockPublicAcls: true,
  blockPublicPolicy: true,
  ignorePublicAcls: true,
  restrictPublicBuckets: true,
})

const originAccessControl = new aws.cloudfront.OriginAccessControl("cdn-oac", {
  originAccessControlOriginType: "s3",
  signingBehavior: "always",
  signingProtocol: "sigv4",
})

const distribution = new aws.cloudfront.Distribution("cdn", {
  enabled: true,
  defaultRootObject: "index.html",
  origins: [{
    domainName: assetsBucket.bucketRegionalDomainName,
    originId: assetsBucket.arn,
    originAccessControlId: originAccessControl.id,
  }],
  defaultCacheBehavior: {
    targetOriginId: assetsBucket.arn,
    viewerProtocolPolicy: "redirect-to-https",
    allowedMethods: ["GET", "HEAD", "OPTIONS"],
    cachedMethods: ["GET", "HEAD"],
    compress: true,
    forwardedValues: {
      queryString: false,
      cookies: { forward: "none" },
    },
  },
  aliases: [`cdn.${domain}`],
  viewerCertificate: {
    acmCertificateArn: cdnCertificateArn,
    sslSupportMethod: "sni-only",
    minimumProtocolVersion: "TLSv1.2_2021",
  },
  restrictions: {
    geoRestriction: {
      restrictionType: "none",
    },
  },
  priceClass: "PriceClass_100",
  tags: {
    Project: project,
  },
})

const bucketPolicy = pulumi
  .all([distribution.arn, assetsBucket.arn])
  .apply(([distArn, bucketArn]) => JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "AllowCloudFrontAccess",
        Effect: "Allow",
        Principal: { Service: "cloudfront.amazonaws.com" },
        Action: "s3:GetObject",
        Resource: `${bucketArn}/*`,
        Condition: { StringEquals: { "AWS:SourceArn": distArn } },
      },
    ],
  }))

new aws.s3.BucketPolicy("assets-policy", {
  bucket: assetsBucket.id,
  policy: bucketPolicy,
})

export const fastifyEndpoint = pulumi.interpolate`https://${fastify.loadBalancer.dnsName}`
export const livekitEndpoint = pulumi.interpolate`https://${livekit.loadBalancer.dnsName}`
export const simulationEndpoint = pulumi.interpolate`https://${sim.loadBalancer.dnsName}`
export const databaseEndpoint = dbCluster.endpoint
export const databaseSecretArn = dbSecret.arn
export const cdnBucket = assetsBucket.id
export const cdnDomain = distribution.domainName
