import { embedArgsBuildArgs } from '@self/shared/lib/util/docker';
import createCmd from './template/build-container';

const cmd = createCmd(
  {
    name: 'build/web',
    description: 'Web イメージをビルド',
    hidden: false,
  },
  (env, namespace) => ({
    imageRepoName: env.WEB_REPO_NAME,
    buildDockerfile: './docker/prod/web/Dockerfile',
    projectName: env.WEB_BUILD_PROJECT_NAME,
    dockerBuildArgs: embedArgsBuildArgs({
      API_ORIGIN: `https://api-${namespace}.${env.PREVIEW_DOMAIN}`,
    }),
  }),
);
export default cmd;
