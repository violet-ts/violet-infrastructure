import useAspidaSWR from '@aspida/swr';
import LoadingButton from '@mui/lab/LoadingButton';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { Role } from '@portal/api/src/util/user';
import DefaultLayout from '@portal/web/src/components/layout/default';
import { useApi } from '@portal/web/src/hooks/useApi';
import type { FC } from 'react';
import { useState } from 'react';

interface AddUserProps {
  onAdd?: () => void;
}
const AddUser: FC<AddUserProps> = ({ onAdd }) => {
  const [newEmail, setNewEmail] = useState('');
  const [phase, setPhase] = useState('email');
  const [err, setErr] = useState<string | null>(null);
  const api = useApi();
  const send = (ev: React.FormEvent): void => {
    ev.preventDefault();
    setPhase('sendEmail');
    setErr(null);

    api.admin.users
      ._id(newEmail)
      .post({})
      .then(() => {
        setPhase('email');
        setNewEmail('');
        onAdd?.();
      })
      .catch((e: unknown) => {
        setPhase('email');
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
    <Box>
      <Typography variant="h5">ユーザーの登録</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        normalロールで追加されます。adminを追加する場合は、追加後に変更を行ってください。
      </Typography>
      <Box component="form" onSubmit={send}>
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <TextField
            value={newEmail}
            label="メールアドレス"
            onChange={(ev) => setNewEmail(ev.target.value)}
            type="email"
            disabled={phase !== 'email'}
            required
          />
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <LoadingButton variant="contained" type="submit" loading={phase !== 'email'}>
            追加
          </LoadingButton>
        </Box>
        {errorMessage}
      </Box>
    </Box>
  );
};

const DashboardContent: React.FC = () => {
  const api = useApi();
  const { data: usersResult, mutate, isValidating } = useAspidaSWR(api.admin.users);

  const sendDeleteUser = (id: string) => {
    api.admin.users
      ._id(id)
      .delete({})
      .finally(() => {
        return mutate();
      });
  };

  const sendRoleUpdate = (id: string, role: Role) => {
    api.admin.users
      ._id(id)
      .patch({ body: { role } })
      .finally(() => {
        return mutate();
      });
  };

  const tableBody = (usersResult?.users ?? []).map((user) => {
    return (
      <TableRow key={user.user.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
        <TableCell component="th" scope="row">
          {user.user.id}
        </TableCell>
        <TableCell>
          <Autocomplete
            disabled={isValidating}
            options={['normal', 'admin']}
            disableClearable={true as any}
            value={isValidating ? '...' : user.user.role}
            onChange={(_ev, newValue) => sendRoleUpdate(user.user.id, newValue as Role)}
            renderInput={(params) => <TextField {...params} label="role" variant="standard" />}
          />
        </TableCell>
        <TableCell>{user.inDb ? 'YES' : 'NO'}</TableCell>
        <TableCell>{user.inDb ? 'YES' : 'NO'}</TableCell>
        <TableCell>{JSON.stringify(user.poolUser?.enabled)}</TableCell>
        <TableCell>
          <Button
            variant="contained"
            color="error"
            onClick={() => sendDeleteUser(user.user.id)}
            disabled={user.user.role === 'admin'}
          >
            削除
          </Button>
        </TableCell>
      </TableRow>
    );
  });

  const userTable = (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>メール</TableCell>
            <TableCell>ロール</TableCell>
            <TableCell>DB</TableCell>
            <TableCell>Cognito</TableCell>
            <TableCell>有効</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>{usersResult ? tableBody : <Skeleton />}</TableBody>
      </Table>
    </TableContainer>
  );
  const body = (
    <Grid container spacing={3}>
      <Grid item xs={12} md={12} lg={12}>
        {userTable}
      </Grid>
      <Grid item xs={12} md={6} lg={4}>
        <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
          <AddUser onAdd={mutate} />
        </Paper>
      </Grid>
      <Grid item xs={12} md={6} lg={4}>
        <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h5">ヒント</Typography>
          <Typography>adminユーザは削除できません。</Typography>
          <Typography>ログインは常にメール経由になります。</Typography>
          <Typography>パスワードを使用してのログインはできません。</Typography>
          <Typography>自分自身のロールを変更することはできません。</Typography>
        </Paper>
      </Grid>
    </Grid>
  );

  const head = (
    <>
      <Typography component="h1" variant="h6" color="inherit" noWrap sx={{ flexGrow: 1 }}>
        ユーザー管理
      </Typography>
    </>
  );

  return <DefaultLayout body={body} head={head} />;
};

export default DashboardContent;
