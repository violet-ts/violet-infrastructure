import type { CommentBody } from '../type/cmd';

export const hintSetupAws = (): string[] => [
  'export AWS_PROFILE="violet"  # 対応するプロフィールの名前',
  'export AWS_ACCOUNT_ID="$(aws --profile "$AWS_PROFILE" sts get-caller-identity --query Account --output text)"',
];

interface HowToPullDockerParams {
  imageRegion: string;
  imageRepoName: string;
  imageDigest: string;
}
export const hintHowToPullDocker = ({
  imageRegion,
  imageDigest,
  imageRepoName,
}: HowToPullDockerParams): CommentBody => ({
  main: [
    '```bash',
    ...hintSetupAws(),
    `aws ecr get-login-password --profile "$AWS_PROFILE" --region ${imageRegion} | docker login --username AWS --password-stdin "https://\${AWS_ACCOUNT_ID}.dkr.ecr.${imageRegion}.amazonaws.com"`,
    `export IMAGE="\${AWS_ACCOUNT_ID}.dkr.ecr.${imageRegion}.amazonaws.com/${imageRepoName}@${imageDigest}"`,
    `export PORT="8080"`,
    `docker pull "$IMAGE"`,
    ``,
    `# docker run --rm -it "$IMAGE"`,
    `# docker run --rm -it -p "$PORT:80" "$IMAGE"`,
    `# docker run --rm -it --entrypoint '' "$IMAGE" /bin/ash`,
    `# docker run --rm -it --entrypoint '' "$IMAGE" /bin/bash`,
    `# docker rmi "$IMAGE"`,
    '```',
  ],
});
