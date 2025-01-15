import * as core from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as utils from '../src/utils';
import * as mockinputs from './mockinputs.ts';

describe('Utility functions', {}, () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(core, 'setFailed').mockImplementation(() => {});
    vi.spyOn(core, 'debug').mockImplementation(() => {});
  });

  it('Can find if an issue is labeled', {}, () => {
    const issue = mockinputs.issue;
    expect(utils.isLabeled(issue, 'bug')).toBeTruthy();
    expect(utils.isLabeled(issue, 'enhancement')).toBeFalsy();
  });

  it('Is OK with issues missing labels', {}, () => {
    const issue = mockinputs.issueWithoutLabels;
    expect(utils.isLabeled(issue as typeof mockinputs.issue, 'enhancement')).toBeFalsy();
  });

  it('Can compare events by date', {}, () => {
    const a = mockinputs.issue257Timeline[0];
    const b = mockinputs.issue257Timeline[1];
    expect(utils.revCompareEventsByDate(a, b)).toBe(1);
  });

  it('Can compare events by date the other way', {}, () => {
    const a = mockinputs.issue257Timeline[1];
    const b = mockinputs.issue257Timeline[0];
    expect(utils.revCompareEventsByDate(a, b)).toBe(-1);
  });

  it('Can compare events by equal dates', {}, () => {
    const a = mockinputs.issue257Timeline[0];
    const b = mockinputs.issue257Timeline[0];
    expect(utils.revCompareEventsByDate(a, b)).toBe(0);
  });

  it('Returns the last time a label was added', {}, () => {
    const events = mockinputs.issue257Timeline;
    const label = 'closing-soon';
    const lastTime = utils.getLastLabelTime(events, label);
    expect(lastTime).toBeInstanceOf(Date);
    expect(lastTime).toEqual(new Date('2016-08-19T11:57:18Z'));
  });

  it('Returns undefined if a label was never added', {}, () => {
    const events = mockinputs.issue257Timeline;
    const label = 'not-a-label';
    const lastTime = utils.getLastLabelTime(events, label);
    expect(lastTime).toBeUndefined();
  });

  it('Can get the last comment time', {}, () => {
    const events = mockinputs.issue257Timeline;
    const lastTime = utils.getLastCommentTime(events);
    expect(lastTime).toBeInstanceOf(Date);
    expect(lastTime).toEqual(new Date(mockinputs.now));
  });

  it('Can get a time if there are no comments anyway', {}, () => {
    const events = mockinputs.issue256Timeline;
    const lastTime = utils.getLastCommentTime(events);
    expect(lastTime).toBeInstanceOf(Date);
    expect(lastTime).toEqual(new Date('2016-08-19T11:57:18Z'));
  });

  it('Correctly fails trying to get last comment time on nothing', {}, () => {
    const events = [{}];
    const lastTime = utils.getLastCommentTime(events);
    expect(lastTime).toBeUndefined();
  });

  it('Formats dates', {}, () => {
    const date = new Date('2016-08-19T10:57:18-0100');
    expect(utils.dateFormatToIsoUtc(date)).toBe('2016-08-19T11:57:18Z');
  });

  it('Formats string arrays', {}, () => {
    const str = '1,2,3,4,5  ';
    expect(utils.parseCommaSeparatedString(str)).toEqual(['1', '2', '3', '4', '5']);
  });
});
