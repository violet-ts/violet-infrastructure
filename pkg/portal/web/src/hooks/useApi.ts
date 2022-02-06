import aspida from '@aspida/fetch';
import api from '@portal/api/api/$api';
import { useUserSession } from '@portal/web/src/contexts/UserSession';
import { apiClient, aspidaConfig } from '@portal/web/src/lib/api-client';
import { useMemo } from 'react';

export const useApi = () => {
  const { userSession } = useUserSession();
  const apiWithAuth = useMemo<typeof apiClient>(() => {
    if (userSession == null) return apiClient;
    const token = userSession.getIdToken().getJwtToken();
    return api(
      aspida(undefined, {
        ...aspidaConfig,
        headers: {
          authorization: `Bearer ${token}`,
        },
      }),
    );
  }, [userSession]);
  return apiWithAuth;
};
