import { IAM } from '@aws-sdk/client-iam';
import type { Credentials, Provider } from '@aws-sdk/types';
import { RESOURCE_DEV_IAM_PATH } from '@self/shared/lib/const';
import type { PortalEnv } from '@self/shared/lib/portal/lambda/env';
import hash from 'object-hash';

export interface IAMUser {
  arn: string;
  path: string;
  username: string;
}

export interface IAMSecret {
  accessKeyId: string;
  secretAccessKey: string;
}

const getIamId = (email: string) => {
  return hash({ email, project: 'violet' }).slice(0, 10);
};

export interface GetIAMUserParams {
  env: PortalEnv;
  credentials: Credentials | Provider<Credentials>;
  email: string;
}
export const getIAMUser = async ({ credentials, email }: GetIAMUserParams): Promise<IAMUser | null> => {
  const iam = new IAM({ credentials });
  const iamId = getIamId(email);
  try {
    const { User } = await iam.getUser({
      UserName: iamId,
    });
    if (User == null) return null;
    return {
      arn: User.Arn!,
      path: User.Path!,
      username: User.UserName!,
    };
  } catch (e: unknown) {
    return null;
  }
};

export interface CreateIAMUser {
  env: PortalEnv;
  credentials: Credentials | Provider<Credentials>;
  email: string;
}
export const createIAMUser = async ({ env, credentials, email }: CreateIAMUser): Promise<IAMUser> => {
  const iam = new IAM({ credentials });
  const iamId = getIamId(email);
  const user = await iam.createUser({
    UserName: iamId,
    Path: RESOURCE_DEV_IAM_PATH,
  });
  await iam.addUserToGroup({ UserName: iamId, GroupName: env.PORTAL_IAM_DEV_GROUP });
  return {
    arn: user.User!.Arn!,
    path: user.User!.Path!,
    username: user.User!.UserName!,
  };
};

export interface GetIAMUserKeyId {
  env: PortalEnv;
  credentials: Credentials | Provider<Credentials>;
  email: string;
}
export const getIAMUserKeyId = async ({ credentials, email }: GetIAMUserKeyId): Promise<string | null> => {
  const iam = new IAM({ credentials });
  const iamId = getIamId(email);
  const keysResult = await iam.listAccessKeys({ UserName: iamId });
  const list = keysResult.AccessKeyMetadata ?? [];
  if (list.length === 0) return null;
  return list[0].AccessKeyId!;
};

export interface CreateIAMUserKey {
  env: PortalEnv;
  credentials: Credentials | Provider<Credentials>;
  email: string;
}
export const createIAMUserKey = async ({ env, credentials, email }: CreateIAMUserKey): Promise<IAMSecret> => {
  const iam = new IAM({ credentials });
  const iamId = getIamId(email);
  await deleteIAMUserKey({ env, credentials, email });
  const createResult = await iam.createAccessKey({ UserName: iamId });
  return {
    accessKeyId: createResult.AccessKey!.AccessKeyId!,
    secretAccessKey: createResult.AccessKey!.SecretAccessKey!,
  };
};

export interface DeleteIAMUserKey {
  env: PortalEnv;
  credentials: Credentials | Provider<Credentials>;
  email: string;
}
export const deleteIAMUserKey = async ({ credentials, email }: DeleteIAMUserKey): Promise<void> => {
  const iam = new IAM({ credentials });
  const iamId = getIamId(email);
  const keysResult = await iam.listAccessKeys({ UserName: iamId });
  for (const { AccessKeyId } of keysResult.AccessKeyMetadata ?? []) {
    await iam.deleteAccessKey({ UserName: iamId, AccessKeyId });
  }
};

export interface DeleteIAMUser {
  env: PortalEnv;
  credentials: Credentials | Provider<Credentials>;
  email: string;
}
export const deleteIAMUser = async ({ env, credentials, email }: DeleteIAMUser): Promise<void> => {
  const iam = new IAM({ credentials });
  const iamId = getIamId(email);
  await iam.removeUserFromGroup({ UserName: iamId, GroupName: env.PORTAL_IAM_DEV_GROUP });
  await deleteIAMUserKey({ env, credentials, email });
  await iam.deleteUser({
    UserName: iamId,
  });
};
