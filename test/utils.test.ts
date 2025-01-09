import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as utils from '../src/utils';
import * as mockinputs from './mockinputs';
import * as core from '@actions/core';

describe('Utility function', {}, () =>  {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(core, 'setFailed').mockImplementation(() => {});
    vi.spyOn(core, 'debug').mockImplementation(() => {});
  });
  it('Can find if an issue is labeled', () =>{
    const issue = mockinputs.issue;
    expect(utils.isLabeled(issue, 'bug')).toBeTruthy();
    expect(utils.isLabeled(issue, 'enhancement')).toBeFalsy();
  })
  it('Is OK with issues missing labels', () => {
    const issue = mockinputs.issue;
    expect(utils.isLabeled(issue, 'enhancement')).toBeFalsy();
  })
});
