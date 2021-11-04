import createCmd from './template/build-container';

const cmd = createCmd(
  {
    name: 'build/lambda/conv2img',
    where: 'pr',
    description: 'Lambda for conv2img イメージをビルド',
    hidden: false,
  },
  (env) => ({
    imageRepoName: env.LAMBDA_REPO_NAME,
    buildDockerfile: './docker/lambda/conv2img/Dockerfile',
    projectName: env.LAMBDA_BUILD_PROJECT_NAME,
    dockerBuildArgs: '',
  }),
);
export default cmd;
