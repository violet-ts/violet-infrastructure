import createCmd from './template/operate-env';

const cmd = createCmd(
  {
    name: 'preview/force-destroy',
    where: 'pr',
    description: '先に /build が必要',
    hidden: false,
  },
  (_env) => ({
    operation: 'status',
  }),
);

export default cmd;
