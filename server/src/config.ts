export interface ServerConfig {
  port: number;
  envId: string;
  accessKey?: string;
  region?: string;
  secretId?: string;
  secretKey?: string;
  sessionToken?: string;
  trustProxyHops: number;
}

function integer(value: string | undefined, fallback: number, min: number, max: number, name: string): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} 必须是 ${min} 到 ${max} 之间的整数`);
  }
  return parsed;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const envId = (env.CLOUD_BASE_ENV_ID || '').trim();
  if (env.NODE_ENV === 'production' && !envId) {
    throw new Error('生产环境必须配置 CLOUD_BASE_ENV_ID，防止误用演示数据');
  }
  const secretId = env.TENCENTCLOUD_SECRETID?.trim() || undefined;
  const secretKey = env.TENCENTCLOUD_SECRETKEY?.trim() || undefined;
  if (Boolean(secretId) !== Boolean(secretKey)) {
    throw new Error('TENCENTCLOUD_SECRETID 和 TENCENTCLOUD_SECRETKEY 必须同时配置');
  }
  return {
    envId,
    accessKey: env.CLOUDBASE_APIKEY?.trim() || undefined,
    port: integer(env.PORT, 8080, 1, 65535, 'PORT'),
    region: env.TENCENTCLOUD_REGION?.trim() || undefined,
    secretId,
    secretKey,
    sessionToken: env.TENCENTCLOUD_SESSIONTOKEN?.trim() || undefined,
    trustProxyHops: integer(env.TRUST_PROXY_HOPS, 0, 0, 3, 'TRUST_PROXY_HOPS'),
  };
}
