import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import DefaultLayout from '@portal/web/src/components/layout/default';
import LoginForm from '@portal/web/src/components/LoginForm';
import { useUserSession } from '@portal/web/src/contexts/UserSession';
import type { FC } from 'react';

const LoginGuide: FC<{ children: React.ReactElement }> = ({ children }) => {
  const { initializing, userSession } = useUserSession();
  const skeleton = <DefaultLayout body={<Skeleton />} />;
  if (initializing) return skeleton;
  if (userSession === null) {
    const body = (
      <Paper sx={{ p: 4, maxWidth: '640px', mx: 'auto' }}>
        <LoginForm />
      </Paper>
    );
    return <DefaultLayout body={body} />;
  }
  return children;
};

export default LoginGuide;
