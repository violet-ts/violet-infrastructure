import createCmd from './template/operate-env';

const cmd = createCmd(
  {
    name: 'preview/status',
    description: '',
    hidden: false,
  },
  (_env) => ({
    operation: 'status',
  }),
);

export default cmd;
