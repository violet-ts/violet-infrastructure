import { z } from 'zod';

/**
 * Terraform Output として env stack から出す値
 */
export const opTfOutputSchema = z.object({
  resource_group_name: z.string(),
  api_task_definition_arn: z.string(),
  api_url: z.string(),
  web_url: z.string(),
  env_region: z.string(),
  ecs_cluster_name: z.string(),
  api_task_log_group_name: z.string(),
  web_task_log_group_name: z.string(),
  conv2img_function_name: z.string(),
  api_exec_function_name: z.string(),
  original_bucket: z.string(),
  converted_bucket: z.string(),
});

export type OpTfOutput = z.infer<typeof opTfOutputSchema>;
