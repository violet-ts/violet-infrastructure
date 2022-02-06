import { Amplify } from '@portal/web/src/lib/amplify';
import type { CognitoUserSession } from 'amazon-cognito-identity-js';
import type { FC } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

export interface UserSessionContext {
  initializing: boolean;
  userSession: CognitoUserSession | null;
  refresh(cognitoUser?: CognitoUserSession | null): Promise<CognitoUserSession | null>;
}
export const userSessionContext = createContext<UserSessionContext>({
  initializing: true,
  userSession: null,
  refresh: () => Promise.reject(new Error('yet injected')),
});

export const useUserSession = () => useContext<UserSessionContext>(userSessionContext);

export const UserSessionProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
  const [initializing, setInitializing] = useState(true);
  const [userSession, setUserSession] = useState<CognitoUserSession | null>(null);
  const refresh = async (cognitoUser?: CognitoUserSession | null) => {
    if (cognitoUser === undefined) {
      const user = await Amplify.Auth.currentSession().catch(() => null);
      setInitializing(false);
      setUserSession(user);
      return user;
    }
    setInitializing(false);
    setUserSession(cognitoUser);
    return cognitoUser;
  };
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <userSessionContext.Provider
      value={{
        initializing,
        userSession,
        refresh,
      }}
    >
      {children}
    </userSessionContext.Provider>
  );
};
