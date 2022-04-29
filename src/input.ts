import * as core from '@actions/core';

export interface args {
  dryrun: boolean;
  minimumUpvotesToExempt: number;
  token: string;
}

export function getAndValidateInputs(): args {
  const minUpvotes = parseInt(core.getInput('minimumUpvotesToExempt', { required: false }));
  for (const numberInput of [minUpvotes]) {
    if (isNaN(numberInput)) {
      throw Error(`Input ${numberInput} did not parse to a valid integar`);
    }
  }
  return {
    dryrun: core.getBooleanInput('dryrun', { required: false }),
    minimumUpvotesToExempt: minUpvotes,
    token: process.env.REPO_TOKEN!,
  };
}
