import { ECS, ELB, Route53, IAM, VPC, CloudWatch } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { String as RandomString } from '@cdktf/provider-random';
import * as z from 'zod';
import type { VioletEnvStack } from '.';

export interface ApiTaskOptions {
  prefix: string;
  /**
   * Random fixed number.
   * https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Subnets.html#VPC_Sizing
   */
  ipv6interfaceIdPrefix: number;
  tagsAll?: Record<string, string>;
}

export class ApiTask extends Resource {
  constructor(private parent: VioletEnvStack, name: string, public options: ApiTaskOptions, config?: ResourceConfig) {
    super(parent, name, config);
  }

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 6,
    lower: true,
    upper: false,
    special: false,
  });

  readonly subdomain = `api-${this.parent.options.dynamicOpEnv.NAMESPACE}`;

  // TODO(service): prod availavility
  readonly subnets = [this.parent.network.publicSubnets[0], this.parent.network.publicSubnets[1]];

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lb
  readonly alb = new ELB.Alb(this, 'alb', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    internal: false,
    loadBalancerType: 'application',
    securityGroups: [this.parent.network.lbSg.id],
    ipAddressType: 'dualstack',

    subnets: this.subnets.map((subnet) => subnet.id),

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly albEnis = new VPC.DataAwsNetworkInterfaces(this, 'albEnis', {
    filter: [
      {
        name: 'description',
        values: [`ELB ${this.alb.arnSuffix}`],
      },
    ],
  });

  // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html#target-type
  readonly backend = new ELB.AlbTargetGroup(this, 'backend', {
    port: 80,
    targetType: 'ip',
    protocol: 'HTTP',
    vpcId: this.parent.network.vpc.id,
    // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html
    healthCheck: {
      port: '80',
      protocol: 'HTTP',
      enabled: true,
      path: '/healthz',
    },

    tagsAll: {
      ...this.options.tagsAll,
    },

    dependsOn: [
      // NOTE(depends): ALB Target Group usage should be after the ALB creation.
      this.alb,
    ],
  });

  readonly albListener = new ELB.AlbListener(this, 'albListener', {
    loadBalancerArn: this.alb.arn,
    port: 443,
    protocol: 'HTTPS',
    sslPolicy: 'ELBSecurityPolicy-2016-08',
    certificateArn: this.parent.certificate.arn,

    defaultAction: [
      {
        type: 'forward',
        targetGroupArn: this.backend.arn,
      },
    ],

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly executionRoleAssumeDocument = new IAM.DataAwsIamPolicyDocument(this, 'executionRoleAssumeDocument', {
    version: '2012-10-17',
    statement: [
      {
        effect: 'Allow',
        principals: [
          {
            type: 'Service',
            identifiers: ['ecs-tasks.amazonaws.com'],
          },
        ],
        actions: ['sts:AssumeRole'],
      },
    ],
  });

  readonly executionRole = new IAM.IamRole(this, 'executionRole', {
    name: `${this.options.prefix}-exec-${this.suffix.result}`,
    assumeRolePolicy: this.executionRoleAssumeDocument.json,
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly executionPolicyDocument = new IAM.DataAwsIamPolicyDocument(this, 'executionPolicyDocument', {
    version: '2012-10-17',
    statement: [
      {
        effect: 'Allow',
        // TODO(security): restrict
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: ['*'],
      },
      {
        effect: 'Allow',
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      },
      {
        // https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazonelasticcontainerregistry.html
        effect: 'Allow',
        actions: ['ecr:BatchCheckLayerAvailability', 'ecr:GetDownloadUrlForLayer', 'ecr:BatchGetImage'],
        resources: [this.parent.apiRepo.arn],
      },
    ],
  });

  readonly executionPolicy = new IAM.IamRolePolicy(this, 'executionPolicy', {
    name: `${this.options.prefix}-exec-${this.suffix.result}`,
    role: z.string().parse(this.executionRole.name),
    policy: this.executionPolicyDocument.json,
  });

  readonly taskRoleAssumeDocument = new IAM.DataAwsIamPolicyDocument(this, 'taskRoleAssumeDocument', {
    version: '2012-10-17',
    statement: [
      {
        effect: 'Allow',
        principals: [
          {
            type: 'Service',
            identifiers: ['ecs-tasks.amazonaws.com'],
          },
        ],
        actions: ['sts:AssumeRole'],
      },
    ],
  });

  readonly taskRole = new IAM.IamRole(this, 'taskRole', {
    name: `${this.options.prefix}-task-${this.suffix.result}`,
    assumeRolePolicy: this.taskRoleAssumeDocument.json,
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly logGroup = new CloudWatch.CloudwatchLogGroup(this, 'logGroup', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    // TODO(service): longer for prod
    retentionInDays: 7,
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly taskPolicyDocument = new IAM.DataAwsIamPolicyDocument(this, 'taskPolicyDocument', {
    version: '2012-10-17',
    statement: [
      {
        // https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-with-s3-actions.html
        actions: ['s3:PutObject', 's3:PutObjectAcl', 's3:GetObject', 's3:GetObjectAcl', 's3:DeleteObject'],
        resources: [this.parent.s3.arn, `${this.parent.s3.arn}/*`],
      },
    ],
  });

  readonly taskPolicy = new IAM.IamRolePolicy(this, 'taskPolicy', {
    name: `${this.options.prefix}-task-${this.suffix.result}`,
    role: z.string().parse(this.taskRole.name),
    policy: this.taskPolicyDocument.json,
  });

  // https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_TaskDefinition.html
  readonly definition = new ECS.EcsTaskDefinition(this, 'definition', {
    requiresCompatibilities: ['FARGATE'],
    // NOTE: FARGATE only supports 'awsvpc'
    networkMode: 'awsvpc',
    executionRoleArn: this.executionRole.arn,
    taskRoleArn: this.taskRole.arn,
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#container_definitions
    containerDefinitions: JSON.stringify([
      {
        name: 'api',
        image: `${this.parent.options.sharedEnv.AWS_ACCOUNT_ID}.dkr.ecr.${this.parent.aws.region}.amazonaws.com/${this.parent.apiImage.repositoryName}@${this.parent.apiImage.imageDigest}`,
        environment: [
          {
            name: 'BASE_PATH',
            value: '',
          },
          {
            // TODO: 多分 Cognito で使わない形にする
            name: 'JWT_SECRET',
            value: 'abcdefghijklmnopqrstuvwxy',
          },
          {
            name: 'DATABASE_URL',
            value: this.parent.dbURL.value,
          },
          {
            name: 'S3_BUCKET',
            value: this.parent.s3.bucket,
          },
          {
            name: 'S3_REGION',
            value: this.parent.s3.region,
          },
        ],
        portMappings: [
          {
            containerPort: 80,
            hostPort: 80,
            protocol: 'tcp',
          },
        ],
        // https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_LogConfiguration.html
        logConfiguration: {
          logDriver: 'awslogs',
          // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_awslogs.html
          options: {
            'awslogs-region': this.parent.aws.region,
            'awslogs-group': this.logGroup.name,
            'awslogs-stream-prefix': 'api',
          },
        },
      },
    ]),
    cpu: '256',
    memory: '512',
    family: 'api',

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly cnameRecord = new Route53.Route53Record(this, 'cnameRecord', {
    zoneId: z.string().parse(this.parent.zone.zoneId),
    type: 'CNAME',
    ttl: 5,
    name: this.subdomain,
    records: [this.alb.dnsName],
  });

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/ecs_service
  // https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_Service.html
  readonly service = new ECS.EcsService(this, 'service', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    propagateTags: 'SERVICE',
    networkConfiguration: {
      subnets: this.parent.network.publicSubnets.map((subnet) => subnet.id),
      securityGroups: [this.parent.network.serviceSg.id],
      // TODO(security): prod: NAT
      assignPublicIp: true,
    },
    cluster: this.parent.cluster.id,
    launchType: 'FARGATE',
    // TODO(performance)
    // TODO(scale)
    desiredCount: 1,
    taskDefinition: this.definition.arn,
    loadBalancer: [
      {
        containerName: 'api',
        containerPort: 80,
        targetGroupArn: this.backend.arn,
      },
    ],

    tagsAll: {
      ...this.options.tagsAll,
    },

    lifecycle: {
      ignoreChanges: ['desired_count'],
    },

    dependsOn: [
      // NOTE(depends): Wait ALB Target registered to ALB.
      this.alb,
      this.albListener,
    ],
  });
}
