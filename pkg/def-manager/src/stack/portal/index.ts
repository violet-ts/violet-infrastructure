import type { acm } from '@cdktf/provider-aws';
import { cloudfront, cognito, dynamodb, route53, s3 } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { StringResource as RandomString } from '@cdktf/provider-random';
import { ApiLambda } from '@self/def-manager/src/stack/portal/api-lambda';
import type { SharedEnv } from '@self/shared/lib/def/env-vars';
import type { ComputedOpEnv } from '@self/shared/lib/operate-env/op-env';
import type { Construct } from 'constructs';
import { AuthLambda } from './auth-lambda';

export interface PortalStackOptions {
  zone: route53.DataAwsRoute53Zone;
  sharedEnv: SharedEnv;
  computedOpEnv: ComputedOpEnv;
  devGroupName: string;
  certificate: acm.DataAwsAcmCertificate;
  tagsAll?: Record<string, string>;
}
export class PortalStack extends Resource {
  constructor(scope: Construct, name: string, public options: PortalStackOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 8,
    lower: true,
    upper: false,
    special: false,
  });

  // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html
  readonly portalTable = new dynamodb.DynamodbTable(this, 'portalTable', {
    name: `violet-man-portal-${this.suffix.result}`,
    billingMode: 'PAY_PER_REQUEST',
    attribute: [
      {
        name: 'id',
        type: 'S',
      },
    ],
    hashKey: 'id',
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly bucket = new s3.S3Bucket(this, 'bucket', {
    bucket: `${this.options.sharedEnv.PORTAL_SUBDOMAIN}.${this.options.zone.name}`,
    acl: 'public-read',

    website: {
      indexDocument: 'index.html',
      errorDocument: '404.html',

      // routingRules: JSON.stringify([
      //   {
      //     Condition: {
      //       KeyPrefixEquals: 'docs/',
      //     },
      //     Redirect: {
      //       ReplaceKeyPrefixWith: 'documents/',
      //     },
      //   },
      // ]),
    },
  });

  readonly cdn = new cloudfront.CloudfrontDistribution(this, 'cdn', {
    origin: [
      {
        originId: `${this.options.sharedEnv.PORTAL_SUBDOMAIN}.${this.options.zone.name}`,
        domainName: this.bucket.bucketRegionalDomainName,
      },
    ],

    aliases: [`${this.options.sharedEnv.PORTAL_SUBDOMAIN}.${this.options.zone.name}`],
    enabled: true,
    isIpv6Enabled: true,
    defaultRootObject: 'index.html',
    defaultCacheBehavior: {
      allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
      cachedMethods: ['GET', 'HEAD'],
      targetOriginId: `${this.options.sharedEnv.PORTAL_SUBDOMAIN}.${this.options.zone.name}`,

      forwardedValues: {
        queryString: true,
        cookies: {
          forward: 'none',
        },
      },

      viewerProtocolPolicy: 'redirect-to-https',
      minTtl: 0,
      defaultTtl: 3600,
      maxTtl: 86400,
    },
    priceClass: 'PriceClass_200',
    restrictions: {
      geoRestriction: {
        restrictionType: 'none',
        locations: [],
      },
    },
    viewerCertificate: {
      acmCertificateArn: this.options.certificate.arn,
      sslSupportMethod: 'sni-only',
    },
  });

  readonly aliasRecord = new route53.Route53Record(this, 'aliasRecord', {
    zoneId: this.options.zone.zoneId,
    type: 'A',
    name: `${this.options.sharedEnv.PORTAL_SUBDOMAIN}.${this.options.zone.name}`,

    alias: [
      {
        name: this.cdn.domainName,
        zoneId: this.cdn.hostedZoneId,
        evaluateTargetHealth: false,
      },
    ],
  });

  readonly authLambda = new AuthLambda(this, 'authLambda', {
    computedOpEnv: this.options.computedOpEnv,
    sharedEnv: this.options.sharedEnv,
    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly userPool = new cognito.CognitoUserPool(this, 'userPool', {
    name: `violet-man-portal-${this.suffix.result}`,
    lambdaConfig: {
      createAuthChallenge: this.authLambda.createLambda.lambda.function.arn,
      defineAuthChallenge: this.authLambda.defineLambda.lambda.function.arn,
      verifyAuthChallengeResponse: this.authLambda.verifyLambda.lambda.function.arn,
    },
    mfaConfiguration: 'OFF',
    // NOTE: Password login is not used.
    passwordPolicy: {
      minimumLength: 16,
    },
    // NOTE: Sign up email not used.
    emailConfiguration: {
      emailSendingAccount: 'COGNITO_DEFAULT',
    },

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly userPoolClient = new cognito.CognitoUserPoolClient(this, 'userPoolClient', {
    userPoolId: this.userPool.id,
    name: 'web',
    accessTokenValidity: 60,
    allowedOauthFlows: ['code'],
    allowedOauthFlowsUserPoolClient: true,
    allowedOauthScopes: ['aws.cognito.signin.user.admin', 'email', 'openid'],
    callbackUrls: ['https://portal.a.violet-dev.com/callback'],
    enableTokenRevocation: true,
    explicitAuthFlows: ['ALLOW_CUSTOM_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
    generateSecret: false,
    idTokenValidity: 60,
    preventUserExistenceErrors: 'ENABLED',
    refreshTokenValidity: 30,
    supportedIdentityProviders: ['COGNITO'],
    tokenValidityUnits: {
      accessToken: 'minutes',
      idToken: 'minutes',
      refreshToken: 'days',
    },
  });

  readonly apiLambda = new ApiLambda(this, 'apiLambda', {
    computedOpEnv: this.options.computedOpEnv,
    tableName: this.portalTable.name,
    userPoolId: this.userPool.id,
    userPoolWebClientId: this.userPoolClient.id,
    devGroupName: this.options.devGroupName,
  });
}
