import useAspidaSWR from '@aspida/swr';
import LoadingButton from '@mui/lab/LoadingButton';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import DefaultLayout from '@portal/web/src/components/layout/default';
import { useApi } from '@portal/web/src/hooks/useApi';
import type { FC } from 'react';
import { useState } from 'react';

interface CreateUserProps {
  onCreate?: () => void;
}
const CreateUser: FC<CreateUserProps> = ({ onCreate }) => {
  const [phase, setPhase] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const api = useApi();
  const send = (ev: React.FormEvent): void => {
    ev.preventDefault();
    setPhase('send');
    setErr(null);

    api.normal.awsiam
      .post({})
      .then(() => {
        setPhase('');
        onCreate?.();
      })
      .catch((e: unknown) => {
        setPhase('');
        setErr(String(e));
      });
  };
  const errorMessage = err && (
    <Box sx={{ maxWidth: '300px', mx: 'auto', mt: 2 }}>
      <Typography color="error">{err}</Typography>
      <Typography color="error">
        メールアドレスを確認してください。それでも解決しない場合は、上記エラー文を管理者に問い合わせてください。
      </Typography>
    </Box>
  );
  return (
    <Box sx={{ textAlign: 'center' }}>
      <LoadingButton variant="contained" loading={phase !== ''} onClick={send}>
        IAMアカウントを作成
      </LoadingButton>
      {errorMessage}
    </Box>
  );
};

interface CreateKeyProps {
  onCreate?: (secretAccessKey: string) => void;
  disabled?: boolean;
}
const CreateKey: FC<CreateKeyProps> = ({ onCreate, disabled }) => {
  const [phase, setPhase] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const api = useApi();
  const send = (ev: React.FormEvent): void => {
    ev.preventDefault();
    setPhase('send');
    setErr(null);

    api.normal.awsiam.accesskey
      .post({})
      .then(
        ({
          body: {
            secret: { secretAccessKey },
          },
        }) => {
          setPhase('');
          onCreate?.(secretAccessKey);
        },
      )
      .catch((e: unknown) => {
        setPhase('');
        setErr(String(e));
      });
  };
  const errorMessage = err && (
    <Box sx={{ maxWidth: '300px', mx: 'auto', mt: 2 }}>
      <Typography color="error">{err}</Typography>
      <Typography color="error">
        メールアドレスを確認してください。それでも解決しない場合は、上記エラー文を管理者に問い合わせてください。
      </Typography>
    </Box>
  );
  return (
    <Box sx={{ textAlign: 'center' }}>
      <LoadingButton variant="contained" loading={phase !== ''} onClick={send} disabled={disabled}>
        IAMアクセスキーを作成
      </LoadingButton>
      {errorMessage}
    </Box>
  );
};

const DashboardContent: React.FC = () => {
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const api = useApi();
  const { data: awsIamResult, mutate: mutateAwsIam } = useAspidaSWR(api.normal.awsiam);
  const { data: accessKeyResult, mutate: mutateAccessKey } = useAspidaSWR(api.normal.awsiam.accesskey);
  const mutate = () => {
    return Promise.all([mutateAwsIam(), mutateAccessKey()]);
  };
  const [updatingKey, setUpdatingKey] = useState(false);
  const [deletingKey, setDeletingKey] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  const sendUpdateKey = () => {
    setUpdatingKey(true);
    api.normal.awsiam.accesskey
      .post({})
      .then(
        ({
          body: {
            secret: { secretAccessKey: s },
          },
        }) => {
          setSecretAccessKey(s);
        },
      )
      .finally(() => {
        setUpdatingKey(false);
        return mutate();
      });
  };
  const sendDeleteKey = () => {
    setDeletingKey(true);
    api.normal.awsiam.accesskey.delete({}).finally(() => {
      setDeletingKey(false);
      return mutate();
    });
  };
  const sendDeleteUser = () => {
    setDeletingUser(true);
    api.normal.awsiam.delete({}).finally(() => {
      setDeletingUser(false);
      return mutate();
    });
  };

  const user = awsIamResult && (
    <>
      {awsIamResult.iamUser ? (
        <Box>
          <Typography variant="h4">AWS IAMアカウント</Typography>
          <Typography>arn: {awsIamResult.iamUser.arn}</Typography>
          <Typography>path: {awsIamResult.iamUser.path}</Typography>
          <Typography>username: {awsIamResult.iamUser.username}</Typography>
          <LoadingButton variant="contained" color="error" onClick={() => sendDeleteUser()} loading={deletingUser}>
            削除
          </LoadingButton>
        </Box>
      ) : (
        <CreateUser onCreate={mutate} />
      )}
    </>
  );

  const key = accessKeyResult && (
    <>
      {accessKeyResult.id != null ? (
        <Box>
          <Typography variant="h4">AWS IAM アクセスキー</Typography>
          <Typography>AccessKeyId: {accessKeyResult.id}</Typography>
          <Typography>SecretAccessKey: {secretAccessKey || '生成時にのみ表示されます'}</Typography>
          <Stack sx={{ mx: 'auto', textAlign: 'center' }} direction="row" spacing={2}>
            <LoadingButton
              variant="contained"
              color="error"
              onClick={() => sendUpdateKey()}
              loading={updatingKey}
              disabled={deletingKey}
            >
              再発行
            </LoadingButton>
            <LoadingButton
              variant="contained"
              color="error"
              onClick={() => sendDeleteKey()}
              loading={deletingKey}
              disabled={updatingKey}
            >
              削除
            </LoadingButton>
          </Stack>
        </Box>
      ) : (
        <CreateKey
          disabled={!awsIamResult?.iamUser}
          onCreate={(s) => {
            setSecretAccessKey(s);
            void mutate();
          }}
        />
      )}
    </>
  );

  const hint = (
    <>
      <Typography variant="h5">ヒント</Typography>
      <Typography>
        シークレットキーを喪失した場合は再発行してください。このとき、古いアクセスキーは無効になります。
      </Typography>
    </>
  );

  const body = (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6} lg={6}>
        <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>{user}</Paper>
      </Grid>
      <Grid item xs={12} md={6} lg={6}>
        <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>{key}</Paper>
      </Grid>
      <Grid item xs={12} md={4} lg={3}>
        <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>{hint}</Paper>
      </Grid>
    </Grid>
  );

  const head = (
    <>
      <Typography component="h1" variant="h6" color="inherit" noWrap sx={{ flexGrow: 1 }}>
        AWS
      </Typography>
    </>
  );

  return <DefaultLayout body={body} head={head} />;
};

export default DashboardContent;
