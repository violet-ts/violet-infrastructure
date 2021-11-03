import createCmd from './template/operate-env';

const cmd = createCmd(
  {
    name: 'preview/recreate',
    where: 'pr',
    description: '先に /build が必要',
    hidden: false,
  },
  (_env) => ({
    operation: 'recreate',
  }),
);

export default cmd;
