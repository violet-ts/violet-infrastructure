import createCmd from './template/operate-env';

const cmd = createCmd(
  {
    name: 'preview/start',
    description: '',
    hidden: false,
  },
  (_env) => ({
    operation: 'deploy',
  }),
);

export default cmd;
