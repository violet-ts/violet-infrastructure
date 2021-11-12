import createCmd from './template/build-container';

const cmd = createCmd(
  {
    name: 'build/lambda/conv2img',
    description: 'Lambda for conv2img イメージをビルド',
    hidden: false,
  },
  (env) => ({
    imageRepoName: env.LAMBDA_CONV2IMG_REPO_NAME,
    buildDockerfile: './docker/prod/lambda/conv2img/Dockerfile',
    projectName: env.LAMBDA_CONV2IMG_BUILD_PROJECT_NAME,
    dockerBuildArgs: '',
  }),
);
export default cmd;
