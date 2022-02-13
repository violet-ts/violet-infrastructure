import { cloudwatch, ecs, elb, iam, route53 } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { StringResource as RandomString } from '@cdktf/provider-random';
import { RESOURCE_DEV_SHORT_PREFIX, RESOURCE_PROD_SHORT_PREFIX } from '@self/shared/lib/const';
import { devInfoLogRetentionDays } from '@self/shared/lib/const/logging';
import type { ComputedOpEnv } from '@self/shared/lib/operate-env/op-env';
import { z } from 'zod';
import type { VioletEnvStack } from '.';
import type { RepoImage } from './repo-image';

export interface HTTPTaskOptions {
  /**
   * シンプルな短い名前
   */
  name: string;
  // len <= 26
  prefix: string;
  /**
   * Random fixed number.
   * https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Subnets.html#VPC_Sizing
   */
  ipv6interfaceIdPrefix: number;
  tagsAll?: Record<string, string>;

  repoImage: RepoImage;
  healthcheckPath: string;
  computedOpEnv: ComputedOpEnv;
  env: Record<string, string>;
}

export class HTTPTask extends Resource {
  constructor(private parent: VioletEnvStack, name: string, public options: HTTPTaskOptions, config?: ResourceConfig) {
    super(parent, name, config);
  }

  get shortPrefix(): string {
    return `${
      this.options.computedOpEnv.SECTION === 'development' ? RESOURCE_DEV_SHORT_PREFIX : RESOURCE_PROD_SHORT_PREFIX
    }`;
  }

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 8,
    lower: true,
    upper: false,
    special: false,
  });

  readonly subdomain = `${this.options.name}-${this.parent.options.dynamicOpEnv.NAMESPACE}`;

  readonly domain = `${this.subdomain}.${z.string().parse(this.parent.zone.name)}`;

  readonly url = `https://${this.domain}`;

  // TODO(service): prod availavility
  readonly subnets = [this.parent.network.publicSubnets[0], this.parent.network.publicSubnets[1]];

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lb
  readonly alb = new elb.Alb(this, 'alb', {
    name: `${this.shortPrefix}${this.options.name}-${this.suffix.result}`,
    internal: false,
    loadBalancerType: 'application',
    securityGroups: [this.parent.network.lbSg.id],
    ipAddressType: 'dualstack',

    subnets: this.subnets.map((subnet) => subnet.id),

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html#target-type
  readonly backend = new elb.AlbTargetGroup(this, 'backend', {
    port: 80,
    targetType: 'ip',
    protocol: 'HTTP',
    vpcId: this.parent.network.vpc.id,
    // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html
    healthCheck: {
      port: '80',
      protocol: 'HTTP',
      enabled: true,
      path: this.options.healthcheckPath,
    },

    tagsAll: {
      ...this.options.tagsAll,
    },

    dependsOn: [
      // NOTE(depends): ALB Target Group usage should be after the ALB creation.
      this.alb,
    ],
  });

  readonly httpsListener = new elb.AlbListener(this, 'httpsListener', {
    loadBalancerArn: this.alb.arn,
    port: 443,
    protocol: 'HTTPS',
    sslPolicy: 'ELBSecurityPolicy-2016-08',
    certificateArn: this.parent.certificate.arn,

    defaultAction: [
      {
        // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-listeners.html#forward-actions
        type: 'forward',
        targetGroupArn: this.backend.arn,
      },
    ],

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // HTTPS へのリダイレクト
  readonly httpListener = new elb.AlbListener(this, 'httpListener', {
    loadBalancerArn: this.alb.arn,
    port: 80,
    protocol: 'HTTP',

    defaultAction: [
      {
        // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-listeners.html#redirect-actions
        type: 'redirect',
        redirect: {
          protocol: 'HTTPS',
          port: '443',
          host: '#{host}',
          path: '/#{path}',
          query: '#{query}',
          statusCode: 'HTTP_301',
        },
      },
    ],

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly executionRoleAssumeDocument = new iam.DataAwsIamPolicyDocument(this, 'executionRoleAssumeDocument', {
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

  readonly executionRole = new iam.IamRole(this, 'executionRole', {
    namePrefix: `${this.shortPrefix}${this.options.name}-exec-`,
    assumeRolePolicy: this.executionRoleAssumeDocument.json,
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly executionPolicyDocument = new iam.DataAwsIamPolicyDocument(this, 'executionPolicyDocument', {
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
        resources: [this.options.repoImage.repo.arn],
      },
    ],
  });

  readonly executionPolicy = new iam.IamRolePolicy(this, 'executionPolicy', {
    namePrefix: `${this.shortPrefix}${this.options.name}-exec-`,
    role: z.string().parse(this.executionRole.name),
    policy: this.executionPolicyDocument.json,
  });

  readonly taskRoleAssumeDocument = new iam.DataAwsIamPolicyDocument(this, 'taskRoleAssumeDocument', {
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

  readonly taskRole = new iam.IamRole(this, 'taskRole', {
    namePrefix: `${this.shortPrefix}${this.options.name}-task-`,
    assumeRolePolicy: this.taskRoleAssumeDocument.json,
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly logGroup = new cloudwatch.CloudwatchLogGroup(this, 'logGroup', {
    namePrefix: `${this.shortPrefix}${this.options.name}-`,
    // TODO(service): longer for prod
    retentionInDays: devInfoLogRetentionDays,
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  // https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_TaskDefinition.html
  readonly definition = new ecs.EcsTaskDefinition(this, 'definition', {
    requiresCompatibilities: ['FARGATE'],
    // NOTE: FARGATE only supports 'awsvpc'
    networkMode: 'awsvpc',
    executionRoleArn: this.executionRole.arn,
    taskRoleArn: this.taskRole.arn,
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#container_definitions
    containerDefinitions: JSON.stringify([
      {
        name: this.options.name,
        image: this.options.repoImage.imageUri,
        environment: Object.entries(this.options.env).map(([name, value]) => ({ name, value })),
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
            'awslogs-stream-prefix': this.options.name,
          },
        },
      },
    ]),
    cpu: '256',
    memory: '512',
    family: this.options.name,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly cnameRecord = new route53.Route53Record(this, 'cnameRecord', {
    zoneId: this.parent.zone.zoneId,
    type: 'CNAME',
    ttl: 5,
    name: this.subdomain,
    records: [this.alb.dnsName],
  });

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/ecs_service
  // https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_Service.html
  readonly service = new ecs.EcsService(this, 'service', {
    name: `${this.shortPrefix}${this.options.name}-${this.suffix.result}`,
    propagateTags: 'SERVICE',
    networkConfiguration: {
      subnets: this.parent.network.publicSubnets.map((subnet) => subnet.id),
      securityGroups: [this.parent.network.serviceSg.id],
      // TODO(security): NAT
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
        containerName: this.options.name,
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
      this.httpsListener,
    ],
  });

  readonly allowRunTaskPolicyDoc = new iam.DataAwsIamPolicyDocument(this, 'allowRunTaskPolicyDoc', {
    version: '2012-10-17',
    statement: [
      {
        // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security_iam_id-based-policy-examples.html#IAM_run_policies
        effect: 'Allow',
        resources: [
          `arn:aws:ecs:${this.parent.aws.region}:${this.parent.options.sharedEnv.AWS_ACCOUNT_ID}:task-definition/${this.definition.family}:*`,
        ],
        actions: ['ecs:RunTask'],
        condition: [
          {
            test: 'ArnEquals',
            variable: 'ecs:cluster',
            values: [this.parent.cluster.arn],
          },
        ],
      },
    ],
  });
}
