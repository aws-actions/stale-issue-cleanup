import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import nock from 'nock';
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAndValidateInputs, run } from '../src/entrypoint';
import { revCompareEventsByDate } from '../src/utils';
import * as mockinputs from './mockinputs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// nock.debug = true;
nock.disableNetConnect();
// nock.activate();

config({
  path: resolve(__dirname, '.env.test'),
});

describe('GitHub issue parser', {}, () => {
  const OLD_ENV = process.env;
  const now = '2019-12-31T00:00:00.000Z';
  let mockDate: MockInstance<() => number>;

  beforeEach(() => {
    vi.resetModules();
    mockDate = vi.spyOn(global.Date, 'now').mockImplementation(() => new Date(now).getTime());
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
    mockDate.mockRestore();
    if (!nock.isDone()) {
      nock.cleanAll();
    }
  });

  it('reads env vars', () => {
    expect(getAndValidateInputs()).toEqual({
      repoToken: process.env.REPO_TOKEN ?? '',
      ancientIssueMessage: process.env.ANCIENT_ISSUE_MESSAGE ?? '',
      ancientPrMessage: process.env.ANCIENT_PR_MESSAGE ?? '',
      staleIssueMessage: process.env.STALE_ISSUE_MESSAGE ?? '',
      stalePrMessage: process.env.STALE_PR_MESSAGE ?? '',
      daysBeforeStale: Number.parseFloat(process.env.DAYS_BEFORE_STALE ?? '0'),
      daysBeforeClose: Number.parseFloat(process.env.DAYS_BEFORE_CLOSE ?? '0'),
      daysBeforeAncient: Number.parseFloat(process.env.DAYS_BEFORE_ANCIENT ?? '0'),
      staleIssueLabel: process.env.STALE_ISSUE_LABEL ?? '',
      exemptIssueLabels: process.env.EXEMPT_ISSUE_LABELS ?? '',
      stalePrLabel: process.env.STALE_PR_LABEL ?? '',
      exemptPrLabels: process.env.EXEMPT_PR_LABELS ?? '',
      cfsLabel: process.env.CFS_LABEL ?? '',
      issueTypes: (process.env.ISSUE_TYPES ?? '').split(','),
      responseRequestedLabel: process.env.RESPONSE_REQUESTED_LABEL ?? '',
      minimumUpvotesToExempt: Number.parseInt(process.env.MINIMUM_UPVOTES_TO_EXEMPT ?? '0'),
      dryrun: String(process.env.DRYRUN).toLowerCase() === 'true',
      useCreatedDateForAncient: String(process.env.USE_CREATED_DATE_FOR_ANCIENT).toLowerCase() === 'true',
    });
  });

  it('handles bogus inputs', () => {
    process.env.DAYS_BEFORE_ANCIENT = 'asdf';
    expect(() => {
      getAndValidateInputs();
    }).toThrow();
    process.env.DAYS_BEFORE_ANCIENT = OLD_ENV.DAYS_EFORE_ANCIENT;
    process.env.DAYS_BEFORE_STALE = 'asdf';
    expect(() => {
      getAndValidateInputs();
    }).toThrow();
    process.env.DAYS_BEFORE_STALE = OLD_ENV.DAYS_BEFORE_STALE;
    process.env.DAYS_BEFORE_CLOSE = 'asdf';
    expect(() => {
      getAndValidateInputs();
    }).toThrow();
    process.env.DAYS_BEFORE_CLOSE = OLD_ENV.DAYS_BEFORE_CLOSE;
  });

  it('compares dates in reverse', () => {
    const dateA = '2018-12-31T00:00:00.000Z';
    const dateB = now;
    const eventA = { created_at: dateA };
    const eventB = { created_at: dateB };
    expect(revCompareEventsByDate(eventA, eventB)).toBe(1);
    expect(revCompareEventsByDate(eventB, eventA)).toBe(-1);
  });

  it('skips issue with empty messages', async () => {
    nock('https://api.github.com')
      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        labels: process.env.RESPONSE_REQUESTED_LABEL,
        per_page: 100,
      })
      .reply(200, []);
    process.env.ANCIENT_ISSUE_MESSAGE = '';
    process.env.STALE_ISSUE_MESSAGE = '';
    process.env.STALE_PR_MESSAGE = '';
    process.env.ISSUE_TYPES = 'issues,pull_requests';
    await run();
    process.env.STALE_ISSUE_MESSAGE = OLD_ENV.STALE_ISSUE_MESSAGE;
    process.env.ANCIENT_ISSUE_MESSAGE = OLD_ENV.ANCIENT_ISSUE_MESSAGE;
    process.env.STALE_PR_MESSAGE = OLD_ENV.STALE_PR_LABEL;
  });

  it('consumes the GitHub API', async () => {
    // nock.enableDebug();

    const scope = nock('https://api.github.com')
      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        labels: process.env.RESPONSE_REQUESTED_LABEL,
        per_page: 100,
      })
      .reply(200, mockinputs.responseRequestedReplies)

      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        labels: process.env.STALE_ISSUE_LABEL,
        per_page: 100,
      })
      .reply(200, mockinputs.staleIssueReplies)

      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        labels: process.env.STALE_PR_LABEL,
        per_page: 100,
      })
      .reply(200, [])

      .delete('/repos/aws-actions/stale-issue-cleanup/issues/257/labels/closing-soon')
      .reply(204, {})

      .delete('/repos/aws-actions/stale-issue-cleanup/issues/257/labels/response-requested')
      .reply(204, {})

      .delete('/repos/aws-actions/stale-issue-cleanup/issues/258/labels/closing-soon')
      .reply(204, {})

      .patch('/repos/aws-actions/stale-issue-cleanup/issues/258')
      .reply(200, {})

      .post('/repos/aws-actions/stale-issue-cleanup/issues/261/comments', {
        body: 'Stale issue message.',
      })
      .reply(201, {})

      .post('/repos/aws-actions/stale-issue-cleanup/issues/299/comments', {
        body: 'Ancient issue message.',
      })
      .reply(201, {})

      .post('/repos/aws-actions/stale-issue-cleanup/issues/261/labels', {
        labels: ['closing-soon'],
      })
      .reply(201, {})

      .post('/repos/aws-actions/stale-issue-cleanup/issues/258/labels', {
        labels: ['closed-for-staleness'],
      })
      .reply(201, {})

      .post('/repos/aws-actions/stale-issue-cleanup/issues/299/labels', {
        labels: ['closing-soon'],
      })
      .reply(201, {})

      .delete('/repos/aws-actions/stale-issue-cleanup/issues/262/labels/response-requested')
      .reply(204, {})

      .get('/repos/aws-actions/stale-issue-cleanup/issues/256/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, mockinputs.issue256Timeline)

      .get('/repos/aws-actions/stale-issue-cleanup/issues/257/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, mockinputs.issue257Timeline)

      .get('/repos/aws-actions/stale-issue-cleanup/issues/258/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, mockinputs.issue258Timeline)

      .get('/repos/aws-actions/stale-issue-cleanup/issues/259/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, mockinputs.issue259Timeline)

      .get('/repos/aws-actions/stale-issue-cleanup/issues/261/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, mockinputs.issue261Timeline)

      .get('/repos/aws-actions/stale-issue-cleanup/issues/262/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, mockinputs.issue262Timeline)

      .get('/repos/aws-actions/stale-issue-cleanup/issues/263/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, mockinputs.issue263Timeline)

      .get('/repos/aws-actions/stale-issue-cleanup/issues/299/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, [])

      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        sort: 'updated',
        direction: 'asc',
        per_page: 100,
      })
      .reply(200, mockinputs.ancientIssueReplies)

      .get('/repos/aws-actions/stale-issue-cleanup/issues/299/reactions')
      .query({ per_page: 100 })
      .reply(200, []);

    await run();

    expect(scope.isDone()).toEqual(true);
  });
});

describe('GitHub issue parser', {}, () => {
  const scope = nock('https://api.github.com');

  beforeEach(() => {
    scope
      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        labels: process.env.RESPONSE_REQUESTED_LABEL,
        per_page: 100,
      })
      .reply(200, [])

      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        labels: process.env.STALE_ISSUE_LABEL,
        per_page: 100,
      })
      .reply(200, [])

      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        labels: process.env.STALE_PR_LABEL,
        per_page: 100,
      })
      .reply(200, [])

      .get('/repos/aws-actions/stale-issue-cleanup/issues')
      .query({
        state: 'open',
        sort: 'updated',
        direction: 'asc',
        per_page: 100,
      })
      .reply(200, [mockinputs.issue256Reply, mockinputs.issue121Reply]);
  });

  afterEach(() => {
    if (!nock.isDone()) {
      nock.cleanAll();
    }
  });

  it('no exempt label', async () => {
    process.env.EXEMPT_ISSUE_LABELS = '';

    scope
      .get('/repos/aws-actions/stale-issue-cleanup/issues/256/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, mockinputs.issue256Timeline)

      .get('/repos/aws-actions/stale-issue-cleanup/issues/256/reactions')
      .query({ per_page: 100 })
      .reply(200, [])

      .post('/repos/aws-actions/stale-issue-cleanup/issues/256/comments', {
        body: 'Ancient issue message.',
      })
      .reply(201, {})

      .post('/repos/aws-actions/stale-issue-cleanup/issues/256/labels', {
        labels: ['closing-soon'],
      })
      .reply(201, {})

      .get('/repos/aws-actions/stale-issue-cleanup/issues/121/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, mockinputs.issue121Timeline)

      .get('/repos/aws-actions/stale-issue-cleanup/issues/121/reactions')
      .query({ per_page: 100 })
      .reply(200, [])

      .post('/repos/aws-actions/stale-issue-cleanup/issues/121/comments', {
        body: 'Ancient issue message.',
      })
      .reply(201, {})

      .post('/repos/aws-actions/stale-issue-cleanup/issues/121/labels', {
        labels: ['closing-soon'],
      })
      .reply(201, {});

    await run();

    expect(scope.isDone()).toEqual(true);
  });

  it('one exempt label, but no issue has it', async () => {
    process.env.EXEMPT_ISSUE_LABELS = 'no-auto-closure-please';

    scope
      .get('/repos/aws-actions/stale-issue-cleanup/issues/256/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, mockinputs.issue256Timeline)

      .get('/repos/aws-actions/stale-issue-cleanup/issues/256/reactions')
      .query({ per_page: 100 })
      .reply(200, [])

      .post('/repos/aws-actions/stale-issue-cleanup/issues/256/comments', {
        body: 'Ancient issue message.',
      })
      .reply(201, {})

      .post('/repos/aws-actions/stale-issue-cleanup/issues/256/labels', {
        labels: ['closing-soon'],
      })
      .reply(201, {})

      .get('/repos/aws-actions/stale-issue-cleanup/issues/121/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, mockinputs.issue121Timeline)

      .get('/repos/aws-actions/stale-issue-cleanup/issues/121/reactions')
      .query({ per_page: 100 })
      .reply(200, [])

      .post('/repos/aws-actions/stale-issue-cleanup/issues/121/comments', {
        body: 'Ancient issue message.',
      })
      .reply(201, {})

      .post('/repos/aws-actions/stale-issue-cleanup/issues/121/labels', {
        labels: ['closing-soon'],
      })
      .reply(201, {});

    await run();

    expect(scope.isDone()).toEqual(true);
  });

  it('one exempt label, one issue has it', async () => {
    process.env.EXEMPT_ISSUE_LABELS = 'go-away-bot';

    scope
      .get('/repos/aws-actions/stale-issue-cleanup/issues/256/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, mockinputs.issue256Timeline)

      .get('/repos/aws-actions/stale-issue-cleanup/issues/121/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, mockinputs.issue121Timeline)

      .get('/repos/aws-actions/stale-issue-cleanup/issues/121/reactions')
      .query({ per_page: 100 })
      .reply(200, [])

      .post('/repos/aws-actions/stale-issue-cleanup/issues/121/comments', {
        body: 'Ancient issue message.',
      })
      .reply(201, {})

      .post('/repos/aws-actions/stale-issue-cleanup/issues/121/labels', {
        labels: ['closing-soon'],
      })
      .reply(201, {});

    await run();

    expect(scope.isDone()).toEqual(true);
  });

  it('two exempt labels, one issue has one of the labels', async () => {
    process.env.EXEMPT_ISSUE_LABELS = 'go-away-bot, bot-stay-away';

    scope
      .get('/repos/aws-actions/stale-issue-cleanup/issues/256/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, mockinputs.issue256Timeline)

      .get('/repos/aws-actions/stale-issue-cleanup/issues/121/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, mockinputs.issue121Timeline)

      .get('/repos/aws-actions/stale-issue-cleanup/issues/121/reactions')
      .query({ per_page: 100 })
      .reply(200, [])

      .post('/repos/aws-actions/stale-issue-cleanup/issues/121/comments', {
        body: 'Ancient issue message.',
      })
      .reply(201, {})

      .post('/repos/aws-actions/stale-issue-cleanup/issues/121/labels', {
        labels: ['closing-soon'],
      })
      .reply(201, {});

    await run();

    expect(scope.isDone()).toEqual(true);
  });

  it('two exempt labels, two issues have one label each', async () => {
    process.env.EXEMPT_ISSUE_LABELS = 'help-wanted, go-away-bot';

    scope
      .get('/repos/aws-actions/stale-issue-cleanup/issues/256/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, mockinputs.issue256Timeline)

      .get('/repos/aws-actions/stale-issue-cleanup/issues/121/timeline')
      .matchHeader('accept', 'application/vnd.github.mockingbird-preview+json')
      .query({ per_page: 100 })
      .reply(200, mockinputs.issue121Timeline);

    await run();

    expect(scope.isDone()).toEqual(true);
  });
});