import createCmd from './template/operate-env';

const cmd = createCmd(
  {
    name: 'preview/force-destroy',
    description: '',
    hidden: false,
  },
  (_env) => ({
    operation: 'destroy',
  }),
);

export default cmd;
