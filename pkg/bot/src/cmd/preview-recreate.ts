import createCmd from './template/operate-env';

const cmd = createCmd(
  {
    name: 'preview/recreate',
    description: '',
    hidden: false,
  },
  (_env) => ({
    operation: 'recreate',
  }),
);

export default cmd;
