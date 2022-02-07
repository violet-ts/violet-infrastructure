import { CognitoIdentityProvider } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import type { Credentials, Provider } from '@aws-sdk/types';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { PortalEnv } from '@self/shared/lib/portal/lambda/env';

export type Role = 'admin' | 'normal';
export interface User {
  id: string;
  role: Role;
}
export interface PoolUser {
  createdAt: string;
  enabled: boolean;
}
export interface UserStatus {
  user: User;
  inDb: boolean;
  inPool: boolean;
  poolUser?: PoolUser;
}

export const itemToUser = (item: any): User => {
  return {
    id: item.id,
    role: item.role || 'normal',
  };
};

export interface EnsureAndGetUserParams {
  env: PortalEnv;
  credentials: Credentials | Provider<Credentials>;
  email: string;
}
export const ensureAndGetUser = async ({ env, credentials, email }: EnsureAndGetUserParams): Promise<User> => {
  const db = new DynamoDB({ credentials });
  const { Item: item0 } = await db.getItem({
    TableName: env.PORTAL_TABLE_NAME,
    Key: {
      id: {
        S: email,
      },
    },
  });
  if (item0 == null) {
    await db.putItem({
      TableName: env.PORTAL_TABLE_NAME,
      Item: {
        id: { S: email },
      },
    });
    return itemToUser({ id: email });
  }
  return itemToUser(unmarshall(item0));
};

export interface ListUserParams {
  env: PortalEnv;
  credentials: Credentials | Provider<Credentials>;
}
export const listUsers = async ({ env, credentials }: ListUserParams): Promise<UserStatus[]> => {
  const cognito = new CognitoIdentityProvider({ credentials });
  const db = new DynamoDB({ credentials });
  const { Items } = await db.scan({
    TableName: env.PORTAL_TABLE_NAME,
  });
  const { Users } = await cognito.listUsers({
    UserPoolId: env.PORTAL_USER_POOL_ID,
  });
  const users = Object.fromEntries(
    (Items ?? [])
      .map((item) => ({ user: itemToUser(unmarshall(item)), inList: true, inDb: true, inPool: false }))
      .map((e) => [e.user.id, e]),
  );
  for (const User of Users ?? []) {
    const email = User.Attributes?.find((e) => e.Name === 'email')?.Value;
    if (email == null) continue;
    users[email] = {
      inDb: false,
      user: itemToUser({
        id: User.Username,
      }),
      ...(users[email] as any),
      inPool: true,
      poolUser: {
        createdAt: User.UserCreateDate!.toISOString(),
        enabled: User.Enabled,
      },
    };
  }
  return Object.values(users);
};

export interface AddUserParams {
  env: PortalEnv;
  credentials: Credentials | Provider<Credentials>;
  email: string;
}
export const addUser = async ({ env, credentials, email }: AddUserParams): Promise<void> => {
  const cognito = new CognitoIdentityProvider({ credentials });
  await cognito.adminCreateUser({
    UserPoolId: env.PORTAL_USER_POOL_ID,
    Username: email,
    UserAttributes: [
      {
        Name: 'email',
        Value: email,
      },
    ],
    MessageAction: 'SUPPRESS',
  });
  await ensureAndGetUser({ env, credentials, email });
};

export interface DeleteUserParams {
  env: PortalEnv;
  credentials: Credentials | Provider<Credentials>;
  email: string;
}
export const deleteUser = async ({ env, credentials, email }: DeleteUserParams): Promise<void> => {
  const db = new DynamoDB({ credentials });
  const cognito = new CognitoIdentityProvider({ credentials });
  await Promise.all([
    cognito.adminDeleteUser({
      UserPoolId: env.PORTAL_USER_POOL_ID,
      Username: email,
    }),
    db.deleteItem({
      TableName: env.PORTAL_TABLE_NAME,
      Key: {
        id: { S: email },
      },
    }),
  ]);
};

export interface SetUserRoleParams {
  env: PortalEnv;
  credentials: Credentials | Provider<Credentials>;
  email: string;
  role: string;
}
export const setUserRole = async ({ env, credentials, email, role }: SetUserRoleParams): Promise<void> => {
  const db = new DynamoDB({ credentials });
  await db.updateItem({
    TableName: env.PORTAL_TABLE_NAME,
    Key: {
      id: { S: email },
    },
    UpdateExpression: 'SET #key = :role',
    ExpressionAttributeNames: {
      '#key': 'role',
    },
    ExpressionAttributeValues: {
      ':role': {
        S: role,
      },
    },
  });
};
