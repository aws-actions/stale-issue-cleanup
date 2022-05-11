import * as core from '@actions/core';
import { labelActions } from './github.js';
export interface args {
  dryrun: boolean;
  minimumUpvotesToExempt: number;
  token: string;
  expirationLabelMap?: string[];
  updateRemoveLabels?: string[];
  prExpirationLabelMap?: string[];
  prUpdateRemoveLabels?: string[];
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
    .getMultilineInput('issue-expiration-label-map', { required: false })
    .filter(m => labelValidationRegex.test(m));
  core.debug(`Parsed issue label mapping: ${expirationLabelMap.toString()}`);
  const prExpirationLabelMap = core
    .getMultilineInput('pr-expiration-label-map', { required: false })
    .filter(m => labelValidationRegex.test(m));
  core.debug(`Parsed PR label mapping: ${prExpirationLabelMap.toString()}`);
  const updateRemoveLabels = core.getInput('issue-update-remove-labels', { required: false }).split(',');
  const prUpdateRemoveLabels = core.getInput('pr-update-remove-labels', { required: false }).split(',');

  return {
    dryrun: core.getBooleanInput('dry-run', { required: false }),
    minimumUpvotesToExempt: minUpvotes,
    token: core.getInput('repo-token'),
    expirationLabelMap,
    updateRemoveLabels,
    prExpirationLabelMap,
    prUpdateRemoveLabels,
  };
}

export function allInterestedLabels(args: args) {
  return [
    ...(args.expirationLabelMap || []),
    ...(args.updateRemoveLabels || []),
    ...(args.prExpirationLabelMap || []),
    ...(args.prUpdateRemoveLabels || []),
  ];
}
