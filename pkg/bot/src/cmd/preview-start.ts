import createCmd from './template/operate-env';

const cmd = createCmd(
  {
    name: 'preview/start',
    where: 'pr',
    description: '先に /build が必要',
    hidden: false,
  },
  (_env) => ({
    operation: 'deploy',
  }),
);

export default cmd;
