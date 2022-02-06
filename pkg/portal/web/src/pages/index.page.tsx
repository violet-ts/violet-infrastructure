import useAspidaSWR from '@aspida/swr';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import DefaultLayout from '@portal/web/src/components/layout/default';
import { useApi } from '@portal/web/src/hooks/useApi';
import { pagesPath } from '@portal/web/src/lib/$path';
import type { NextPage } from 'next';
import NextLink from 'next/link';

const IndexPage: NextPage = () => {
  const api = useApi();
  const { data: roleResult } = useAspidaSWR(api.normal.role);

  const awsHint = (
    <>
      <Typography>
        <NextLink href={pagesPath.aws.$url().pathname} passHref>
          <Link>「AWSアカウント」</Link>
        </NextLink>
        から自分用のAWSアカウントが取得できます。
      </Typography>
      <Typography>violetを開発する際に役立ちます。</Typography>
    </>
  );
  const adminHint = (
    <>
      <Typography>あなたはadminユーザーです。</Typography>
      <Typography>
        <NextLink href={pagesPath.users.$url().pathname} passHref>
          <Link>「ユーザー管理」</Link>
        </NextLink>
        から開発者アカウントの管理を行えます。
      </Typography>
    </>
  );

  const body = (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6} lg={4}>
        <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>{awsHint}</Paper>
      </Grid>
      {roleResult?.role === 'admin' && (
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>{adminHint}</Paper>
        </Grid>
      )}
    </Grid>
  );

  const head = (
    <>
      <Typography component="h1" variant="h6" color="inherit" noWrap sx={{ flexGrow: 1 }}>
        案内
      </Typography>
    </>
  );

  return <DefaultLayout body={body} head={head} />;
};

export default IndexPage;
