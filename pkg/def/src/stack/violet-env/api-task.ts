import { ECS, ELB, ACM, Route53, IAM, VPC } from '@cdktf/provider-aws';
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
  defaultTags?: Record<string, string>;
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

  readonly subdomain = `api-${this.parent.options.envEnv.NAMESPACE}`;

  readonly certificate = new ACM.AcmCertificate(this, 'certificate', {
    domainName: `${this.subdomain}.${this.parent.zone.name}`,
    validationMethod: 'DNS',
  });

  // TODO: Use https://github.com/azavea/terraform-aws-acm-certificate instead.
  readonly validationRecords = (() => {
    const tmp = new Route53.Route53Record(this, 'validationRecords', {
      allowOverwrite: true,
      name: `\${each.value.name}`,
      records: [`\${each.value.record}`],
      ttl: 60,
      type: `\${each.value.type}`,
      zoneId: z.string().parse(this.parent.zone.zoneId),
    });
    // TODO(blocked): https://github.com/hashicorp/terraform-cdk/issues/42
    tmp.addOverride(
      'for_each',
      [
        `\${{`,
        `  for dvo in ${this.certificate.fqn}.domain_validation_options : dvo.domain_name => {`,
        `    name   = dvo.resource_record_name`,
        `    record = dvo.resource_record_value`,
        `    type   = dvo.resource_record_type`,
        `  }`,
        `}}`,
      ].join('\n'),
    );
    return tmp;
  })();

  readonly certificateValidation = (() => {
    const tmp = new ACM.AcmCertificateValidation(this, 'certificateValidation', {
      certificateArn: this.certificate.arn,
    });
    // TODO(blocked): https://github.com/hashicorp/terraform-cdk/issues/42
    tmp.addOverride('validation_record_fqdns', `\${[for record in ${this.validationRecords.fqn} : record.fqdn]}`);
    return tmp;
  })();

  // TODO(service): prod availavility
  readonly subnets = [this.parent.publicSubnets[0], this.parent.publicSubnets[1]];

  readonly lbSg = new VPC.SecurityGroup(this, 'lbSg', {
    name: `${this.options.prefix}-lb-${this.suffix.result}`,
    vpcId: this.parent.vpc.id,
    egress: [
      {
        fromPort: 0,
        toPort: 0,
        protocol: '-1',
        cidrBlocks: ['0.0.0.0/0'],
        ipv6CidrBlocks: ['::/0'],
      },
    ],
    ingress: [
      {
        fromPort: 0,
        toPort: 0,
        protocol: '-1',
        cidrBlocks: ['0.0.0.0/0'],
        ipv6CidrBlocks: ['::/0'],
      },
    ],
    tagsAll: {
      ...this.options.defaultTags,
    },
  });

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lb
  readonly alb = new ELB.Alb(this, 'alb', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    internal: false,
    loadBalancerType: 'application',
    securityGroups: [this.lbSg.id],
    ipAddressType: 'dualstack',

    subnets: this.subnets.map((subnet) => subnet.id),

    tagsAll: {
      ...this.options.defaultTags,
    },

    dependsOn: [
      // NOTE(depends): wait certificate validation
      this.certificateValidation,
      // NOTE(depends): wait IGW setup
      this.parent.publicRouteIgw,
      this.parent.publicRouteIgw6,
    ],
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
    vpcId: this.parent.vpc.id,

    tagsAll: {
      ...this.options.defaultTags,
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
    certificateArn: this.certificate.arn,

    defaultAction: [
      {
        type: 'forward',
        targetGroupArn: this.backend.arn,
      },
    ],

    tagsAll: {
      ...this.options.defaultTags,
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
      ...this.options.defaultTags,
    },
  });

  readonly executionPolicyDocument = new IAM.DataAwsIamPolicyDocument(this, 'executionPolicyDocument', {
    version: '2012-10-17',
    statement: [
      {
        // TODO(security): restrict
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: ['*'],
      },
      {
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      },
      {
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
      ...this.options.defaultTags,
    },
  });

  readonly taskPolicyDocument = new IAM.DataAwsIamPolicyDocument(this, 'taskPolicyDocument', {
    version: '2012-10-17',
    statement: [
      {
        actions: ['s3:*'],
        resources: [this.parent.s3.arn],
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
        // TODO(hardcoded)
        image: `${this.parent.options.sharedEnv.AWS_ACCOUNT_ID}.dkr.ecr.${this.parent.aws.region}.amazonaws.com/violet-dev-api@sha256:e72b91647d18b4778e4ab869a0aecb92041fabb5e29de09b7094e0a8a7f6a1cf`,
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
        ],
        portMappings: [
          {
            containerPort: 80,
            hostPort: 80,
            protocol: 'tcp',
          },
        ],
      },
    ]),
    cpu: '256',
    memory: '512',
    family: 'api',

    tagsAll: {
      ...this.options.defaultTags,
    },
  });

  readonly cnameRecord = new Route53.Route53Record(this, 'cnameRecord', {
    zoneId: z.string().parse(this.parent.zone.zoneId),
    type: 'CNAME',
    ttl: 5,
    name: this.subdomain,
    records: [this.alb.dnsName],
  });

  readonly serviceSg = new VPC.SecurityGroup(this, 'serviceSg', {
    name: `${this.options.prefix}-svc-${this.suffix.result}`,
    vpcId: this.parent.vpc.id,
    egress: [
      {
        fromPort: 0,
        toPort: 0,
        protocol: '-1',
        cidrBlocks: ['0.0.0.0/0'],
        ipv6CidrBlocks: ['::/0'],
      },
    ],
    ingress: [
      {
        fromPort: 0,
        toPort: 0,
        protocol: '-1',
        securityGroups: [this.lbSg.id],
      },
    ],
    tagsAll: {
      ...this.options.defaultTags,
    },
  });

  // https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/ecs_service
  // https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_Service.html
  readonly service = new ECS.EcsService(this, 'service', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    networkConfiguration: {
      subnets: this.parent.publicSubnets.map((subnet) => subnet.id),
      securityGroups: [this.serviceSg.id],
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
      ...this.options.defaultTags,
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
