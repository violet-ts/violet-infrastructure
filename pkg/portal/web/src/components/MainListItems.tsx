import useAspidaSWR from '@aspida/swr';
import { Amazonaws } from '@icons-pack/react-simple-icons';
import LogoutIcon from '@mui/icons-material/Logout';
import MapIcon from '@mui/icons-material/Map';
import PeopleIcon from '@mui/icons-material/People';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import { useUserSession } from '@portal/web/src/contexts/UserSession';
import { useApi } from '@portal/web/src/hooks/useApi';
import { pagesPath } from '@portal/web/src/lib/$path';
import { Amplify } from '@portal/web/src/lib/amplify';
import Link from 'next/link';
import type { FC } from 'react';

const MainListItems: FC = () => {
  const { initializing, userSession, refresh } = useUserSession();
  const api = useApi();
  const { data: roleResult } = useAspidaSWR(api.normal.role);
  const logout = async () => {
    await Amplify.Auth.signOut();
    await refresh();
  };
  const skeleton = (
    <>
      <Skeleton />
    </>
  );
  if (initializing) return skeleton;
  if (userSession === null) return <></>;
  return (
    <>
      <Link href={pagesPath.$url().pathname} passHref>
        <ListItem button component="a">
          <ListItemIcon>
            <MapIcon />
          </ListItemIcon>
          <ListItemText primary="案内" />
        </ListItem>
      </Link>
      {roleResult?.role === 'admin' && (
        <Link href={pagesPath.users.$url().pathname} passHref>
          <ListItem button component="a">
            <ListItemIcon>
              <PeopleIcon />
            </ListItemIcon>
            <ListItemText primary="ユーザー管理" />
          </ListItem>
        </Link>
      )}
      <Link href={pagesPath.aws.$url().pathname} passHref>
        <ListItem button component="a">
          <ListItemIcon>
            <Amazonaws />
          </ListItemIcon>
          <ListItemText primary="AWSアカウント" />
        </ListItem>
      </Link>
      <ListItem button onClick={logout}>
        <ListItemIcon>
          <LogoutIcon />
        </ListItemIcon>
        <ListItemText primary="ログアウト" />
      </ListItem>
    </>
  );
};

export default MainListItems;
