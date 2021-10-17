export const setupAws: readonly string[] = [
  'export AWS_PROFILE="violet"  # 対応するプロフィールの名前',
  'export AWS_ACCOUNT_ID="$(aws --profile "$AWS_PROFILE" sts get-caller-identity --query Account --output text)"',
];
