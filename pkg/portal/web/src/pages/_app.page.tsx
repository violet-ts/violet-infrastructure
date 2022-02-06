import CssBaseline from '@mui/material/CssBaseline';
import LoginGuide from '@portal/web/src/components/LoginGuide';
import { UserSessionProvider } from '@portal/web/src/contexts/UserSession';
import type { AppProps } from 'next/app';
import type { FC } from 'react';
import React from 'react';

const App: FC<AppProps> = ({ Component, pageProps }) => {
  return (
    <React.Fragment>
      <CssBaseline />
      <UserSessionProvider>
        <LoginGuide>
          <Component {...pageProps} />
        </LoginGuide>
      </UserSessionProvider>
    </React.Fragment>
  );
};

export default App;
