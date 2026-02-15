export type E2EUser = {
  email: string
  password: string
}

const requireEnv = (key: string) => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export const getE2EUsers = () => ({
  unconsented: {
    email: requireEnv('E2E_UNCONSENTED_EMAIL'),
    password: requireEnv('E2E_UNCONSENTED_PASSWORD'),
  },
  consented: {
    email: requireEnv('E2E_CONSENTED_EMAIL'),
    password: requireEnv('E2E_CONSENTED_PASSWORD'),
  },
  outdatedPolicy: {
    email: requireEnv('E2E_OUTDATED_POLICY_EMAIL'),
    password: requireEnv('E2E_OUTDATED_POLICY_PASSWORD'),
  },
})
