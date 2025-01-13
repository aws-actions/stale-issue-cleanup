import os from 'node:os';
import * as core from '@actions/core';
import nock from 'nock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as entrypoint from '../src/entrypoint.ts';
import * as github from '../src/github.ts';
import * as mockinputs from './mockinputs.ts';

const OLD_ENV = process.env;

/*
 * API call order (if all messages are set):
 * 1. GET /repos/{owner}/{repo}/issues?state=open&labels=response-requested&per_page=100
 * 2. GET /repos/{owner}/{repo}/issues?state=open&labels=closing-soon&per_page=100
 * 3. GET /repos/{owner}/{repo}/issues?state=open&labels=stale-pr&per_page=100
 * 4. GET /repos/{owner}/{repo}/issues?state=open&sort=updated&direction=asc&per_page=100
 * 5. Issue specific API calls (get timeline, add comment, add label, remove label)
 */

/*
  1. If would take an action on an issue, but it has an exempt label, do nothing
  2. If an issue has rr and cs and it gets a comment, remove rr and cs
  3. If an issue has rr and no cs and it gets a comment, remove rr
  4. If an issue has rr and no cs and the stale timer is up, add stale message and apply cs
  5. If an issue has rr and no cs but the stale timer is not up, do nothing
  6. If an issue has rr and cs and the close timer is up, apply cfs, close issue
  7. If an issue has rr and cs but the close timer is not up, do nothing
  8. If an issue is older than ancient timer, add ancient message and stale it
  9. If the issue messages are empty, skip that issue type
*/
describe('Issue tests', {}, () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // GitHub tries to read the Windows version to populate the user-agent header, but this fails in some test
    // environments.
    vi.spyOn(os, 'platform').mockImplementation(() => 'linux');
    vi.spyOn(os, 'release').mockImplementation(() => '1.0');
    // Mock core functions
    vi.spyOn(core, 'setFailed').mockImplementation(console.error);
    vi.spyOn(core, 'error').mockImplementation(() => {});
    vi.spyOn(core, 'debug').mockImplementation(() => {});
    vi.spyOn(core, 'info').mockImplementation(() => {});
    // GitHub Actions uses environment vars to store action inputs
    process.env = Object.assign(OLD_ENV, { ...mockinputs.actionInputs });
    vi.spyOn(github, 'removeLabel');
    vi.spyOn(github, 'markStale');
    vi.spyOn(github, 'closeIssue');
  });
  afterEach(() => {
    // Reest env and terminate any pending nocks
    process.env = OLD_ENV;
    if (!nock.isDone()) nock.cleanAll();
  });

  it('Skips issues with exempt labels', {}, async () => {
    nock('https://api.github.com')
      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        labels: process.env.RESPONSE_REQUESTED_LABEL,
        per_page: 100,
      })
      .reply(200, [mockinputs.issue256])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=closing-soon&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=stale-pr&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&sort=updated&direction=asc&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues/256/timeline?per_page=100')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .reply(200, [...mockinputs.issue256Timeline]);
    await entrypoint.run();
    expect(core.debug).toHaveBeenLastCalledWith('issue contains exempt label');
  });
  it('Removes rr and cs labels when an issue is commented on', {}, async () => {
    nock('https://api.github.com')
      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        labels: process.env.RESPONSE_REQUESTED_LABEL,
        per_page: 100,
      })
      .reply(200, [mockinputs.issue257])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=closing-soon&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=stale-pr&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&sort=updated&direction=asc&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues/257/timeline?per_page=100')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .reply(200, [...mockinputs.issue257Timeline])
      .delete('/repos/aws-actions/stale-issue-cleanup/issues/257/labels/closing-soon')
      .reply(204, {})
      .delete('/repos/aws-actions/stale-issue-cleanup/issues/257/labels/response-requested')
      .reply(204, {});
    await entrypoint.run();
    expect(github.removeLabel).toHaveBeenCalledTimes(2);
  });
  it('Removes rr label when an issue is commented on and cs is not present', {}, async () => {
    nock('https://api.github.com')
      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        labels: process.env.RESPONSE_REQUESTED_LABEL,
        per_page: 100,
      })
      .reply(200, [mockinputs.issue262])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=closing-soon&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=stale-pr&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&sort=updated&direction=asc&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues/262/timeline?per_page=100')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .reply(200, [...mockinputs.issue262Timeline])
      .delete('/repos/aws-actions/stale-issue-cleanup/issues/262/labels/response-requested')
      .reply(204, {});
    await entrypoint.run();
    expect(github.removeLabel).toHaveBeenCalledTimes(1);
  });
  it('Adds closing-soon label and stale message when an issue is stale', {}, async () => {
    nock('https://api.github.com')
      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        labels: process.env.RESPONSE_REQUESTED_LABEL,
        per_page: 100,
      })
      .reply(200, [mockinputs.issue261])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=closing-soon&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=stale-pr&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&sort=updated&direction=asc&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues/261/timeline?per_page=100')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .reply(200, [...mockinputs.issue261Timeline])
      .post('/repos/aws-actions/stale-issue-cleanup/issues/261/comments', {
        body: 'Stale issue message.',
      })
      .reply(201, {})
      .post('/repos/aws-actions/stale-issue-cleanup/issues/261/labels', {
        labels: ['closing-soon'],
      })
      .reply(201, {});
    await entrypoint.run();
    expect(github.markStale).toHaveBeenCalledTimes(1);
  });
  it('Does nothing if an issue is not stale yet', {}, async () => {
    nock('https://api.github.com')
      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        labels: process.env.RESPONSE_REQUESTED_LABEL,
        per_page: 100,
      })
      .reply(200, [mockinputs.issue263])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=closing-soon&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=stale-pr&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&sort=updated&direction=asc&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues/263/timeline?per_page=100')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .reply(200, [...mockinputs.issue263Timeline]);
    await entrypoint.run();
    expect(github.markStale).not.toHaveBeenCalled();
  });
  it('Closes issues once close timer is up', {}, async () => {
    nock('https://api.github.com')
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=response-requested&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=closing-soon&per_page=100')
      .reply(200, [mockinputs.issue258])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=stale-pr&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&sort=updated&direction=asc&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues/258/timeline?per_page=100')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .reply(200, [...mockinputs.issue258Timeline])
      .delete('/repos/aws-actions/stale-issue-cleanup/issues/258/labels/closing-soon')
      .reply(204, {})
      .patch('/repos/aws-actions/stale-issue-cleanup/issues/258')
      .reply(200, {})
      .post('/repos/aws-actions/stale-issue-cleanup/issues/258/labels', {
        labels: ['closed-for-staleness'],
      })
      .reply(201, {});
    await entrypoint.run();
    expect(github.closeIssue).toHaveBeenCalledTimes(1);
    expect(github.removeLabel).toHaveBeenCalledTimes(1);
  });
  it('Does nothing if the close timer is not up yet', {}, async () => {
    nock('https://api.github.com')
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=response-requested&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=closing-soon&per_page=100')
      .reply(200, [mockinputs.issue259])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=stale-pr&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&sort=updated&direction=asc&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues/259/timeline?per_page=100')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .reply(200, [...mockinputs.issue259Timeline]);
    await entrypoint.run();
    expect(github.closeIssue).not.toHaveBeenCalled();
  });
  it('Stales ancient issues with insufficient upvotes', {}, async () => {
    nock('https://api.github.com')
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=response-requested&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=closing-soon&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=stale-pr&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&sort=updated&direction=asc&per_page=100')
      .reply(200, [mockinputs.issue299])
      .get('/repos/aws-actions/stale-issue-cleanup/issues/299/timeline?per_page=100')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues/299/reactions?per_page=100')
      .reply(200, [])
      .post('/repos/aws-actions/stale-issue-cleanup/issues/299/comments', {
        body: 'Ancient issue message.',
      })
      .reply(201, {})
      .post('/repos/aws-actions/stale-issue-cleanup/issues/299/labels', {
        labels: ['closing-soon'],
      })
      .reply(201, {});
    await entrypoint.run();
    expect(github.markStale).toHaveBeenCalledTimes(1);
  });
  it('Skips issues if empty messages were configured', {}, async () => {
    nock('https://api.github.com')
      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        labels: process.env.RESPONSE_REQUESTED_LABEL,
        per_page: 100,
      })
      .reply(200, [mockinputs.issue261])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=closing-soon&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&labels=stale-pr&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues?state=open&sort=updated&direction=asc&per_page=100')
      .reply(200, [])
      .get('/repos/aws-actions/stale-issue-cleanup/issues/261/timeline?per_page=100')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .reply(200, [...mockinputs.issue261Timeline])
      .post('/repos/aws-actions/stale-issue-cleanup/issues/261/comments', {
        body: 'Stale issue message.',
      })
      .reply(201, {})
      .post('/repos/aws-actions/stale-issue-cleanup/issues/261/labels', {
        labels: ['closing-soon'],
      })
      .reply(201, {});
    const env = process.env;
    process.env.STALE_ISSUE_MESSAGE = '';
    process.env.ANCIENT_ISSUE_MESSAGE = '';
    process.env.STALE_PR_MESSAGE = '';
    await entrypoint.run();
    process.env.STALE_ISSUE_MESSAGE = env.STALE_ISSUE_MESSAGE;
    process.env.ANCIENT_ISSUE_MESSAGE = env.ANCIENT_ISSUE_MESSAGE;
    process.env.STALE_PR_MESSAGE = env.STALE_PR_MESSAGE;
    expect(github.markStale).not.toHaveBeenCalled();
  });
});

