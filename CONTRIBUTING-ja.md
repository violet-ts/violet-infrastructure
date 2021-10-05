# CONTRIBUTING

WIP

## Links

- https://www.hashicorp.com/blog/cdk-for-terraform-enabling-python-and-typescript-support
- https://github.com/hashicorp/terraform-provider-aws
- https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/CHAP_TemplateQuickRef.html

## Development Cycle

- `cdktf` cli は直接使わずに npm scripts 経由で使用します。
- `cp .env.local.example .env.local` とし、 `.env.local` で必要な設定をコメントに沿って設定してください。
- `pnpm deploy:manager`, `pnpm deploy:env` でデプロイできます。コンパイルはしてくれます。
- `manager`: 管理層になります。いろいろな設定値のインフラを作る上で、一個だけ存在しておけばよいというもの
- `env`: 各環境向けのインフラ郡の単位

## TODO comment scopes

- (service): サービス品質に関するもの
- (security): セキュリティに関するもの
- (logging): ログに関するもの
- (cost): コストに関するもの
- (scale): スケーリングに関するもの

## FAQ

- テンプレートと構造を変えた部分はどこですか
  - 複数の環境を管理します
  - ステートファイル類は `.state/<name>/` 配下で管理
  - `.gen/` すべての環境で同じものを使う、固定するというところで git 管理しています
    - `pnpm get` で更新します
