import SendIcon from '@mui/icons-material/Send';
import LoadingButton from '@mui/lab/LoadingButton';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useUserSession } from '@portal/web/src/contexts/UserSession';
import { Amplify, answerCustomChallenge } from '@portal/web/src/lib/amplify';
import type { CognitoUser } from 'amazon-cognito-identity-js';
import type { FC } from 'react';
import { useState } from 'react';

type Phase = 'email' | 'sendEmail' | 'code' | 'sendCode' | 'done';
const LoginForm: FC = () => {
  const { refresh } = useUserSession();
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('email');
  const [cognitoUser, setCognitoUser] = useState<CognitoUser | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const restart = () => {
    setPhase('email');
    setCode('');
  };
  const sendEmail: React.FormEventHandler = (ev) => {
    ev.preventDefault();
    setPhase('sendEmail');
    setErr(null);
    Amplify.Auth.signIn(email)
      .then((user: CognitoUser) => {
        setPhase('code');
        setCognitoUser(user);
      })
      .catch((e: unknown) => {
        setErr(String(e));
        setPhase('email');
      });
  };
  const sendCode: React.FormEventHandler = (ev) => {
    ev.preventDefault();
    setPhase('sendCode');
    setErr(null);
    answerCustomChallenge(cognitoUser!, code)
      .then((user) => {
        setPhase('done');
        return refresh(user);
      })
      .catch((e: unknown) => {
        setErr(String(e));
        setPhase('code');
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

  const emailInput = (
    <Stack spacing={2} onSubmit={sendEmail} component="form">
      <Box sx={{ mx: 'auto' }}>
        <TextField
          label="メールアドレス"
          type="email"
          required
          variant="outlined"
          value={email}
          disabled={phase === 'sendEmail'}
          onChange={(v) => setEmail(v.target.value)}
        />
      </Box>
      <Box sx={{ textAlign: 'center' }}>
        <LoadingButton variant="contained" type="submit" endIcon={<SendIcon />} loading={phase === 'sendEmail'}>
          ログイン用のコードを取得
        </LoadingButton>
      </Box>
    </Stack>
  );

  const codeInput = (
    <>
      <Box sx={{ textAlign: 'center', my: 2 }}>メールアドレス: {email}</Box>
      <Box onSubmit={sendCode} component="form">
        <Stack spacing={2}>
          <Box sx={{ mx: 'auto' }}>
            <TextField
              label="ログインコード"
              required
              variant="outlined"
              value={code}
              disabled={phase === 'sendCode'}
              onChange={(v) => setCode(v.target.value)}
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Stack sx={{ mx: 'auto', textAlign: 'center' }} direction="row" spacing={2}>
              <LoadingButton variant="outlined" onClick={restart} loading={phase === 'sendCode'}>
                メールアドレスを修正
              </LoadingButton>
              <LoadingButton variant="contained" type="submit" endIcon={<SendIcon />} loading={phase === 'sendCode'}>
                送信
              </LoadingButton>
            </Stack>
          </Box>
        </Stack>
      </Box>
    </>
  );

  const doneMessage = <span>すでにログインしています</span>;

  return (
    <Box>
      <Typography variant="h3" component="h3">
        ポータルログイン
      </Typography>
      <Box sx={{ mb: 4 }}>
        <Typography variant="body2" color="text.secondary">
          事前に連絡したメールアドレスでログインしてください。ログインはパスワードを使わず、ログイン用のコードを送信します。
        </Typography>
      </Box>
      {(phase === 'email' || phase === 'sendEmail') && emailInput}
      {(phase === 'code' || phase === 'sendCode') && codeInput}
      {phase === 'done' && doneMessage}
      {errorMessage}
    </Box>
  );
};

export default LoginForm;