describe('Configuration tests', {}, () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // GitHub tries to read the Windows version to populate the user-agent header, but this fails in some test
    // environments.
    vi.spyOn(os, 'platform').mockImplementation(() => 'linux');
    vi.spyOn(os, 'release').mockImplementation(() => '1.0');
    // Mock core functions
    vi.spyOn(core, 'setFailed').mockImplementation(console.error);
    vi.spyOn(core, 'error').mockImplementation(console.error);
    vi.spyOn(core, 'debug').mockImplementation(() => {});
    vi.spyOn(core, 'info').mockImplementation(() => {});
    // GitHub Actions uses environment vars to store action inputs
    process.env = Object.assign(OLD_ENV, { ...mockinputs.actionInputs });
  });
  afterEach(() => {
    // Reest env
    process.env = OLD_ENV;
    if (!nock.isDone()) nock.cleanAll();
  });

  it('Reads and validates action inputs', {}, () => {
    const inputs = entrypoint.getAndValidateInputs();
    expect(inputs).toEqual({
      repoToken: process.env.REPO_TOKEN,
      ancientIssueMessage: process.env.ANCIENT_ISSUE_MESSAGE,
      ancientPrMessage: process.env.ANCIENT_PR_MESSAGE,
      dryrun: !!process.env.DRYRUN,
      staleIssueMessage: process.env.STALE_ISSUE_MESSAGE,
      stalePrMessage: process.env.STALE_PR_MESSAGE,
      daysBeforeStale: Number.parseFloat(process.env.DAYS_BEFORE_STALE ?? '0'),
      daysBeforeClose: Number.parseFloat(process.env.DAYS_BEFORE_CLOSE ?? '0'),
      daysBeforeAncient: Number.parseFloat(process.env.DAYS_BEFORE_ANCIENT ?? '0'),
      staleIssueLabel: process.env.STALE_ISSUE_LABEL,
      exemptIssueLabels: process.env.EXEMPT_ISSUE_LABELS,
      stalePrLabel: process.env.STALE_PR_LABEL,
      exemptPrLabels: process.env.EXEMPT_PR_LABELS,
      responseRequestedLabel: process.env.RESPONSE_REQUESTED_LABEL,
      minimumUpvotesToExempt: Number.parseInt(process.env.MINIMUM_UPVOTES_TO_EXEMPT ?? '0'),
      cfsLabel: process.env.CFS_LABEL,
      issueTypes: process.env.ISSUE_TYPES?.split(','),
      useCreatedDateForAncient: !!process.env.USE_CREATED_DATE_FOR_ANCIENT,
    });
  });
  it('Handles bad inputs', {}, () => {
    const env = process.env;
    process.env.DAYS_BEFORE_ANCIENT = 'asdf';
    expect(() => {
      entrypoint.getAndValidateInputs();
    }).toThrow();
    process.env.DAYS_BEFORE_ANCIENT = env.DAYS_EFORE_ANCIENT;
    process.env.DAYS_BEFORE_STALE = 'asdf';
    expect(() => {
      entrypoint.getAndValidateInputs();
    }).toThrow();
    process.env.DAYS_BEFORE_STALE = env.DAYS_BEFORE_STALE;
    process.env.DAYS_BEFORE_CLOSE = 'asdf';
    expect(() => {
      entrypoint.getAndValidateInputs();
    }).toThrow();
  });
});

