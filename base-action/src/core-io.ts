import { appendFileSync } from "fs";

function getOutputFile(): string | undefined {
  return process.env.GITEA_OUTPUT || process.env.GITHUB_OUTPUT;
}

function getEnvFile(): string | undefined {
  return process.env.GITEA_ENV || process.env.GITHUB_ENV;
}

export function setOutput(name: string, value: string): void {
  const outputFile = getOutputFile();
  const line = `${name}=${value}`;
  if (outputFile) {
    appendFileSync(outputFile, `${line}\n`);
    return;
  }
  console.log(`::set-output name=${name}::${value}`);
}

export function exportVariable(name: string, value: string): void {
  const envFile = getEnvFile();
  const line = `${name}=${value}`;
  if (envFile) {
    appendFileSync(envFile, `${line}\n`);
    return;
  }
  process.env[name] = value;
}

export function setFailed(message: string): void {
  console.error(message);
  process.exitCode = 1;
}

export function info(message: string): void {
  console.log(message);
}

export function warning(message: string): void {
  console.warn(message);
}

export function error(message: string): void {
  console.error(message);
}

export function debug(message: string): void {
  if (process.env.DEBUG || process.env.ACTIONS_STEP_DEBUG === "true") {
    console.debug(message);
  }
}
