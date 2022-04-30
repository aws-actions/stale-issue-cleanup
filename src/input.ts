import * as core from '@actions/core';
import { labelActions } from './github';
export interface args {
  dryrun: boolean;
  minimumUpvotesToExempt: number;
  token: string;
  expirationLabelMap?: string[];
  updateRemoveLabels?: string[];
}

export function getAndValidateInputs(): args {
  // Number inputs
  const minUpvotes = parseInt(core.getInput('minimum-upvotes-to-exempt', { required: false }));
  for (const numberInput of [minUpvotes]) {
    if (isNaN(numberInput)) {
      throw Error(`Input ${numberInput} did not parse to a valid integer`);
    }
  }

  // Action map
  const labelValidationRegex = new RegExp(`^[A-Za-z0-9_.-,]+:(${labelActions.join('|')}):\\d+(:[A-Za-z0-9_.-,]+)?/i`);
  const expirationLabelMap = core
    .getMultilineInput('expiration-label-map', { required: false })
    .filter(m => labelValidationRegex.test(m));
  core.debug(`Parsed label mapping: ${expirationLabelMap}`);
  const updateRemoveLabels = core.getInput('update-remove-labels', { required: false }).split(',');

  return {
    dryrun: core.getBooleanInput('dry-run', { required: false }),
    minimumUpvotesToExempt: minUpvotes,
    token: core.getInput('repo-token'),
    expirationLabelMap,
    updateRemoveLabels,
  };
}
